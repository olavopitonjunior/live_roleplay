import { useState, useCallback } from 'react';
import { createSessionToken, endSessionInDatabase, LIVEKIT_URL } from '../lib/livekit';

interface SessionState {
  sessionId: string | null;
  token: string | null;
  roomName: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    token: null,
    roomName: null,
    isConnecting: false,
    isConnected: false,
    error: null,
  });

  const startSession = useCallback(async (scenarioId: string, accessCode: string) => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const { token, room_name, session_id } = await createSessionToken(
        scenarioId,
        accessCode
      );

      setState({
        sessionId: session_id,
        token,
        roomName: room_name,
        isConnecting: false,
        isConnected: true,
        error: null,
      });

      return { token, roomName: room_name, sessionId: session_id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Falha ao iniciar sessao';

      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: errorMessage,
      }));

      throw error;
    }
  }, []);

  const endSession = useCallback(async (sessionId: string, durationSeconds: number) => {
    try {
      await endSessionInDatabase(sessionId, durationSeconds);
      setState((prev) => ({ ...prev, isConnected: false }));
    } catch (error) {
      console.error('Error ending session:', error);
      // Still mark as disconnected even if update fails
      setState((prev) => ({ ...prev, isConnected: false }));
    }
  }, []);

  const resetSession = useCallback(() => {
    setState({
      sessionId: null,
      token: null,
      roomName: null,
      isConnecting: false,
      isConnected: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    startSession,
    endSession,
    resetSession,
    livekitUrl: LIVEKIT_URL,
  };
}
