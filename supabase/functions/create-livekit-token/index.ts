/**
 * Edge Function: create-livekit-token
 *
 * Generates a LiveKit JWT token for users to join a session room.
 * Also creates the session record in the database.
 * Uses API-based dispatch to assign agent (creates room + dispatches before user joins).
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2.15.0";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

// Agent name must match the agent registered in the worker
const AGENT_NAME = "roleplay-agent";

// ---------------------------------------------------------------------------
// In-memory rate limiting (resets on cold start — acceptable for Edge Functions)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 5_000; // 5 seconds between requests per access code
const RATE_LIMIT_MAX_ENTRIES = 200;
const _rateLimitMap = new Map<string, number>(); // access_code -> last request timestamp

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const lastRequest = _rateLimitMap.get(key);
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return false; // Rate limited
  }
  // Evict oldest entry if at capacity (Map preserves insertion order)
  if (_rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
    const oldest = _rateLimitMap.keys().next().value;
    if (oldest !== undefined) _rateLimitMap.delete(oldest);
  }
  _rateLimitMap.set(key, now);
  return true;
}

type SessionMode = "training" | "evaluation";

type AiVoice = "echo" | "ash" | "sage" | "shimmer" | "coral";
const FEMALE_VOICES: AiVoice[] = ["shimmer", "coral"];
const MALE_VOICES: AiVoice[] = ["echo", "ash", "sage"];

interface RequestBody {
  scenario_id: string;
  access_code: string;
  session_mode?: SessionMode;
  voice_override?: AiVoice;
}

interface TokenResponse {
  token: string;
  room_name: string;
  session_id: string;
  difficulty_level: number;
  dispatch_status?: {
    livekit_url_set: boolean;
    room_created: boolean;
    room_http_status: number;
    room_error?: string;
    agent_dispatched: boolean;
    dispatch_http_status: number;
    dispatch_error?: string;
    dispatch_id?: string;
    dispatch_state?: {
      jobs_count: number;
      agent_accepted: boolean;
      first_job_id: string | null;
      first_job_status: string | null;
    };
  };
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
      voice_override,
    }: RequestBody = await req.json();

    if (!scenario_id || !access_code) {
      return corsErrorResponse("Missing scenario_id or access_code", 400, req);
    }

    // Rate limit: 1 request per 5 seconds per access code
    if (!checkRateLimit(access_code.toUpperCase())) {
      console.warn(`[RATE_LIMIT] Blocked request for code ${access_code.substring(0, 4)}***`);
      return corsErrorResponse("Aguarde antes de tentar novamente", 429, req);
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
      .select("id, title, simli_face_id, ai_voice, avatar_provider, avatar_id, version, target_duration_seconds, character_gender")
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
      difficulty_level: difficultyLevel,
      scenario_version: scenarioData.version || 1,
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

    // Validate voice_override matches character gender
    let effectiveVoice = scenarioData.ai_voice || "echo";
    if (voice_override) {
      const gender = scenarioData.character_gender || "male";
      const allowed = gender === "female" ? FEMALE_VOICES : MALE_VOICES;
      if (allowed.includes(voice_override)) {
        effectiveVoice = voice_override;
        console.log(`[VOICE] Override accepted: ${voice_override} for gender ${gender}`);
      } else {
        console.warn(`[VOICE] Override rejected: ${voice_override} incompatible with gender ${gender}`);
      }
    }

    // Prepare metadata for agent (passed via room metadata, not dispatch)
    const agentMetadata = JSON.stringify({
      scenario_id: scenario_id,
      session_id: sessionId,
      simli_face_id: scenarioData.simli_face_id || null,
      ai_voice: effectiveVoice,
      avatar_provider: scenarioData.avatar_provider || null,
      avatar_id: scenarioData.avatar_id || null,
      // PRD 08: Session mode
      session_mode: session_mode,
      // Difficulty level for adaptive difficulty
      difficulty_level: difficultyLevel,
      // AGENTS-EVOLUTION: Target duration for agent timer
      target_duration_seconds: scenarioData.target_duration_seconds || 180,
    });

    console.log(`Session created, room: ${roomName}, agent: ${AGENT_NAME}, mode: ${session_mode}, difficulty: ${difficultyLevel}`);

    // --- API-based agent dispatch ---
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    let dispatchResult: TokenResponse["dispatch_status"] = {
      livekit_url_set: !!livekitUrl,
      room_created: false,
      room_http_status: 0,
      agent_dispatched: false,
      dispatch_http_status: 0,
    };

    if (livekitUrl) {
      const livekitHost = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
      console.log(`[DISPATCH] LIVEKIT_URL=${livekitUrl}, host=${livekitHost}`);

      // Generate admin token for API calls
      const adminAt = new AccessToken(livekitApiKey, livekitApiSecret);
      adminAt.addGrant({
        roomCreate: true,
        roomAdmin: true,
        agent: true,
        room: roomName,
      });
      const adminToken = await adminAt.toJwt();
      console.log(`[DISPATCH] Admin token generated, length=${adminToken.length}`);

      try {
        // 1. Create room with metadata so agent can read scenario info
        const createRoomUrl = `${livekitHost}/twirp/livekit.RoomService/CreateRoom`;
        console.log(`[DISPATCH] Creating room: POST ${createRoomUrl}`);
        const createRoomResp = await fetch(createRoomUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: roomName,
            empty_timeout: 300,
            max_participants: 5,
            metadata: agentMetadata,
          }),
        });

        dispatchResult.room_http_status = createRoomResp.status;
        if (createRoomResp.ok) {
          dispatchResult.room_created = true;
          console.log(`[DISPATCH] Room created OK: ${roomName}`);
        } else {
          const errBody = await createRoomResp.text();
          dispatchResult.room_error = errBody.substring(0, 200);
          console.error(`[DISPATCH] Room creation FAILED: ${createRoomResp.status} ${errBody}`);
        }

        // 2. Dispatch agent to the room
        const dispatchUrl = `${livekitHost}/twirp/livekit.AgentDispatchService/CreateDispatch`;
        console.log(`[DISPATCH] Dispatching agent: POST ${dispatchUrl}`);
        const dispatchResp = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            room: roomName,
            agent_name: AGENT_NAME,
            metadata: agentMetadata,
          }),
        });

        dispatchResult.dispatch_http_status = dispatchResp.status;
        if (dispatchResp.ok) {
          const dispatchData = await dispatchResp.json();
          dispatchResult.agent_dispatched = true;
          dispatchResult.dispatch_id = dispatchData.id || "unknown";
          console.log(`[DISPATCH] Agent dispatched OK: ${roomName}, dispatch_id=${dispatchResult.dispatch_id}`);
        } else {
          const errBody = await dispatchResp.text();
          dispatchResult.dispatch_error = errBody.substring(0, 200);
          console.error(`[DISPATCH] Agent dispatch FAILED: ${dispatchResp.status} ${errBody}`);
        }
        // 3. Verify dispatch was picked up by agent (wait briefly for acceptance)
        if (dispatchResult.agent_dispatched && dispatchResult.dispatch_id) {
          await new Promise(r => setTimeout(r, 2000)); // Wait 2s for agent to accept

          const listUrl = `${livekitHost}/twirp/livekit.AgentDispatchService/ListDispatch`;
          console.log(`[DISPATCH] Checking dispatch state: POST ${listUrl}`);
          try {
            const listResp = await fetch(listUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${adminToken}`,
              },
              body: JSON.stringify({
                room: roomName,
                dispatch_id: dispatchResult.dispatch_id,
              }),
            });
            if (listResp.ok) {
              const listData = await listResp.json();
              console.log(`[DISPATCH] ListDispatch raw response:`, JSON.stringify(listData));
              const dispatches = listData.agentDispatches || listData.agent_dispatches || [];
              const targetDispatch = dispatches[0];
              if (targetDispatch?.state) {
                const jobs = targetDispatch.state.jobs || [];
                const firstJob = jobs[0];
                // Job status: JS_PENDING=1, JS_RUNNING=2, JS_SUCCESS=3, JS_FAILED=4
                const jobStatus = firstJob?.state?.status;
                const statusMap: Record<string, string> = {
                  "0": "UNKNOWN", "1": "PENDING", "2": "RUNNING", "3": "SUCCESS", "4": "FAILED",
                  "JS_UNKNOWN": "UNKNOWN", "JS_PENDING": "PENDING", "JS_RUNNING": "RUNNING",
                  "JS_SUCCESS": "SUCCESS", "JS_FAILED": "FAILED",
                };
                const statusStr = statusMap[String(jobStatus)] || `raw:${jobStatus}`;
                // agent_accepted = job is RUNNING or SUCCESS (handles both numeric and string enum formats)
                const accepted = statusStr === "RUNNING" || statusStr === "SUCCESS";
                dispatchResult.dispatch_state = {
                  jobs_count: jobs.length,
                  agent_accepted: accepted,
                  first_job_id: firstJob?.id || null,
                  first_job_status: jobs.length > 0 ? statusStr : null,
                };
                console.log(`[DISPATCH] Dispatch state: jobs=${jobs.length}, status=${statusStr}, accepted=${accepted}`);
              } else {
                console.warn(`[DISPATCH] No state in dispatch response, dispatches count: ${dispatches.length}`);
                dispatchResult.dispatch_state = {
                  jobs_count: -1,
                  agent_accepted: false,
                  first_job_id: null,
                  first_job_status: null,
                };
              }
            } else {
              const errBody = await listResp.text();
              console.error(`[DISPATCH] ListDispatch FAILED: ${listResp.status} ${errBody}`);
            }
          } catch (listErr) {
            console.warn(`[DISPATCH] ListDispatch check failed:`, listErr);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        dispatchResult.dispatch_error = `Exception: ${errMsg.substring(0, 200)}`;
        console.error(`[DISPATCH] Exception:`, err);
      }
    } else {
      console.warn("[DISPATCH] LIVEKIT_URL not set — dispatch unavailable");
    }

    // --- Generate user access token ---
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
      canUpdateOwnMetadata: true,
    });

    // Generate JWT token (no roomConfig — dispatch is handled via API above)
    const token = await at.toJwt();

    // Return token and session info (includes dispatch diagnostics)
    const response: TokenResponse = {
      token,
      room_name: roomName,
      session_id: sessionId,
      difficulty_level: difficultyLevel,
      dispatch_status: dispatchResult,
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
