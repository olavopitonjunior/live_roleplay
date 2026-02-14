import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, ConnectionState, RemoteParticipant } from 'livekit-client';
import { recordLatencyGlobal } from './useLatency';

export type AgentConnectionState =
  | 'idle'
  | 'connecting'
  | 'waiting_agent'
  | 'ready'
  | 'reconnecting'
  | 'error';

interface UseAgentConnectionOptions {
  token: string | null;
  serverUrl: string;
  agentTimeout?: number; // ms to wait for agent (default: 60000)
}

interface UseAgentConnectionResult {
  state: AgentConnectionState;
  room: Room | null;
  error: string | null;
  retry: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 4;
const RECONNECT_BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s

/**
 * Hook to connect to LiveKit and wait for agent during loading screen.
 *
 * Flow:
 * 1. idle -> connecting (when token provided)
 * 2. connecting -> waiting_agent (after room connects)
 * 3. waiting_agent -> ready (when agent joins) OR error (timeout)
 * 4. ready -> reconnecting (on disconnect) -> ready (success) OR error (max retries)
 */
export function useAgentConnection({
  token,
  serverUrl,
  agentTimeout = 60000,
}: UseAgentConnectionOptions): UseAgentConnectionResult {
  const [state, setStateInternal] = useState<AgentConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<Room | null>(null);
  const retryCountRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AgentConnectionState>('idle'); // Track state for closures
  const disconnectedRef = useRef(false); // Guard against double-disconnect
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // Wrapper to update both state and ref (fixes closure issues)
  const setState = useCallback((newState: AgentConnectionState) => {
    console.log('[AgentConnection] State transition:', stateRef.current, '->', newState);
    stateRef.current = newState;
    setStateInternal(newState);
  }, []);

  const clearConnectionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (disconnectedRef.current) {
      console.log('[AgentConnection] disconnect() skipped — already disconnected');
      return;
    }
    disconnectedRef.current = true;
    console.log('[AgentConnection] disconnect() called, current state:', stateRef.current);
    clearConnectionTimeout();
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    if (roomRef.current) {
      console.log('[AgentConnection] Disconnecting room...');
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
    setState('idle');
    setError(null);
  }, [clearConnectionTimeout, clearReconnectTimer, setState]);

  const checkForAgent = useCallback((checkRoom: Room): boolean => {
    // Check if any remote participant is an agent
    const participants = Array.from(checkRoom.remoteParticipants.values());

    console.log('[AgentConnection] Checking for agent, found participants:', participants.map((p: RemoteParticipant) => ({
      identity: p.identity,
      name: p.name,
      sid: p.sid,
    })));

    const hasAgent = participants.some((p: RemoteParticipant) =>
      p.identity.toLowerCase().includes('agent') ||
      p.identity.toLowerCase().includes('roleplay')
    );

    console.log('[AgentConnection] Agent found:', hasAgent);
    return hasAgent;
  }, []);

  const connect = useCallback(async () => {
    if (!token || !serverUrl) {
      return;
    }

    // Clean up previous connection and remove stale event listeners
    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      roomRef.current.disconnect();
    }
    clearConnectionTimeout();
    clearReconnectTimer();

    disconnectedRef.current = false; // Reset guard for new connection
    reconnectAttemptRef.current = 0;
    setState('connecting');
    setError(null);

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = newRoom;

    const _connectStart = performance.now();
    const _agentWaitStart = { current: 0 };

    try {
      // Connect to room
      await newRoom.connect(serverUrl, token);

      // Check connection state
      if (newRoom.state !== ConnectionState.Connected) {
        throw new Error('Falha ao conectar com a sala');
      }

      recordLatencyGlobal('livekit_connect', performance.now() - _connectStart, 'LiveKit Connect');

      setState('waiting_agent');
      _agentWaitStart.current = performance.now();

      // Check if agent already connected
      if (checkForAgent(newRoom)) {
        recordLatencyGlobal('agent_join', performance.now() - _agentWaitStart.current, 'Agent Join', 'already present');
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
          if (_agentWaitStart.current > 0) {
            recordLatencyGlobal('agent_join', performance.now() - _agentWaitStart.current, 'Agent Join', participant.identity);
          }
          clearConnectionTimeout();
          setState('ready');
          setRoom(newRoom);
        }
      };

      newRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected);

      // Handle disconnection with auto-reconnect
      newRoom.on(RoomEvent.Disconnected, () => {
        const currentState = stateRef.current;
        console.log('[AgentConnection] Room disconnected, current state:', currentState);
        clearConnectionTimeout();

        if (currentState === 'ready') {
          // Session was active — attempt reconnection
          attemptReconnect();
        } else {
          // Not yet ready — go to error state
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
  }, [token, serverUrl, agentTimeout, checkForAgent, clearConnectionTimeout, clearReconnectTimer, setState]);

  // Reconnection with exponential backoff
  const attemptReconnect = useCallback(() => {
    reconnectAttemptRef.current += 1;
    const attempt = reconnectAttemptRef.current;

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      console.log(`[AgentConnection] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      setState('error');
      setError('Conexao perdida apos varias tentativas. Por favor, volte e tente novamente.');
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setRoom(null);
      return;
    }

    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s
    console.log(`[AgentConnection] Reconnecting in ${delay}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
    setState('reconnecting');
    setError(null);

    reconnectTimerRef.current = setTimeout(async () => {
      const currentToken = tokenRef.current;
      const currentRoom = roomRef.current;
      if (!currentToken || !currentRoom) {
        setState('error');
        setError('Conexao perdida. Por favor, volte e tente novamente.');
        return;
      }

      try {
        // LiveKit Room.connect() handles ICE restart internally
        await currentRoom.connect(serverUrl, currentToken);

        if (currentRoom.state === ConnectionState.Connected) {
          console.log(`[AgentConnection] Reconnected successfully on attempt ${attempt}`);
          reconnectAttemptRef.current = 0;
          setState('ready');
        } else {
          attemptReconnect();
        }
      } catch (err) {
        console.warn(`[AgentConnection] Reconnect attempt ${attempt} failed:`, err);
        attemptReconnect();
      }
    }, delay);
  }, [serverUrl, setState]);

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
      if (disconnectedRef.current) {
        console.log('[AgentConnection] Cleanup: already disconnected, skipping');
        return;
      }
      console.log('[AgentConnection] Cleanup effect running, state:', stateRef.current);
      clearConnectionTimeout();
      clearReconnectTimer();
      if (roomRef.current) {
        console.log('[AgentConnection] Cleanup: disconnecting room');
        roomRef.current.disconnect();
      }
    };
  }, [clearConnectionTimeout, clearReconnectTimer]);

  return {
    state,
    room,
    error,
    retry,
    disconnect,
  };
}
