/**
 * Edge Function: create-livekit-token
 *
 * Generates a LiveKit JWT token for users to join a session room.
 * Also creates the session record in the database.
 * Uses token-based dispatch to assign agent when user joins.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.15.0";
import { RoomAgentDispatch, RoomConfiguration } from "https://esm.sh/@livekit/protocol";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

// Agent name must match the agent registered in the worker
const AGENT_NAME = "roleplay-agent";

type SessionMode = "training" | "evaluation";
type CoachIntensity = "low" | "medium" | "high";

interface RequestBody {
  scenario_id: string;
  access_code: string;
  session_mode?: SessionMode;
  coach_intensity?: CoachIntensity;
}

interface TokenResponse {
  token: string;
  room_name: string;
  session_id: string;
  difficulty_level: number;
}

interface DifficultyProfile {
  current_level: number;
  sessions_at_level: number;
  consecutive_high_scores: number;
  consecutive_low_scores: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Parse request body
    const {
      scenario_id,
      access_code,
      session_mode = "training",
      coach_intensity = "medium",
    }: RequestBody = await req.json();

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

    // Fetch user's difficulty profile
    let difficultyLevel = 3; // Default level
    const { data: profileData } = await supabase
      .from("user_difficulty_profiles")
      .select("current_level, sessions_at_level, consecutive_high_scores, consecutive_low_scores")
      .eq("access_code_id", codeData.id)
      .single();

    if (profileData) {
      difficultyLevel = profileData.current_level || 3;
      console.log(`Found existing difficulty profile: level ${difficultyLevel}`);
    } else {
      // Create new profile with default level 3
      const { error: profileError } = await supabase
        .from("user_difficulty_profiles")
        .insert({
          access_code_id: codeData.id,
          current_level: 3,
        });

      if (profileError) {
        console.warn("Could not create difficulty profile:", profileError);
      } else {
        console.log("Created new difficulty profile with level 3");
      }
    }

    // Generate unique session ID and room name
    const sessionId = crypto.randomUUID();
    const roomName = `roleplay_${sessionId}`;

    // Create session record in database with mode settings and difficulty
    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionId,
      access_code_id: codeData.id,
      scenario_id: scenario_id,
      livekit_room_name: roomName,
      status: "active",
      session_mode: session_mode,
      coach_intensity: coach_intensity,
      difficulty_level: difficultyLevel,
    });

    if (sessionError) {
      console.error("Failed to create session:", sessionError);
      return corsErrorResponse("Failed to create session", 500, req);
    }

    // Get LiveKit credentials from environment
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!livekitApiKey || !livekitApiSecret) {
      console.error("LiveKit credentials not configured");
      return corsErrorResponse("LiveKit not configured", 500, req);
    }

    // Prepare metadata for agent (passed via room metadata, not dispatch)
    const agentMetadata = JSON.stringify({
      scenario_id: scenario_id,
      session_id: sessionId,
      simli_face_id: scenarioData.simli_face_id || null,
      gemini_voice: scenarioData.gemini_voice || "Puck",
      avatar_provider: scenarioData.avatar_provider || null,
      avatar_id: scenarioData.avatar_id || null,
      // PRD 08: Session mode and coach intensity
      session_mode: session_mode,
      coach_intensity: coach_intensity,
      // Difficulty level for adaptive difficulty
      difficulty_level: difficultyLevel,
    });

    console.log(`Session created, room: ${roomName}, agent: ${AGENT_NAME}, mode: ${session_mode}, intensity: ${coach_intensity}, difficulty: ${difficultyLevel}`);

    // Create LiveKit access token for the user with agent dispatch
    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `user_${codeData.id.substring(0, 8)}`,
      name: "Participant",
      // Include metadata for the agent to read from participant
      metadata: agentMetadata,
    });

    // Grant permissions for the room
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Configure token-based agent dispatch using proper LiveKit classes
    // This automatically dispatches the named agent when user joins
    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: AGENT_NAME,
          // Note: metadata in dispatch may cause issues per GitHub #3898
          // The agent can read metadata from participant instead
        }),
      ],
    });

    // Generate JWT token
    const token = await at.toJwt();

    // Return token and session info
    const response: TokenResponse = {
      token,
      room_name: roomName,
      session_id: sessionId,
      difficulty_level: difficultyLevel,
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
