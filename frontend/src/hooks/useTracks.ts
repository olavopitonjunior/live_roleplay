import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TrainingTrack } from '../types';

function buildBody(accessCode: string | null, extra: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { ...extra };
  if (accessCode) body.access_code = accessCode;
  return body;
}

export function useTracks() {
  const [tracks, setTracks] = useState<TrainingTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTracks = useCallback(async (accessCode: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, { action: 'list' }),
      });
      if (fetchError) throw fetchError;
      if (data?.error) throw new Error(data.error);
      setTracks(data.tracks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar esteiras');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrackDetail = useCallback(async (
    accessCode: string | null,
    trackSlug: string
  ): Promise<TrainingTrack | null> => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, { action: 'get', track_slug: trackSlug }),
      });
      if (fetchError) throw fetchError;
      if (data?.error) throw new Error(data.error);
      return data.track || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar esteira');
      return null;
    }
  }, []);

  const createTrack = useCallback(async (
    accessCode: string | null,
    trackData: {
      title: string;
      slug: string;
      description?: string;
      category?: string;
      scenarios: { scenario_id: string; position: number; is_required?: boolean; skills_introduced?: string[]; skills_expected?: string[] }[];
    }
  ) => {
    try {
      const { data, error: createError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, { action: 'create', data: trackData }),
      });
      if (createError) throw createError;
      if (data?.error) throw new Error(data.error);
      return data.track;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar esteira');
      return null;
    }
  }, []);

  const updateTrack = useCallback(async (
    accessCode: string | null,
    trackId: string,
    updates: Record<string, unknown>
  ) => {
    try {
      const { data, error: updateError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, { action: 'update', track_id: trackId, data: updates }),
      });
      if (updateError) throw updateError;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar esteira');
      return false;
    }
  }, []);

  const deleteTrack = useCallback(async (accessCode: string | null, trackId: string) => {
    try {
      const { data, error: deleteError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, { action: 'delete', track_id: trackId }),
      });
      if (deleteError) throw deleteError;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir esteira');
      return false;
    }
  }, []);

  const recordProgress = useCallback(async (
    accessCode: string | null,
    trackId: string,
    scenarioId: string,
    sessionId: string,
    score: number,
    weaknesses?: string[],
    spinStageReached?: string
  ) => {
    try {
      const { data, error: progressError } = await supabase.functions.invoke('manage-tracks', {
        body: buildBody(accessCode, {
          action: 'record-progress',
          track_id: trackId,
          scenario_id: scenarioId,
          session_id: sessionId,
          score,
          weaknesses,
          spin_stage_reached: spinStageReached,
        }),
      });
      if (progressError) throw progressError;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error('Failed to record track progress:', err);
      return false;
    }
  }, []);

  return {
    tracks,
    loading,
    error,
    fetchTracks,
    fetchTrackDetail,
    createTrack,
    updateTrack,
    deleteTrack,
    recordProgress,
  };
}
