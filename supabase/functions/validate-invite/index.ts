/**
 * Edge Function: validate-invite
 *
 * Validates an invite token and returns invite details.
 * Does NOT accept the invite — that happens via auth trigger on signup.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";

serve(async (req: Request) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== "POST") {
    return corsErrorResponse("Method not allowed", 405, req);
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return corsJsonResponse({ valid: false, error: "Missing token" }, req);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hash the token to look up (tokens stored as sha256)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Find the invite
    const { data: invite, error } = await supabase
      .from("user_invites")
      .select("id, org_id, email, role, team_id, status, expires_at, organizations(name)")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !invite) {
      return corsJsonResponse({ valid: false, error: "Convite nao encontrado" }, req);
    }

    if (invite.status !== "pending") {
      return corsJsonResponse({
        valid: false,
        error: invite.status === "accepted"
          ? "Este convite ja foi aceito"
          : "Este convite foi revogado ou expirou",
      }, req);
    }

    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("user_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return corsJsonResponse({ valid: false, error: "Este convite expirou" }, req);
    }

    return corsJsonResponse(
      {
        valid: true,
        email: invite.email,
        role: invite.role,
        org_name: (invite as any).organizations?.name || "Organizacao",
        org_id: invite.org_id,
      },
      req
    );
  } catch (err) {
    console.error("validate-invite error:", err);
    return corsErrorResponse((err as Error).message || "Internal error", 500, req);
  }
});
