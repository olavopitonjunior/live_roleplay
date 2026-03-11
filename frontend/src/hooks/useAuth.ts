import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AccessCode, AuthState, UserProfile, Organization, TenantRole } from '../types';
import { hasMinRole } from '../types';

const ACCESS_CODE_STORAGE_KEY = 'agent_roleplay_auth';
const TRIAL_USER_ID_KEY = 'agent_roleplay_trial_user_id';

/** Generate or retrieve a stable trial_user_id for shared access codes */
function getOrCreateTrialUserId(): string {
  let id = localStorage.getItem(TRIAL_USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(TRIAL_USER_ID_KEY, id);
  }
  return id;
}

const INITIAL_STATE: AuthState = {
  accessCode: null,
  isAuthenticated: false,
  authMethod: null,
  user: null,
  organization: null,
  trialUserId: null,
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  // --- Initialize: check both JWT session and localStorage ---
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      // 1. Check for existing Supabase Auth session (JWT)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch user profile + org
        const profile = await fetchUserProfile(session.user.id);
        const org = profile?.org_id ? await fetchOrganization(profile.org_id) : null;

        if (mounted && profile) {
          setAuthState({
            accessCode: null,
            isAuthenticated: true,
            authMethod: 'jwt',
            user: profile,
            organization: org,
            trialUserId: null,
          });
          setLoading(false);
          return;
        }
      }

      // 2. Fallback: check localStorage for access code (trial)
      const stored = localStorage.getItem(ACCESS_CODE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AccessCode;
          if (mounted) {
            setAuthState({
              accessCode: parsed,
              isAuthenticated: true,
              authMethod: 'access_code',
              user: null,
              organization: null,
              trialUserId: getOrCreateTrialUserId(),
            });
          }
        } catch {
          localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
        }
      }

      if (mounted) setLoading(false);
    }

    initialize();

    // Listen for auth state changes (JWT login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          const org = profile?.org_id ? await fetchOrganization(profile.org_id) : null;

          if (profile) {
            // Clear access code when signing in with JWT
            localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
            setAuthState({
              accessCode: null,
              isAuthenticated: true,
              authMethod: 'jwt',
              user: profile,
              organization: org,
              trialUserId: null,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setAuthState(INITIAL_STATE);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Re-fetch profile on token refresh (role may have changed)
          const profile = await fetchUserProfile(session.user.id);
          const org = profile?.org_id ? await fetchOrganization(profile.org_id) : null;
          if (profile) {
            setAuthState(prev => ({
              ...prev,
              user: profile,
              organization: org,
            }));
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- Access Code Login (trial users) ---
  const loginWithCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('access_codes')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return false;
      }

      const accessCode = data as AccessCode;
      localStorage.setItem(ACCESS_CODE_STORAGE_KEY, JSON.stringify(accessCode));
      setAuthState({
        accessCode,
        isAuthenticated: true,
        authMethod: 'access_code',
        user: null,
        organization: null,
        trialUserId: getOrCreateTrialUserId(),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // --- Email/Password Login (enterprise users) ---
  const loginWithEmail = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        return { success: false, error: error.message };
      }

      // Profile + org are loaded by onAuthStateChange
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Login failed' };
    }
  }, []);

  // --- Sign Up (enterprise users via invite) ---
  const signUp = useCallback(async (email: string, password: string, fullName?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Sign up failed' };
    }
  }, []);

  // --- Password Reset ---
  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: 'Password reset failed' };
    }
  }, []);

  // --- Logout (both methods) ---
  const logout = useCallback(async () => {
    localStorage.removeItem(ACCESS_CODE_STORAGE_KEY);

    if (authState.authMethod === 'jwt') {
      await supabase.auth.signOut();
    }

    setAuthState(INITIAL_STATE);
  }, [authState.authMethod]);

  // --- Backward-compatible `login` (alias for loginWithCode) ---
  const login = loginWithCode;

  // --- Derived state ---
  const isAdmin = authState.authMethod === 'jwt'
    ? (authState.user?.role === 'admin' || authState.user?.role === 'owner')
    : authState.accessCode?.role === 'admin';

  const userRole: TenantRole | 'admin' | 'user' | undefined =
    authState.authMethod === 'jwt'
      ? authState.user?.role
      : authState.accessCode?.role;

  const orgId = authState.authMethod === 'jwt'
    ? authState.user?.org_id
    : undefined;

  /** Check if current user has minimum required role */
  const checkRole = useCallback((requiredRole: TenantRole): boolean => {
    if (!authState.user?.role) return false;
    return hasMinRole(authState.user.role, requiredRole);
  }, [authState.user?.role]);

  return {
    // State
    ...authState,
    loading,
    isAdmin,
    userRole,
    orgId,
    // Actions
    login,           // backward compat: access code login
    loginWithCode,
    loginWithEmail,
    signUp,
    resetPassword,
    logout,
    checkRole,
  };
}

// --- Helper functions ---

async function fetchUserProfile(authUserId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error || !data) return null;
  return data as Organization;
}
