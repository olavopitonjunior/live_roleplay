import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSession } from '../hooks/useSession';
import { useAgentConnection } from '../hooks/useAgentConnection';
import { SessionRoom, SessionLoading } from '../components/Session';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import type { SessionMode } from '../types';

interface Scenario {
  id: string;
  title: string;
  description: string;
  context: string;
  persona_name: string;
  persona_style: string;
  duration_max_seconds?: number;
}

interface LocationState {
  sessionMode?: SessionMode;
  durationSeconds?: number;
}

export function Session() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessCode } = useAuth();

  // Get session mode from navigation state (defaults to training)
  const locationState = location.state as LocationState | null;
  const sessionMode = locationState?.sessionMode || 'training';
  const {
    startSession,
    endSession,
    token,
    sessionId,
    livekitUrl,
    isConnecting,
    error,
  } = useSession();

  const [initError, setInitError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // Use agent connection hook to connect during loading
  const {
    state: agentState,
    room: connectedRoom,
    error: agentError,
    retry: retryConnection,
    disconnect,
  } = useAgentConnection({
    token,
    serverUrl: livekitUrl,
    agentTimeout: 30000, // 30 seconds
  });

  // Diagnostic: track component lifecycle
  useEffect(() => {
    console.log('[Session] MOUNTED, scenarioId:', scenarioId, 'sessionMode:', sessionMode);
    const mountTime = Date.now();
    return () => {
      const lifetime = Date.now() - mountTime;
      if (lifetime < 5000) {
        console.error('[Session] UNMOUNTED after only', lifetime, 'ms - possible re-render or navigation bug');
      } else {
        console.log('[Session] UNMOUNTED after', Math.round(lifetime / 1000), 's');
      }
    };
  }, []);

  // Diagnostic: track state transitions
  useEffect(() => {
    console.log('[Session] agentState changed:', agentState, 'token:', !!token, 'sessionId:', sessionId);
  }, [agentState, token, sessionId]);

  // Fetch scenario data
  useEffect(() => {
    if (!scenarioId) return;

    const fetchScenario = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('scenarios')
          .select('*')
          .eq('id', scenarioId)
          .single();

        if (fetchError) throw fetchError;
        setScenario(data);
      } catch (err) {
        console.error('Error fetching scenario:', err);
      }
    };

    fetchScenario();
  }, [scenarioId]);

  // Start session (get token)
  useEffect(() => {
    if (!scenarioId || !accessCode || token) return;

    const initSession = async () => {
      try {
        await startSession(scenarioId, accessCode.code, sessionMode);
      } catch (err) {
        setInitError(
          err instanceof Error ? err.message : 'Falha ao iniciar sessao'
        );
      }
    };

    initSession();
  }, [scenarioId, accessCode, startSession, token, sessionMode]);

  const handleSessionEnd = useCallback(
    async (durationSeconds: number) => {
      if (sessionId) {
        disconnect(); // Single disconnect point for the room
        try {
          await endSession(sessionId, durationSeconds);
        } catch (err) {
          console.error('[Session] Error ending session:', err);
        }
        navigate(`/feedback/${sessionId}`);
      }
    },
    [sessionId, endSession, navigate, disconnect]
  );

  const handleRetry = useCallback(() => {
    setInitError(null);
    retryConnection();
  }, [retryConnection]);

  const handleCancel = useCallback(() => {
    disconnect();
    navigate('/home');
  }, [disconnect, navigate]);

  // Token fetch error (not agent connection error - that's shown on loading screen)
  if (error || initError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Erro ao iniciar sessao</h2>
          <p className="text-gray-400 mb-8">{error || initError}</p>
          <Button onClick={() => navigate('/home')} variant="primary" size="lg">
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

  // Check if LiveKit URL is configured
  if (!livekitUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Configuracao pendente</h2>
          <p className="text-gray-400 mb-8">
            O servidor LiveKit nao esta configurado. Configure a variavel
            VITE_LIVEKIT_URL no arquivo .env
          </p>
          <Button onClick={() => navigate('/home')} variant="primary" size="lg">
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

  // Loading state - show until agent is ready
  // This includes: getting token, connecting to LiveKit, waiting for agent
  if (isConnecting || !token || agentState !== 'ready') {
    return (
      <SessionLoading
        scenarioTitle={scenario?.title}
        scenarioContext={scenario?.context}
        connectionState={agentState}
        hasToken={!!token}
        error={agentError}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    );
  }

  // Agent connected - render session room
  // IMPORTANT: Pass the existing room to SessionRoom instead of creating a new connection
  // Disconnecting the verification room causes the agent to shut down!
  return (
    <SessionRoom
      token={token}
      serverUrl={livekitUrl}
      onSessionEnd={handleSessionEnd}
      scenarioTitle={scenario?.title}
      scenarioContext={scenario?.context}
      maxDuration={locationState?.durationSeconds || scenario?.duration_max_seconds || 180}
      existingRoom={connectedRoom} // Pass existing room to avoid agent disconnect
    />
  );
}
