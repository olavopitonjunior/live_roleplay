import { supabase } from './supabase';
import type { LiveKitTokenResponse, SessionMode } from '../types';

export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || '';

export async function createSessionToken(
  scenarioId: string,
  accessCode: string | null,
  sessionMode: SessionMode = 'training',
  voiceOverride?: string,
  trialUserId?: string | null
): Promise<LiveKitTokenResponse> {
  const body: Record<string, string> = {
    scenario_id: scenarioId,
    session_mode: sessionMode,
  };
  if (accessCode) body.access_code = accessCode;
  if (voiceOverride) body.voice_override = voiceOverride;
  if (trialUserId) body.trial_user_id = trialUserId;

  const { data, error } = await supabase.functions.invoke('create-livekit-token', {
    body,
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
