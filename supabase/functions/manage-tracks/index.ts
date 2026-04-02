/**
 * Edge Function: manage-tracks
 *
 * CRUD + progress tracking for training tracks (esteiras).
 * Supports dual auth: access_code (admin for write) or JWT (admin+ for write).
 * Read operations (list, get) are open to all authenticated users.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { authenticate, type AuthContext } from "../_shared/auth.ts";

// ============================================
// Types
// ============================================

interface TrackScenarioInput {
  scenario_id: string;
  position: number;
  is_required?: boolean;
  skills_introduced?: string[];
  skills_expected?: string[];
}

interface CreateRequest {
  action: "create";
  access_code?: string;
  data: {
    title: string;
    slug: string;
    description?: string;
    cover_image_url?: string;
    category?: string;
    display_order?: number;
    scenarios: TrackScenarioInput[];
  };
}

interface UpdateRequest {
  action: "update";
  access_code?: string;
  track_id: string;
  data: {
    title?: string;
    slug?: string;
    description?: string;
    cover_image_url?: string;
    category?: string;
    display_order?: number;
    is_active?: boolean;
    scenarios?: TrackScenarioInput[];
  };
}

interface DeleteRequest {
  action: "delete";
  access_code?: string;
  track_id: string;
}

interface ListRequest {
  action: "list";
  access_code?: string;
  trial_user_id?: string;
}

interface GetRequest {
  action: "get";
  access_code?: string;
  track_slug: string;
  trial_user_id?: string;
}

interface RecordProgressRequest {
  action: "record-progress";
  access_code?: string;
  track_id: string;
  scenario_id: string;
  session_id: string;
  score: number;
  weaknesses?: string[];
  spin_stage_reached?: string;
}

type RequestBody =
  | CreateRequest
  | UpdateRequest
  | DeleteRequest
  | ListRequest
  | GetRequest
  | RecordProgressRequest;

// ============================================
// Handler
// ============================================

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body = (await req.json()) as RequestBody;
    const { action } = body;

    // Auth: write ops require admin, read ops allow any authenticated user
    const isWriteOp = ["create", "update", "delete"].includes(action);
    const authResult = await authenticate(req, {
      body: body as Record<string, unknown>,
      requireAdmin: isWriteOp,
    });

    if (!authResult.success) {
      return corsErrorResponse(authResult.error, authResult.status, req);
    }

    const { supabase, context } = authResult;

    switch (action) {
      // ==============================
      // LIST — all active tracks with scenario count + user progress
      // ==============================
      case "list": {
        const { data: tracks, error: tracksError } = await supabase
          .from("training_tracks")
          .select(`
            *,
            track_scenarios (
              id,
              scenario_id,
              position,
              is_required,
              skills_introduced,
              skills_expected,
              scenarios:scenario_id (
                id, title, category, session_type, character_name, character_role,
                target_duration_seconds, is_active
              )
            )
          `)
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (tracksError) {
          console.error("Error fetching tracks:", tracksError);
          return corsErrorResponse("Failed to fetch tracks", 500, req);
        }

        // Fetch user progress if access_code provided
        let progressMap: Record<string, unknown> = {};
        const accessCodeId = context.access_code_id;
        if (accessCodeId) {
          const { data: progressRows } = await supabase
            .from("user_track_progress")
            .select("*")
            .eq("access_code_id", accessCodeId);

          if (progressRows) {
            for (const p of progressRows) {
              progressMap[p.track_id] = p;
            }
          }
        }

        // Sort track_scenarios by position and attach progress
        const result = (tracks || []).map((track: Record<string, unknown>) => {
          const scenarios = (track.track_scenarios as Record<string, unknown>[]) || [];
          scenarios.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.position as number) - (b.position as number)
          );
          return {
            ...track,
            track_scenarios: scenarios,
            progress: progressMap[track.id as string] || null,
          };
        });

        return corsJsonResponse({ tracks: result }, 200, req);
      }

      // ==============================
      // GET — single track with full details
      // ==============================
      case "get": {
        const { track_slug } = body as GetRequest;
        if (!track_slug) {
          return corsErrorResponse("track_slug required", 400, req);
        }

        const { data: track, error: trackError } = await supabase
          .from("training_tracks")
          .select(`
            *,
            track_scenarios (
              id,
              scenario_id,
              position,
              is_required,
              skills_introduced,
              skills_expected,
              scenarios:scenario_id (
                id, title, context, category, session_type,
                character_name, character_role, personality,
                target_duration_seconds, ai_voice, character_gender,
                objections, evaluation_criteria, is_active
              )
            )
          `)
          .eq("slug", track_slug)
          .single();

        if (trackError || !track) {
          return corsErrorResponse("Track not found", 404, req);
        }

        // Sort scenarios by position
        const scenarios = (track.track_scenarios as Record<string, unknown>[]) || [];
        scenarios.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          (a.position as number) - (b.position as number)
        );
        track.track_scenarios = scenarios;

        // Fetch user progress
        let progress = null;
        const accessCodeId = context.access_code_id;
        if (accessCodeId) {
          const { data: progressData } = await supabase
            .from("user_track_progress")
            .select("*")
            .eq("access_code_id", accessCodeId)
            .eq("track_id", track.id)
            .single();

          progress = progressData;
        }

        return corsJsonResponse({ track: { ...track, progress } }, 200, req);
      }

      // ==============================
      // CREATE — admin creates a new track with scenarios
      // ==============================
      case "create": {
        const { data } = body as CreateRequest;

        if (!data.title?.trim()) {
          return corsErrorResponse("Title is required", 400, req);
        }
        if (!data.slug?.trim()) {
          return corsErrorResponse("Slug is required", 400, req);
        }
        if (!data.scenarios?.length) {
          return corsErrorResponse("At least one scenario is required", 400, req);
        }

        // Validate scenarios exist
        const scenarioIds = data.scenarios.map((s) => s.scenario_id);
        const { data: existingScenarios } = await supabase
          .from("scenarios")
          .select("id")
          .in("id", scenarioIds);

        const existingIds = new Set((existingScenarios || []).map((s: { id: string }) => s.id));
        const missing = scenarioIds.filter((id) => !existingIds.has(id));
        if (missing.length > 0) {
          return corsErrorResponse(`Scenarios not found: ${missing.join(", ")}`, 400, req);
        }

        // Insert track
        const { data: track, error: trackError } = await supabase
          .from("training_tracks")
          .insert({
            title: data.title.trim(),
            slug: data.slug.trim().toLowerCase(),
            description: data.description || null,
            cover_image_url: data.cover_image_url || null,
            category: data.category || null,
            display_order: data.display_order ?? 0,
          })
          .select()
          .single();

        if (trackError) {
          if (trackError.code === "23505") {
            return corsErrorResponse("Track slug already exists", 409, req);
          }
          console.error("Error creating track:", trackError);
          return corsErrorResponse("Failed to create track", 500, req);
        }

        // Insert track_scenarios
        const trackScenarios = data.scenarios.map((s) => ({
          track_id: track.id,
          scenario_id: s.scenario_id,
          position: s.position,
          is_required: s.is_required ?? true,
          skills_introduced: s.skills_introduced || [],
          skills_expected: s.skills_expected || [],
        }));

        const { error: tsError } = await supabase
          .from("track_scenarios")
          .insert(trackScenarios);

        if (tsError) {
          console.error("Error inserting track_scenarios:", tsError);
          // Clean up the track
          await supabase.from("training_tracks").delete().eq("id", track.id);
          return corsErrorResponse("Failed to assign scenarios to track", 500, req);
        }

        return corsJsonResponse({ success: true, track }, 201, req);
      }

      // ==============================
      // UPDATE — admin updates track and/or reorders scenarios
      // ==============================
      case "update": {
        const { track_id, data } = body as UpdateRequest;
        if (!track_id) {
          return corsErrorResponse("track_id required", 400, req);
        }

        // Update track metadata
        const trackUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (data.title !== undefined) trackUpdates.title = data.title.trim();
        if (data.slug !== undefined) trackUpdates.slug = data.slug.trim().toLowerCase();
        if (data.description !== undefined) trackUpdates.description = data.description;
        if (data.cover_image_url !== undefined) trackUpdates.cover_image_url = data.cover_image_url;
        if (data.category !== undefined) trackUpdates.category = data.category;
        if (data.display_order !== undefined) trackUpdates.display_order = data.display_order;
        if (data.is_active !== undefined) trackUpdates.is_active = data.is_active;

        const { error: updateError } = await supabase
          .from("training_tracks")
          .update(trackUpdates)
          .eq("id", track_id);

        if (updateError) {
          console.error("Error updating track:", updateError);
          return corsErrorResponse("Failed to update track", 500, req);
        }

        // Replace scenarios if provided
        if (data.scenarios) {
          // Delete existing
          await supabase.from("track_scenarios").delete().eq("track_id", track_id);

          // Insert new
          const trackScenarios = data.scenarios.map((s) => ({
            track_id: track_id,
            scenario_id: s.scenario_id,
            position: s.position,
            is_required: s.is_required ?? true,
            skills_introduced: s.skills_introduced || [],
            skills_expected: s.skills_expected || [],
          }));

          const { error: tsError } = await supabase
            .from("track_scenarios")
            .insert(trackScenarios);

          if (tsError) {
            console.error("Error replacing track_scenarios:", tsError);
            return corsErrorResponse("Failed to update scenarios", 500, req);
          }
        }

        return corsJsonResponse({ success: true }, 200, req);
      }

      // ==============================
      // DELETE — soft delete (is_active = false)
      // ==============================
      case "delete": {
        const { track_id } = body as DeleteRequest;
        if (!track_id) {
          return corsErrorResponse("track_id required", 400, req);
        }

        const { error: deleteError } = await supabase
          .from("training_tracks")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", track_id);

        if (deleteError) {
          console.error("Error deleting track:", deleteError);
          return corsErrorResponse("Failed to delete track", 500, req);
        }

        return corsJsonResponse({ success: true }, 200, req);
      }

      // ==============================
      // RECORD-PROGRESS — idempotent upsert of user track progress
      // ==============================
      case "record-progress": {
        const { track_id, scenario_id, session_id, score, weaknesses, spin_stage_reached } =
          body as RecordProgressRequest;

        if (!track_id || !scenario_id || !session_id) {
          return corsErrorResponse("track_id, scenario_id, session_id required", 400, req);
        }

        const accessCodeId = context.access_code_id;
        if (!accessCodeId) {
          return corsErrorResponse("Access code required for progress tracking", 400, req);
        }

        // Get the track_scenario to find position
        const { data: ts } = await supabase
          .from("track_scenarios")
          .select("position")
          .eq("track_id", track_id)
          .eq("scenario_id", scenario_id)
          .single();

        if (!ts) {
          return corsErrorResponse("Scenario not found in track", 404, req);
        }

        // Fetch or create progress record
        const { data: existing } = await supabase
          .from("user_track_progress")
          .select("*")
          .eq("access_code_id", accessCodeId)
          .eq("track_id", track_id)
          .single();

        const completionEntry = {
          scenario_id,
          session_id,
          score: score ?? 0,
          weaknesses: weaknesses || [],
          spin_stage_reached: spin_stage_reached || "unknown",
          completed_at: new Date().toISOString(),
        };

        if (existing) {
          // Update existing: add/replace completion entry
          const completedScenarios = (existing.completed_scenarios as Record<string, unknown>[]) || [];
          // Remove old entry for same scenario (idempotent)
          const filtered = completedScenarios.filter(
            (c: Record<string, unknown>) => c.scenario_id !== scenario_id
          );
          filtered.push(completionEntry);

          // Calculate new current_position (highest completed position)
          const newPosition = Math.max(ts.position, existing.current_position || 0);

          // Check if track is complete
          const { data: totalRequired } = await supabase
            .from("track_scenarios")
            .select("scenario_id")
            .eq("track_id", track_id)
            .eq("is_required", true);

          const requiredIds = new Set((totalRequired || []).map((r: { scenario_id: string }) => r.scenario_id));
          const completedIds = new Set(filtered.map((c: Record<string, unknown>) => c.scenario_id as string));
          const allComplete = [...requiredIds].every((id) => completedIds.has(id));

          const { error: updateError } = await supabase
            .from("user_track_progress")
            .update({
              current_position: newPosition,
              completed_scenarios: filtered,
              completed_at: allComplete ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Error updating progress:", updateError);
            return corsErrorResponse("Failed to update progress", 500, req);
          }
        } else {
          // Create new progress record
          const { error: insertError } = await supabase
            .from("user_track_progress")
            .insert({
              access_code_id: accessCodeId,
              track_id,
              current_position: ts.position,
              completed_scenarios: [completionEntry],
            });

          if (insertError) {
            console.error("Error creating progress:", insertError);
            return corsErrorResponse("Failed to record progress", 500, req);
          }
        }

        return corsJsonResponse({ success: true }, 200, req);
      }

      default:
        return corsErrorResponse(
          `Unknown action: ${action}. Valid: list, get, create, update, delete, record-progress`,
          400,
          req
        );
    }
  } catch (err) {
    console.error("manage-tracks error:", err);
    return corsErrorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      req
    );
  }
});
