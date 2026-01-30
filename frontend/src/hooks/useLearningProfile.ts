import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface LearningProfile {
  total_sessions: number;
  total_valid_sessions: number;
  average_score: number;
  best_score: number;
  worst_score: number;
  criteria_performance: Record<string, { avg: number; count: number; trend?: string }>;
  objection_handling: Record<string, { success_rate: number; count: number }>;
  spin_proficiency: {
    situation: number;
    problem: number;
    implication: number;
    need_payoff: number;
  };
  recurring_weaknesses: string[];
  recurring_strengths: string[];
  ai_summary: string | null;
  outcomes_history: Record<string, number>;
  last_session_at: string | null;
  updated_at: string | null;
}

interface UseLearningProfileReturn {
  profile: LearningProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const DEFAULT_PROFILE: LearningProfile = {
  total_sessions: 0,
  total_valid_sessions: 0,
  average_score: 0,
  best_score: 0,
  worst_score: 100,
  criteria_performance: {},
  objection_handling: {},
  spin_proficiency: {
    situation: 0,
    problem: 0,
    implication: 0,
    need_payoff: 0,
  },
  recurring_weaknesses: [],
  recurring_strengths: [],
  ai_summary: null,
  outcomes_history: {},
  last_session_at: null,
  updated_at: null,
};

export function useLearningProfile(): UseLearningProfileReturn {
  const { accessCode } = useAuth();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
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
        .from('user_learning_profiles')
        .select('*')
        .eq('access_code_id', accessCode.id)
        .single();

      if (fetchError) {
        // Profile might not exist yet
        if (fetchError.code === 'PGRST116') {
          setProfile(DEFAULT_PROFILE);
        } else {
          throw fetchError;
        }
      } else {
        setProfile({
          ...DEFAULT_PROFILE,
          ...data,
          // Ensure JSON fields are parsed
          criteria_performance: data.criteria_performance || {},
          objection_handling: data.objection_handling || {},
          spin_proficiency: data.spin_proficiency || DEFAULT_PROFILE.spin_proficiency,
          recurring_weaknesses: data.recurring_weaknesses || [],
          recurring_strengths: data.recurring_strengths || [],
          outcomes_history: data.outcomes_history || {},
        });
      }
    } catch (err) {
      console.error('Error fetching learning profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch learning profile');
      setProfile(DEFAULT_PROFILE);
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
