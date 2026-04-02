/**
 * Edge Function: manage-scenario
 *
 * Admin-only endpoint for managing scenarios (CRUD operations).
 * Supports dual auth: access_code (admin role) or JWT (admin+ role).
 * Supports structured scenario fields and versioning on update.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { authenticate, type AuthContext } from "../_shared/auth.ts";

// Request types
interface Objection {
  id: string;
  description: string;
}

interface EvaluationCriterion {
  id: string;
  description: string;
}

type AiVoice = "echo" | "ash" | "sage" | "shimmer" | "coral";
type CharacterGender = "male" | "female";
const FEMALE_VOICES: AiVoice[] = ["shimmer", "coral"];
const MALE_VOICES: AiVoice[] = ["echo", "ash", "sage"];

interface ScenarioData {
  title: string;
  category?: string | null;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome?: string | null;
  simli_face_id?: string | null;
  ai_voice?: string | null;
  character_gender?: CharacterGender | null;
  avatar_provider?: string | null;
  avatar_id?: string | null;
  is_active: boolean;

  // Structured scenario fields (all optional)
  session_type?: string | null;
  market_context?: string | null;
  user_objective?: string | null;
  target_duration_seconds?: number | null;
  opening_line?: string | null;
  success_condition?: string | null;
  end_condition?: string | null;

  // Character fields
  character_name?: string | null;
  character_role?: string | null;
  personality?: string | null;
  hidden_objective?: string | null;
  initial_emotion?: string | null;
  emotional_reactivity?: string | null;
  communication_style?: string | null;
  typical_phrases?: string[] | null;
  knowledge_limits?: string | null;
  backstory?: string | null;

  // Evaluation fields
  criteria_weights?: Record<string, number> | null;
  positive_indicators?: string[] | null;
  negative_indicators?: string[] | null;

  // Flow fields
  phase_flow?: Record<string, unknown>[] | null;
  difficulty_escalation?: Record<string, unknown> | null;
}

interface CreateRequest {
  action: "create";
  access_code?: string;  // legacy trial auth
  data: ScenarioData;
}

interface UpdateRequest {
  action: "update";
  access_code?: string;  // legacy trial auth
  scenario_id: string;
  data: Partial<ScenarioData>;
}

interface DeleteRequest {
  action: "delete";
  access_code?: string;  // legacy trial auth
  scenario_id: string;
}

type RequestBody = CreateRequest | UpdateRequest | DeleteRequest;

/** All structured fields that are optional and passed through without validation */
const STRUCTURED_FIELDS = [
  "session_type",
  "market_context",
  "user_objective",
  "target_duration_seconds",
  "opening_line",
  "success_condition",
  "end_condition",
  "character_gender",
  "character_name",
  "character_role",
  "personality",
  "hidden_objective",
  "initial_emotion",
  "emotional_reactivity",
  "communication_style",
  "typical_phrases",
  "knowledge_limits",
  "backstory",
  "criteria_weights",
  "positive_indicators",
  "negative_indicators",
  "phase_flow",
  "difficulty_escalation",
  "presentation_config",
] as const;

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body: RequestBody = await req.json();

    // --- Dual Auth: JWT (admin+ role) or access_code (admin role) ---
    const authResult = await authenticate(req, {
      body: body as Record<string, unknown>,
      requireAdmin: true,     // access_code must be admin
      requiredRole: "admin",  // JWT must be admin or higher
    });

    if (!authResult.success) {
      return corsErrorResponse(authResult.error, authResult.status, req);
    }

    const { context: auth, supabase } = authResult;

    // Route to appropriate handler
    switch (body.action) {
      case "create":
        return await handleCreate(supabase, body, auth, req);
      case "update":
        return await handleUpdate(supabase, body, auth, req);
      case "delete":
        return await handleDelete(supabase, body, auth, req);
      default:
        return corsErrorResponse("Invalid action", 400, req);
    }
  } catch (error) {
    console.error("Error in manage-scenario:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});

/**
 * Extract structured fields from data payload.
 * Returns an object with only the structured fields that are present (not undefined).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStructuredFields(data: Partial<ScenarioData>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {};
  for (const field of STRUCTURED_FIELDS) {
    if (data[field] !== undefined) {
      fields[field] = data[field] ?? null;
    }
  }
  return fields;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCreate(supabase: any, body: CreateRequest, auth: AuthContext, req: Request) {
  const { data } = body;

  // Validate required fields
  if (!data.title?.trim()) {
    return corsErrorResponse("Title is required", 400, req);
  }
  if (!data.context?.trim()) {
    return corsErrorResponse("Context is required", 400, req);
  }
  if (!data.avatar_profile?.trim()) {
    return corsErrorResponse("Avatar profile is required", 400, req);
  }
  if (!data.objections || data.objections.length === 0) {
    return corsErrorResponse("At least one objection is required", 400, req);
  }
  if (!data.evaluation_criteria || data.evaluation_criteria.length === 0) {
    return corsErrorResponse(
      "At least one evaluation criterion is required",
      400,
      req
    );
  }

  // Filter out empty objections and criteria
  const cleanedObjections = data.objections.filter(
    (o) => o.description?.trim()
  );
  const cleanedCriteria = data.evaluation_criteria.filter(
    (c) => c.description?.trim()
  );

  if (cleanedObjections.length === 0) {
    return corsErrorResponse(
      "At least one objection with description is required",
      400,
      req
    );
  }
  if (cleanedCriteria.length === 0) {
    return corsErrorResponse(
      "At least one criterion with description is required",
      400,
      req
    );
  }

  // Validate voice-gender consistency
  if (data.character_gender && data.ai_voice) {
    const allowed = data.character_gender === "female" ? FEMALE_VOICES : MALE_VOICES;
    if (!allowed.includes(data.ai_voice as AiVoice)) {
      return corsErrorResponse(
        `Voice "${data.ai_voice}" is incompatible with gender "${data.character_gender}". ` +
        `Allowed voices: ${allowed.join(", ")}`,
        400,
        req
      );
    }
  }

  // Build insert payload with structured fields + org context
  const insertPayload: Record<string, unknown> = {
    title: data.title.trim(),
    category: data.category?.trim() || null,
    context: data.context.trim(),
    avatar_profile: data.avatar_profile.trim(),
    objections: cleanedObjections,
    evaluation_criteria: cleanedCriteria,
    ideal_outcome: data.ideal_outcome?.trim() || null,
    simli_face_id: data.simli_face_id?.trim() || null,
    ai_voice: data.ai_voice || null,
    avatar_provider: data.avatar_provider || null,
    avatar_id: data.avatar_id?.trim() || null,
    is_active: data.is_active ?? true,
    ...extractStructuredFields(data),
    // Multi-tenant: omit org_id/created_by until migrations applied
    // org_id: auth.org_id || null,
    // created_by: auth.user_profile_id || null,
  };

  const { data: scenario, error } = await supabase
    .from("scenarios")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Failed to create scenario:", error);
    return corsErrorResponse("Failed to create scenario", 500, req);
  }

  return corsJsonResponse(
    { success: true, scenario },
    201,
    req
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUpdate(supabase: any, body: UpdateRequest, auth: AuthContext, req: Request) {
  const { scenario_id, data } = body;

  if (!scenario_id) {
    return corsErrorResponse("scenario_id is required", 400, req);
  }

  // Fetch FULL current scenario for versioning
  const { data: existing, error: existError } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", scenario_id)
    .single();

  if (existError || !existing) {
    return corsErrorResponse("Scenario not found", 404, req);
  }

  // --- Versioning: snapshot current state before update ---
  const currentVersion = existing.version ?? 1;

  const { error: versionError } = await supabase
    .from("scenario_versions")
    .insert({
      scenario_id: scenario_id,
      version: currentVersion,
      snapshot: existing,
    });

  if (versionError) {
    console.error("Failed to save scenario version:", versionError);
    // Non-fatal: log but continue with the update
  }

  // Build update object with only provided fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (data.title !== undefined) {
    updates.title = data.title.trim();
  }
  if (data.category !== undefined) {
    updates.category = data.category?.trim() || null;
  }
  if (data.context !== undefined) {
    updates.context = data.context.trim();
  }
  if (data.avatar_profile !== undefined) {
    updates.avatar_profile = data.avatar_profile.trim();
  }
  if (data.objections !== undefined) {
    const cleaned = data.objections.filter((o) => o.description?.trim());
    if (cleaned.length === 0) {
      return corsErrorResponse(
        "At least one objection with description is required",
        400,
        req
      );
    }
    updates.objections = cleaned;
  }
  if (data.evaluation_criteria !== undefined) {
    const cleaned = data.evaluation_criteria.filter(
      (c) => c.description?.trim()
    );
    if (cleaned.length === 0) {
      return corsErrorResponse(
        "At least one criterion with description is required",
        400,
        req
      );
    }
    updates.evaluation_criteria = cleaned;
  }
  if (data.ideal_outcome !== undefined) {
    updates.ideal_outcome = data.ideal_outcome?.trim() || null;
  }
  if (data.simli_face_id !== undefined) {
    updates.simli_face_id = data.simli_face_id?.trim() || null;
  }
  if (data.ai_voice !== undefined) {
    updates.ai_voice = data.ai_voice || null;
  }
  if (data.avatar_provider !== undefined) {
    updates.avatar_provider = data.avatar_provider || null;
  }
  if (data.avatar_id !== undefined) {
    updates.avatar_id = data.avatar_id?.trim() || null;
  }
  if (data.is_active !== undefined) {
    updates.is_active = data.is_active;
  }

  // Apply structured fields
  const structuredUpdates = extractStructuredFields(data);
  Object.assign(updates, structuredUpdates);

  // Validate voice-gender consistency (use updated or existing values)
  const finalGender = (updates.character_gender ?? existing.character_gender) as CharacterGender | null;
  const finalVoice = (updates.ai_voice ?? existing.ai_voice) as AiVoice | null;
  if (finalGender && finalVoice) {
    const allowed = finalGender === "female" ? FEMALE_VOICES : MALE_VOICES;
    if (!allowed.includes(finalVoice)) {
      return corsErrorResponse(
        `Voice "${finalVoice}" is incompatible with gender "${finalGender}". ` +
        `Allowed voices: ${allowed.join(", ")}`,
        400,
        req
      );
    }
  }

  // Increment version and add updated_at timestamp
  updates.version = currentVersion + 1;
  updates.updated_at = new Date().toISOString();

  const { data: scenario, error } = await supabase
    .from("scenarios")
    .update(updates)
    .eq("id", scenario_id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update scenario:", error);
    return corsErrorResponse("Failed to update scenario", 500, req);
  }

  return corsJsonResponse(
    { success: true, scenario },
    200,
    req
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDelete(supabase: any, body: DeleteRequest, auth: AuthContext, req: Request) {
  const { scenario_id } = body;

  if (!scenario_id) {
    return corsErrorResponse("scenario_id is required", 400, req);
  }

  // Soft delete by setting is_active to false
  const { data: scenario, error } = await supabase
    .from("scenarios")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", scenario_id)
    .select()
    .single();

  if (error) {
    console.error("Failed to delete scenario:", error);
    return corsErrorResponse("Failed to delete scenario", 500, req);
  }

  return corsJsonResponse(
    { success: true, scenario },
    200,
    req
  );
}
