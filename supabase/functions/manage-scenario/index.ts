/**
 * Edge Function: manage-scenario
 *
 * Admin-only endpoint for managing scenarios (CRUD operations).
 * Validates admin access code before allowing modifications.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

// Request types
interface Objection {
  id: string;
  description: string;
}

interface EvaluationCriterion {
  id: string;
  description: string;
}

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
  avatar_provider?: string | null;
  avatar_id?: string | null;
  is_active: boolean;
}

interface CreateRequest {
  action: "create";
  access_code: string;
  data: ScenarioData;
}

interface UpdateRequest {
  action: "update";
  access_code: string;
  scenario_id: string;
  data: Partial<ScenarioData>;
}

interface DeleteRequest {
  action: "delete";
  access_code: string;
  scenario_id: string;
}

type RequestBody = CreateRequest | UpdateRequest | DeleteRequest;

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body: RequestBody = await req.json();

    if (!body.access_code) {
      return corsErrorResponse("Missing access_code", 400, req);
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access code is admin
    const { data: codeData, error: codeError } = await supabase
      .from("access_codes")
      .select("id, role")
      .eq("code", body.access_code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (codeError || !codeData) {
      return corsErrorResponse("Invalid or inactive access code", 401, req);
    }

    if (codeData.role !== "admin") {
      return corsErrorResponse("Admin access required", 403, req);
    }

    // Route to appropriate handler
    switch (body.action) {
      case "create":
        return await handleCreate(supabase, body, req);
      case "update":
        return await handleUpdate(supabase, body, req);
      case "delete":
        return await handleDelete(supabase, body, req);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCreate(supabase: any, body: CreateRequest, req: Request) {
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

  const { data: scenario, error } = await supabase
    .from("scenarios")
    .insert({
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
    })
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
async function handleUpdate(supabase: any, body: UpdateRequest, req: Request) {
  const { scenario_id, data } = body;

  if (!scenario_id) {
    return corsErrorResponse("scenario_id is required", 400, req);
  }

  // Check scenario exists
  const { data: existing, error: existError } = await supabase
    .from("scenarios")
    .select("id")
    .eq("id", scenario_id)
    .single();

  if (existError || !existing) {
    return corsErrorResponse("Scenario not found", 404, req);
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

  // Add updated_at timestamp
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
async function handleDelete(supabase: any, body: DeleteRequest, req: Request) {
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
