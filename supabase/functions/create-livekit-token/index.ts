/**
 * Edge Function: create-livekit-token
 *
 * Generates a LiveKit JWT token for users to join a session room.
 * Also creates the session record in the database.
 * Explicitly dispatches the agent to the room.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AccessToken, AgentDispatchClient } from "https://esm.sh/livekit-server-sdk@2.9.1";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

interface RequestBody {
  scenario_id: string;
  access_code: string;
}

interface TokenResponse {
  token: string;
  room_name: string;
  session_id: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Parse request body
    const { scenario_id, access_code }: RequestBody = await req.json();

    if (!scenario_id || !access_code) {
      return corsErrorResponse("Missing scenario_id or access_code", 400, req);
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access code
    const { data: codeData, error: codeError } = await supabase
      .from("access_codes")
      .select("id, role")
      .eq("code", access_code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (codeError || !codeData) {
      return corsErrorResponse("Invalid or inactive access code", 401, req);
    }

    // Validate scenario exists and is active, fetch avatar/voice settings
    const { data: scenarioData, error: scenarioError } = await supabase
      .from("scenarios")
      .select("id, title, simli_face_id, gemini_voice, avatar_provider, avatar_id")
      .eq("id", scenario_id)
      .eq("is_active", true)
      .single();

    if (scenarioError || !scenarioData) {
      return corsErrorResponse("Invalid or inactive scenario", 404, req);
    }

    // Generate unique session ID and room name
    const sessionId = crypto.randomUUID();
    const roomName = `roleplay_${sessionId}`;

    // Create session record in database
    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionId,
      access_code_id: codeData.id,
      scenario_id: scenario_id,
      livekit_room_name: roomName,
      status: "active",
    });

    if (sessionError) {
      console.error("Failed to create session:", sessionError);
      return corsErrorResponse("Failed to create session", 500, req);
    }

    // Get LiveKit credentials from environment
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      console.error("LiveKit credentials not configured");
      return corsErrorResponse("LiveKit not configured", 500, req);
    }

    // Prepare metadata for agent dispatch
    const agentMetadata = JSON.stringify({
      scenario_id: scenario_id,
      session_id: sessionId,
      simli_face_id: scenarioData.simli_face_id || null,
      gemini_voice: scenarioData.gemini_voice || "Puck",
      avatar_provider: scenarioData.avatar_provider || null,
      avatar_id: scenarioData.avatar_id || null,
    });

    // Explicitly dispatch agent to the room
    // This ensures the agent is ready when the user joins
    try {
      const dispatchClient = new AgentDispatchClient(
        livekitUrl,
        livekitApiKey,
        livekitApiSecret
      );

      // Dispatch agent with empty name (accepts any agent) and metadata
      await dispatchClient.createDispatch(roomName, "", {
        metadata: agentMetadata,
      });
      console.log(`Agent dispatched to room: ${roomName}`);
    } catch (dispatchError) {
      console.error("Failed to dispatch agent:", dispatchError);
      // Continue anyway - agent might still connect via auto-dispatch
    }

    // Create LiveKit access token for the user
    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `user_${codeData.id.substring(0, 8)}`,
      name: "Participant",
    });

    // Grant permissions for the room
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Generate JWT token
    const token = await at.toJwt();

    // Return token and session info
    const response: TokenResponse = {
      token,
      room_name: roomName,
      session_id: sessionId,
    };

    return corsJsonResponse(response, 200, req);
  } catch (error) {
    console.error("Error in create-livekit-token:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});
