import { supabase } from './supabase';
import type { LiveKitTokenResponse, SessionMode } from '../types';

export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || '';

export async function createSessionToken(
  scenarioId: string,
  accessCode: string,
  sessionMode: SessionMode = 'training'
): Promise<LiveKitTokenResponse> {
  const { data, error } = await supabase.functions.invoke('create-livekit-token', {
    body: {
      scenario_id: scenarioId,
      access_code: accessCode,
      session_mode: sessionMode,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create session token');
  }

  return data as LiveKitTokenResponse;
}

export async function endSessionInDatabase(
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(error.message || 'Failed to end session');
  }
}
