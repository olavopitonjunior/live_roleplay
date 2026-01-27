import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, ConnectionState, RemoteParticipant } from 'livekit-client';

export type AgentConnectionState =
  | 'idle'
  | 'connecting'
  | 'waiting_agent'
  | 'ready'
  | 'error';

interface UseAgentConnectionOptions {
  token: string | null;
  serverUrl: string;
  agentTimeout?: number; // ms to wait for agent (default: 30000)
}

interface UseAgentConnectionResult {
  state: AgentConnectionState;
  room: Room | null;
  error: string | null;
  retry: () => void;
  disconnect: () => void;
}

/**
 * Hook to connect to LiveKit and wait for agent during loading screen.
 *
 * Flow:
 * 1. idle -> connecting (when token provided)
 * 2. connecting -> waiting_agent (after room connects)
 * 3. waiting_agent -> ready (when agent joins) OR error (timeout)
 */
export function useAgentConnection({
  token,
  serverUrl,
  agentTimeout = 30000,
}: UseAgentConnectionOptions): UseAgentConnectionResult {
  const [state, setState] = useState<AgentConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<Room | null>(null);
  const retryCountRef = useRef(0);

  const clearConnectionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearConnectionTimeout();
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
    setState('idle');
    setError(null);
  }, [clearConnectionTimeout]);

  const checkForAgent = useCallback((checkRoom: Room): boolean => {
    // Check if any remote participant is an agent
    // Agent identity contains "agent" or matches pattern
    const participants = Array.from(checkRoom.remoteParticipants.values());
    return participants.some((p: RemoteParticipant) =>
      p.identity.toLowerCase().includes('agent') ||
      p.identity.toLowerCase().includes('roleplay')
    );
  }, []);

  const connect = useCallback(async () => {
    if (!token || !serverUrl) {
      return;
    }

    // Clean up previous connection
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    clearConnectionTimeout();

    setState('connecting');
    setError(null);

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = newRoom;

    try {
      // Connect to room
      await newRoom.connect(serverUrl, token);

      // Check connection state
      if (newRoom.state !== ConnectionState.Connected) {
        throw new Error('Falha ao conectar com a sala');
      }

      setState('waiting_agent');

      // Check if agent already connected
      if (checkForAgent(newRoom)) {
        setState('ready');
        setRoom(newRoom);
        return;
      }

      // Set timeout for agent connection
      timeoutRef.current = setTimeout(() => {
        setState('error');
        setError('Tempo esgotado aguardando o agente. Por favor, tente novamente.');
        newRoom.disconnect();
      }, agentTimeout);

      // Listen for agent participant
      const onParticipantConnected = (participant: RemoteParticipant) => {
        console.log('[AgentConnection] Participant connected:', participant.identity);

        if (
          participant.identity.toLowerCase().includes('agent') ||
          participant.identity.toLowerCase().includes('roleplay')
        ) {
          clearConnectionTimeout();
          setState('ready');
          setRoom(newRoom);
        }
      };

      newRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected);

      // Handle disconnection
      newRoom.on(RoomEvent.Disconnected, () => {
        clearConnectionTimeout();
        if (state !== 'ready') {
          setState('error');
          setError('Conexao perdida. Por favor, tente novamente.');
        }
      });

    } catch (err) {
      console.error('[AgentConnection] Connection error:', err);
      clearConnectionTimeout();
      setState('error');
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao conectar. Por favor, tente novamente.'
      );
      newRoom.disconnect();
    }
  }, [token, serverUrl, agentTimeout, checkForAgent, clearConnectionTimeout, state]);

  const retry = useCallback(() => {
    retryCountRef.current += 1;
    if (retryCountRef.current > 3) {
      setError('Muitas tentativas. Por favor, volte e tente novamente.');
      return;
    }
    connect();
  }, [connect]);

  // Auto-connect when token becomes available
  useEffect(() => {
    if (token && serverUrl && state === 'idle') {
      connect();
    }
  }, [token, serverUrl, state, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearConnectionTimeout();
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, [clearConnectionTimeout]);

  return {
    state,
    room,
    error,
    retry,
    disconnect,
  };
}
