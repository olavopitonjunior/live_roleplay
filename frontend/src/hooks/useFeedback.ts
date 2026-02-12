import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Feedback, Scenario, Evidence, SessionObjectionStatus } from '../types';

// Session outcome types
export type SessionOutcome =
  | 'sale_closed'
  | 'meeting_scheduled'
  | 'proposal_requested'
  | 'needs_follow_up'
  | 'rejected'
  | 'abandoned'
  | 'timeout';

interface FeedbackState {
  feedback: Feedback | null;
  scenario: Scenario | null;
  transcript: string | null;
  evidences: Evidence[];
  objectionStatuses: SessionObjectionStatus[];
  sessionOutcome: SessionOutcome | null;
  loading: boolean;
  generating: boolean;
  waitingForTranscript: boolean;
  error: string | null;
}

// Helper to wait for transcript to be available
const waitForTranscript = async (
  sessionId: string,
  maxAttempts = 15,
  intervalMs = 2000
): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await supabase
      .from('sessions')
      .select('transcript, status')
      .eq('id', sessionId)
      .single();

    if (data?.transcript && data.transcript.trim().length > 0) {
      return true;
    }

    // If session is completed but no transcript, something went wrong
    if (data?.status === 'completed' && !data?.transcript) {
      // Give it a few more tries in case of race condition
      if (i >= maxAttempts - 3) {
        return false;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

export function useFeedback() {
  const [state, setState] = useState<FeedbackState>({
    feedback: null,
    scenario: null,
    transcript: null,
    evidences: [],
    objectionStatuses: [],
    sessionOutcome: null,
    loading: false,
    generating: false,
    waitingForTranscript: false,
    error: null,
  });

  const generateFeedback = useCallback(async (sessionId: string) => {
    // First, wait for transcript to be available
    setState((prev) => ({ ...prev, waitingForTranscript: true, error: null }));

    const hasTranscript = await waitForTranscript(sessionId);

    if (!hasTranscript) {
      setState((prev) => ({
        ...prev,
        waitingForTranscript: false,
        error: 'Transcript da sessao nao disponivel. Tente novamente.',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, waitingForTranscript: false, generating: true }));

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'generate-feedback',
        {
          body: { session_id: sessionId },
        }
      );

      if (fnError) {
        // 409 means feedback already exists - treat as success
        if (fnError.message?.includes('already exists') ||
            fnError.message?.includes('409')) {
          return true;
        }
        // Read detailed error from Edge Function response body
        const detailMsg = (data as Record<string, unknown>)?.error as string
          || fnError.message
          || 'Falha ao gerar feedback';
        throw new Error(detailMsg);
      }

      // Feedback generated, now fetch it
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Falha ao gerar feedback';
      // Handle "already exists" in catch block too
      if (errorMessage.includes('already exists')) {
        return true;
      }
      setState((prev) => ({ ...prev, generating: false, error: errorMessage }));
      return false;
    }
  }, []);

  const fetchFeedback = useCallback(async (sessionId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // First, check if feedback exists
      const { data: existingFeedback, error: fbError } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (fbError && fbError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is ok
        throw fbError;
      }

      if (!existingFeedback) {
        // Check if backend already requested feedback generation
        // Use try/catch as fallback if migration 017 hasn't been applied yet
        let backendRequested = false;
        try {
          const { data: sessionCheckData } = await supabase
            .from('sessions')
            .select('feedback_requested')
            .eq('id', sessionId)
            .single();
          backendRequested = sessionCheckData?.feedback_requested ?? false;
        } catch {
          // Column may not exist yet if migration not applied - assume false
          backendRequested = false;
        }

        if (backendRequested) {
          // Backend already triggered feedback - poll and wait for it
          setState((prev) => ({ ...prev, loading: false, waitingForTranscript: true }));

          const maxPolls = 30; // 30 * 2s = 60s max wait
          let foundFeedback = null;

          for (let i = 0; i < maxPolls; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const { data: polledFeedback } = await supabase
              .from('feedbacks')
              .select('*')
              .eq('session_id', sessionId)
              .single();

            if (polledFeedback) {
              foundFeedback = polledFeedback;
              break;
            }
          }

          if (foundFeedback) {
            setState((prev) => ({
              ...prev,
              feedback: foundFeedback as Feedback,
              waitingForTranscript: false,
            }));
          } else {
            throw new Error('Timeout aguardando feedback do servidor');
          }
        } else {
          // No feedback and backend didn't request - generate ourselves
          setState((prev) => ({ ...prev, loading: false, generating: true }));
          const success = await generateFeedback(sessionId);

          if (!success) {
            return;
          }

          // Now fetch the generated feedback
          const { data: newFeedback, error: newFbError } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          if (newFbError || !newFeedback) {
            throw new Error('Feedback gerado mas nao encontrado');
          }

          setState((prev) => ({
            ...prev,
            feedback: newFeedback as Feedback,
            generating: false,
          }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          feedback: existingFeedback as Feedback,
        }));
      }

      // Fetch session data including transcript and outcome
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('scenario_id, transcript, outcome')
        .eq('id', sessionId)
        .single();

      if (sessionData) {
        // Set transcript and outcome
        setState((prev) => ({
          ...prev,
          transcript: sessionData.transcript || null,
          sessionOutcome: (sessionData.outcome as SessionOutcome) || null,
        }));

        // Fetch scenario
        if (sessionData.scenario_id) {
          const { data: scenarioData } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', sessionData.scenario_id)
            .single();

          if (scenarioData) {
            setState((prev) => ({
              ...prev,
              scenario: scenarioData as Scenario,
            }));
          }
        }
      }

      // Fetch evidences (PRD 08)
      const { data: evidencesData } = await supabase
        .from('session_evidences')
        .select('*')
        .eq('session_id', sessionId)
        .order('transcript_start_index', { ascending: true });

      if (evidencesData) {
        setState((prev) => ({
          ...prev,
          evidences: evidencesData as Evidence[],
        }));
      }

      // Fetch objection statuses (PRD 08)
      const { data: objectionStatusData } = await supabase
        .from('session_objection_status')
        .select('*')
        .eq('session_id', sessionId);

      if (objectionStatusData) {
        setState((prev) => ({
          ...prev,
          objectionStatuses: objectionStatusData as SessionObjectionStatus[],
        }));
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Falha ao carregar feedback';
      setState((prev) => ({ ...prev, error: errorMessage }));
    } finally {
      setState((prev) => ({
        ...prev,
        loading: false,
        generating: false,
        waitingForTranscript: false,
      }));
    }
  }, [generateFeedback]);

  return {
    ...state,
    fetchFeedback,
    generateFeedback,
  };
}
