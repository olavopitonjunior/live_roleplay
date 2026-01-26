import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSession } from '../hooks/useSession';
import { SessionRoom, SessionLoading } from '../components/Session';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';

interface Scenario {
  id: string;
  title: string;
  description: string;
  context: string;
  persona_name: string;
  persona_style: string;
}

export function Session() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const {
    startSession,
    endSession,
    token,
    sessionId,
    livekitUrl,
    isConnecting,
    error,
  } = useSession();

  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);

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

  useEffect(() => {
    if (!scenarioId || !accessCode || token) return;

    const initSession = async () => {
      try {
        await startSession(scenarioId, accessCode.code);
        setIsReady(true);
      } catch (err) {
        setInitError(
          err instanceof Error ? err.message : 'Falha ao iniciar sessao'
        );
      }
    };

    initSession();
  }, [scenarioId, accessCode, startSession, token]);

  const handleSessionEnd = useCallback(
    async (durationSeconds: number) => {
      if (sessionId) {
        await endSession(sessionId, durationSeconds);
        navigate(`/feedback/${sessionId}`);
      }
    },
    [sessionId, endSession, navigate]
  );

  // Error state
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

  // Loading state
  if (isConnecting || !isReady || !token) {
    return (
      <SessionLoading
        scenarioTitle={scenario?.title}
        scenarioContext={scenario?.context}
      />
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

  // Connected - render session room
  return (
    <SessionRoom
      token={token}
      serverUrl={livekitUrl}
      onSessionEnd={handleSessionEnd}
      scenarioTitle={scenario?.title}
      scenarioContext={scenario?.context}
    />
  );
}
