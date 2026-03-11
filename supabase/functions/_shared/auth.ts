/**
 * Shared Auth Module — Dual Authentication (Phase 2)
 *
 * Supports TWO auth methods:
 * 1. Access Code (trial users): via request body `access_code` or header `x-access-code`
 * 2. JWT (enterprise users): via Supabase Auth `Authorization: Bearer <jwt>`
 *
 * Both methods return an AuthContext with org_id and role information.
 * Edge Functions use this to scope all database operations to the correct org.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================
// Types
// ============================================

export interface AuthContext {
  /** Auth method used */
  method: "access_code" | "jwt";

  /** Access code ID (if method = access_code) */
  access_code_id?: string;
  /** Access code role: 'admin' | 'user' (if method = access_code) */
  access_code_role?: string;

  /** User profile ID (if method = jwt, or after upgrade) */
  user_profile_id?: string;
  /** Org ID from JWT claims or access_code.org_id */
  org_id?: string;
  /** User role from JWT claims: owner, admin, manager, trainer, trainee */
  user_role?: string;

  /** Auth user ID from Supabase Auth (if method = jwt) */
  auth_user_id?: string;

  /** Trial user ID (client-generated, for shared access codes) */
  trial_user_id?: string;
}

export interface AuthResult {
  success: true;
  context: AuthContext;
  supabase: SupabaseClient;
}

export interface AuthError {
  success: false;
  error: string;
  status: number;
}

export type AuthOutcome = AuthResult | AuthError;

// ============================================
// Role hierarchy for permission checks
// ============================================

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  trainer: 20,
  trainee: 10,
};

/**
 * Check if a role meets the minimum required level.
 * @example hasMinRole('admin', 'manager') // true (admin >= manager)
 * @example hasMinRole('trainee', 'admin') // false
 */
export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

// ============================================
// Main auth function
// ============================================

/**
 * Authenticate a request using either access code or JWT.
 *
 * Priority: JWT (Authorization header) > access_code (body/header)
 *
 * @param req - The incoming request
 * @param options - Optional: requireAdmin (access_code must be admin), requiredRole (JWT role minimum)
 * @returns AuthOutcome with context or error
 */
export async function authenticate(
  req: Request,
  options: {
    /** Require admin role for access_code auth */
    requireAdmin?: boolean;
    /** Minimum role for JWT auth (e.g., 'manager') */
    requiredRole?: string;
    /** Pre-parsed request body (to avoid double-parsing) */
    body?: Record<string, unknown>;
  } = {}
): Promise<AuthOutcome> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --- Try JWT first (Authorization: Bearer <token>) ---
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");

    // Use Supabase Auth to verify the JWT
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return { success: false, error: "Invalid or expired JWT", status: 401 };
    }

    // Extract custom claims from JWT (injected by custom_access_token_hook)
    // These are in the user's app_metadata or directly decoded from JWT
    const jwt = decodeJwtPayload(token);
    const org_id = jwt?.org_id || null;
    const user_role = jwt?.user_role || null;
    const profile_id = jwt?.profile_id || null;

    // If no org_id in JWT, look up user_profile
    let resolvedOrgId = org_id;
    let resolvedRole = user_role;
    let resolvedProfileId = profile_id;

    if (!resolvedOrgId || !resolvedRole || !resolvedProfileId) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, org_id, role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();

      if (profile) {
        resolvedOrgId = resolvedOrgId || profile.org_id;
        resolvedRole = resolvedRole || profile.role;
        resolvedProfileId = resolvedProfileId || profile.id;
      }
    }

    // Check role requirement
    if (options.requiredRole && resolvedRole) {
      if (!hasMinRole(resolvedRole, options.requiredRole)) {
        return {
          success: false,
          error: `Requires ${options.requiredRole} role or higher`,
          status: 403,
        };
      }
    }

    return {
      success: true,
      context: {
        method: "jwt",
        auth_user_id: user.id,
        user_profile_id: resolvedProfileId || undefined,
        org_id: resolvedOrgId || undefined,
        user_role: resolvedRole || undefined,
      },
      supabase,
    };
  }

  // --- Fallback: Access Code (body or header) ---
  const accessCodeFromHeader = req.headers.get("x-access-code");
  const accessCodeFromBody = options.body?.access_code as string | undefined;
  const accessCode = accessCodeFromHeader || accessCodeFromBody;

  if (!accessCode) {
    return {
      success: false,
      error: "Authentication required — provide access_code or JWT",
      status: 401,
    };
  }

  // Validate access code
  const { data: codeData, error: codeError } = await supabase
    .from("access_codes")
    .select("id, role, org_id")
    .eq("code", accessCode.toUpperCase())
    .eq("is_active", true)
    .single();

  if (codeError || !codeData) {
    return { success: false, error: "Invalid or inactive access code", status: 401 };
  }

  // Check admin requirement
  if (options.requireAdmin && codeData.role !== "admin") {
    return { success: false, error: "Admin access required", status: 403 };
  }

  return {
    success: true,
    context: {
      method: "access_code",
      access_code_id: codeData.id,
      access_code_role: codeData.role,
      org_id: codeData.org_id || undefined,
    },
    supabase,
  };
}

// ============================================
// JWT helper
// ============================================

/**
 * Decode JWT payload without verification (verification done by Supabase Auth).
 * Only used to read custom claims (org_id, user_role, profile_id).
 */
function decodeJwtPayload(token: string): Record<string, string> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}
