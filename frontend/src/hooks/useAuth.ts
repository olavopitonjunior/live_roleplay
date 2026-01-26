import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { AccessCode, AuthState } from '../types';

const STORAGE_KEY = 'agent_roleplay_auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    accessCode: null,
    isAuthenticated: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AccessCode;
        setAuthState({ accessCode: parsed, isAuthenticated: true });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (code: string): Promise<boolean> => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accessCode));
      setAuthState({ accessCode, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthState({ accessCode: null, isAuthenticated: false });
  }, []);

  const isAdmin = authState.accessCode?.role === 'admin';

  return {
    ...authState,
    loading,
    login,
    logout,
    isAdmin,
  };
}
