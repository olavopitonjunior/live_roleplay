/**
 * Edge Function: get-api-metrics
 *
 * Returns aggregated API usage metrics for the admin dashboard.
 * Supports dual auth: x-access-code header (admin) or JWT (admin+ role).
 * Scopes results to org_id when available.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";

interface ApiMetric {
  id: string;
  session_id: string;
  realtime_input_tokens: number;
  realtime_output_tokens: number;
  realtime_duration_seconds: number;
  text_api_calls: number;
  text_api_input_tokens: number;
  text_api_output_tokens: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  simli_duration_seconds: number;
  livekit_participant_minutes: number;
  estimated_cost_cents: number;
  llm_provider: string;
  created_at: string;
}

interface DailyAggregate {
  date: string;
  session_count: number;
  total_realtime_tokens: number;
  total_text_api_calls: number;
  total_claude_tokens: number;
  total_avatar_minutes: number;
  total_livekit_minutes: number;
  total_cost_cents: number;
}

interface MetricsTotals {
  total_sessions: number;
  realtime_tokens: number;
  text_api_calls: number;
  claude_tokens: number;
  avatar_minutes: number;
  livekit_minutes: number;
  estimated_cost_usd: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // --- Dual Auth: JWT (admin+ role) or x-access-code header (admin) ---
    const authResult = await authenticate(req, {
      requireAdmin: true,
      requiredRole: "admin",
    });

    if (!authResult.success) {
      return corsErrorResponse(authResult.error, authResult.status, req);
    }

    const { context: auth, supabase } = authResult;

    // Parse query parameters
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const scenarioId = url.searchParams.get("scenario_id");
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    // Build query for metrics with session data
    let query = supabase
      .from("api_metrics")
      .select(`
        *,
        sessions (
          scenario_id,
          access_code_id,
          org_id,
          scenarios (
            id,
            title
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Scope to org if user has one (enterprise users see only their org's metrics)
    if (auth.org_id) {
      query = query.eq("org_id", auth.org_id);
    }

    // Apply date filters
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    const { data: metrics, error: metricsError } = await query;

    if (metricsError) {
      console.error("Failed to fetch metrics:", metricsError);
      return corsErrorResponse("Failed to fetch metrics", 500, req);
    }

    // Filter by scenario if specified (need to do it in memory since it's nested)
    let filteredMetrics = metrics || [];
    if (scenarioId) {
      filteredMetrics = filteredMetrics.filter(
        (m: any) => m.sessions?.scenario_id === scenarioId
      );
    }

    // Calculate totals
    const totals = calculateTotals(filteredMetrics);

    // Aggregate by date
    const dailyAggregates = aggregateByDate(filteredMetrics);

    return corsJsonResponse(
      {
        metrics: filteredMetrics,
        totals,
        daily_aggregates: dailyAggregates,
        filters: {
          start_date: startDate,
          end_date: endDate,
          scenario_id: scenarioId,
        },
      },
      200,
      req
    );
  } catch (error) {
    console.error("Error in get-api-metrics:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});

function calculateTotals(metrics: any[]): MetricsTotals {
  const result = metrics.reduce(
    (acc, m) => ({
      total_sessions: acc.total_sessions + 1,
      realtime_tokens:
        acc.realtime_tokens +
        (m.realtime_input_tokens || 0) +
        (m.realtime_output_tokens || 0),
      text_api_calls: acc.text_api_calls + (m.text_api_calls || 0),
      claude_tokens:
        acc.claude_tokens +
        (m.claude_input_tokens || 0) +
        (m.claude_output_tokens || 0),
      avatar_minutes:
        acc.avatar_minutes + (m.simli_duration_seconds || 0) / 60,
      livekit_minutes:
        acc.livekit_minutes + (m.livekit_participant_minutes || 0),
      estimated_cost_usd:
        acc.estimated_cost_usd + (m.estimated_cost_cents || 0) / 100,
    }),
    {
      total_sessions: 0,
      realtime_tokens: 0,
      text_api_calls: 0,
      claude_tokens: 0,
      avatar_minutes: 0,
      livekit_minutes: 0,
      estimated_cost_usd: 0,
    }
  );

  // Round numeric values
  result.avatar_minutes = Math.round(result.avatar_minutes * 100) / 100;
  result.livekit_minutes = Math.round(result.livekit_minutes * 100) / 100;
  result.estimated_cost_usd = Math.round(result.estimated_cost_usd * 100) / 100;

  return result;
}

function aggregateByDate(metrics: any[]): DailyAggregate[] {
  const byDate: Record<string, DailyAggregate> = {};

  metrics.forEach((m) => {
    const date = m.created_at?.substring(0, 10) || "unknown";

    if (!byDate[date]) {
      byDate[date] = {
        date,
        session_count: 0,
        total_realtime_tokens: 0,
        total_text_api_calls: 0,
        total_claude_tokens: 0,
        total_avatar_minutes: 0,
        total_livekit_minutes: 0,
        total_cost_cents: 0,
      };
    }

    byDate[date].session_count += 1;
    byDate[date].total_realtime_tokens +=
      (m.realtime_input_tokens || 0) + (m.realtime_output_tokens || 0);
    byDate[date].total_text_api_calls += m.text_api_calls || 0;
    byDate[date].total_claude_tokens +=
      (m.claude_input_tokens || 0) + (m.claude_output_tokens || 0);
    byDate[date].total_avatar_minutes += (m.simli_duration_seconds || 0) / 60;
    byDate[date].total_livekit_minutes += m.livekit_participant_minutes || 0;
    byDate[date].total_cost_cents += m.estimated_cost_cents || 0;
  });

  // Convert to array and sort by date descending
  return Object.values(byDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => ({
      ...d,
      total_avatar_minutes: Math.round(d.total_avatar_minutes * 100) / 100,
      total_livekit_minutes: Math.round(d.total_livekit_minutes * 100) / 100,
    }));
}
