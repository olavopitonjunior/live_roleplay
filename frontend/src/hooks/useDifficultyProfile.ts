import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface DifficultyProfile {
  current_level: number;
  sessions_at_level: number;
  consecutive_high_scores: number;
  consecutive_low_scores: number;
  last_adjustment_at: string | null;
}

interface UseDifficultyProfileReturn {
  profile: DifficultyProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDifficultyProfile(): UseDifficultyProfileReturn {
  const { accessCode } = useAuth();
  const [profile, setProfile] = useState<DifficultyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!accessCode?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_difficulty_profiles')
        .select('current_level, sessions_at_level, consecutive_high_scores, consecutive_low_scores, last_adjustment_at')
        .eq('access_code_id', accessCode.id)
        .single();

      if (fetchError) {
        // Profile might not exist yet, default to level 3
        if (fetchError.code === 'PGRST116') {
          setProfile({
            current_level: 3,
            sessions_at_level: 0,
            consecutive_high_scores: 0,
            consecutive_low_scores: 0,
            last_adjustment_at: null,
          });
        } else {
          throw fetchError;
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching difficulty profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch difficulty profile');
      // Set default profile on error
      setProfile({
        current_level: 3,
        sessions_at_level: 0,
        consecutive_high_scores: 0,
        consecutive_low_scores: 0,
        last_adjustment_at: null,
      });
    } finally {
      setLoading(false);
    }
  }, [accessCode?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
  };
}
