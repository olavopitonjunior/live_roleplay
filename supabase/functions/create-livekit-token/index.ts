/**
 * Edge Function: create-livekit-token
 *
 * Generates a LiveKit JWT token for users to join a session room.
 * Also creates the session record in the database.
 * Uses API-based dispatch to assign agent (creates room + dispatches before user joins).
 *
 * Supports dual auth:
 * - Access code (trial users): scenario_id + access_code in body
 * - JWT (enterprise users): scenario_id in body + Authorization: Bearer <jwt>
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
import { authenticate, type AuthContext } from "../_shared/auth.ts";

// Agent name must match the agent registered in the worker
const AGENT_NAME = "roleplay-agent";

// ---------------------------------------------------------------------------
// In-memory rate limiting (resets on cold start — acceptable for Edge Functions)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 5_000; // 5 seconds between requests per identity
const RATE_LIMIT_MAX_ENTRIES = 200;
const _rateLimitMap = new Map<string, number>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const lastRequest = _rateLimitMap.get(key);
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return false; // Rate limited
  }
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
  access_code?: string;       // trial auth
  trial_user_id?: string;     // client-generated UUID for trial users
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
    const body: RequestBody = await req.json();
    const {
      scenario_id,
      access_code,
      trial_user_id,
      session_mode = "training",
      voice_override,
    } = body;

    if (!scenario_id) {
      return corsErrorResponse("Missing scenario_id", 400, req);
    }

    // --- Dual Auth: try JWT first, then access_code ---
    const authResult = await authenticate(req, { body: body as Record<string, unknown> });

    if (!authResult.success) {
      return corsErrorResponse(authResult.error, authResult.status, req);
    }

    const { context: auth, supabase } = authResult;

    // Rate limit by identity
    const rateLimitKey = auth.method === "jwt"
      ? (auth.user_profile_id || auth.auth_user_id || "unknown")
      : (auth.access_code_id || "unknown");

    if (!checkRateLimit(rateLimitKey)) {
      console.warn(`[RATE_LIMIT] Blocked request for ${auth.method} user ${rateLimitKey.substring(0, 8)}***`);
      return corsErrorResponse("Aguarde antes de tentar novamente", 429, req);
    }

    // Validate scenario exists and is active, fetch avatar/voice settings
    const { data: scenarioData, error: scenarioError } = await supabase
      .from("scenarios")
      .select("id, title, simli_face_id, ai_voice, avatar_provider, avatar_id, version, target_duration_seconds, character_gender, org_id")
      .eq("id", scenario_id)
      .eq("is_active", true)
      .single();

    if (scenarioError || !scenarioData) {
      return corsErrorResponse("Invalid or inactive scenario", 404, req);
    }

    // Org isolation: if user has org_id, scenario must be in same org or platform-level (null)
    if (auth.org_id && scenarioData.org_id && scenarioData.org_id !== auth.org_id) {
      return corsErrorResponse("Scenario not available for your organization", 403, req);
    }

    // Determine the org_id for this session
    const sessionOrgId = auth.org_id || scenarioData.org_id || null;

    // Fetch user's difficulty profile
    let difficultyLevel = 3; // Default level
    if (auth.method === "jwt" && auth.user_profile_id) {
      // Enterprise user: look up by user_profile_id
      const { data: profileData } = await supabase
        .from("user_difficulty_profiles")
        .select("current_level, sessions_at_level, consecutive_high_scores, consecutive_low_scores")
        .eq("user_profile_id", auth.user_profile_id)
        .single();

      if (profileData) {
        difficultyLevel = profileData.current_level || 3;
        console.log(`Found difficulty profile (user_profile): level ${difficultyLevel}`);
      } else {
        // Create new profile for enterprise user
        const { error: profileError } = await supabase
          .from("user_difficulty_profiles")
          .insert({
            user_profile_id: auth.user_profile_id,
            org_id: auth.org_id || null,
            current_level: 3,
          });
        if (profileError) console.warn("Could not create difficulty profile:", profileError);
        else console.log("Created new difficulty profile (user_profile) with level 3");
      }
    } else if (auth.access_code_id) {
      // Trial user: look up by access_code_id
      const { data: profileData } = await supabase
        .from("user_difficulty_profiles")
        .select("current_level, sessions_at_level, consecutive_high_scores, consecutive_low_scores")
        .eq("access_code_id", auth.access_code_id)
        .single();

      if (profileData) {
        difficultyLevel = profileData.current_level || 3;
        console.log(`Found difficulty profile (access_code): level ${difficultyLevel}`);
      } else {
        const { error: profileError } = await supabase
          .from("user_difficulty_profiles")
          .insert({
            access_code_id: auth.access_code_id,
            org_id: sessionOrgId,
            current_level: 3,
          });
        if (profileError) console.warn("Could not create difficulty profile:", profileError);
        else console.log("Created new difficulty profile (access_code) with level 3");
      }
    }

    // Generate unique session ID and room name
    const sessionId = crypto.randomUUID();
    const roomName = `roleplay_${sessionId}`;

    // Create session record in database with mode settings, difficulty, and org identity
    const sessionInsert: Record<string, unknown> = {
      id: sessionId,
      scenario_id: scenario_id,
      livekit_room_name: roomName,
      status: "active",
      session_mode: session_mode,
      difficulty_level: difficultyLevel,
      scenario_version: scenarioData.version || 1,
      org_id: sessionOrgId,
    };

    // Set identity fields based on auth method
    if (auth.method === "jwt") {
      sessionInsert.user_profile_id = auth.user_profile_id || null;
    } else {
      sessionInsert.access_code_id = auth.access_code_id;
      sessionInsert.trial_user_id = trial_user_id || null;
    }

    const { error: sessionError } = await supabase.from("sessions").insert(sessionInsert);

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
      session_mode: session_mode,
      difficulty_level: difficultyLevel,
      target_duration_seconds: scenarioData.target_duration_seconds || 180,
      org_id: sessionOrgId,
    });

    console.log(`Session created, room: ${roomName}, agent: ${AGENT_NAME}, mode: ${session_mode}, difficulty: ${difficultyLevel}, auth: ${auth.method}, org: ${sessionOrgId || 'none'}`);

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
                const jobStatus = firstJob?.state?.status;
                const statusMap: Record<string, string> = {
                  "0": "UNKNOWN", "1": "PENDING", "2": "RUNNING", "3": "SUCCESS", "4": "FAILED",
                  "JS_UNKNOWN": "UNKNOWN", "JS_PENDING": "PENDING", "JS_RUNNING": "RUNNING",
                  "JS_SUCCESS": "SUCCESS", "JS_FAILED": "FAILED",
                };
                const statusStr = statusMap[String(jobStatus)] || `raw:${jobStatus}`;
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
    const userIdentity = auth.method === "jwt"
      ? `user_${(auth.user_profile_id || auth.auth_user_id || "unknown").substring(0, 8)}`
      : `user_${(auth.access_code_id || "unknown").substring(0, 8)}`;

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: userIdentity,
      name: "Participant",
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

    // Generate JWT token
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
