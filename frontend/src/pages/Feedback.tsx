import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFeedback } from '../hooks/useFeedback';
import { FeedbackView } from '../components/Feedback';
import { Button } from '../components/ui';
import { isLatencyEnabled } from '../hooks/useLatency';

// Progressive loading messages shown during feedback generation
const LOADING_STEPS = [
  { message: 'Salvando transcricao...', sub: 'Finalizando a conversa' },
  { message: 'Lendo transcricao...', sub: 'Preparando dados para analise' },
  { message: 'Avaliando performance...', sub: 'A IA esta analisando seus argumentos' },
  { message: 'Analisando objecoes...', sub: 'Verificando como voce tratou cada objecao' },
  { message: 'Gerando relatorio...', sub: 'Montando seu feedback detalhado' },
];

// Map technical errors to user-friendly messages
function getFriendlyError(error: string): {
  title: string;
  message: string;
  canRetry: boolean;
} {
  if (error.includes('Transcript') || error.includes('transcript')) {
    return {
      title: 'Sessao muito curta',
      message:
        'A conversa nao teve interacao suficiente para gerar um feedback. Tente uma sessao mais longa.',
      canRetry: false,
    };
  }
  if (error.includes('Timeout') || error.includes('timeout')) {
    return {
      title: 'Demora na analise',
      message:
        'A analise esta demorando mais que o esperado. Voce pode tentar recarregar a pagina.',
      canRetry: true,
    };
  }
  if (error.includes('not found') || error.includes('nao encontrado')) {
    return {
      title: 'Sessao nao encontrada',
      message: 'Nao foi possivel localizar os dados desta sessao.',
      canRetry: false,
    };
  }
  if (error.includes('500') || error.includes('Internal')) {
    return {
      title: 'Erro temporario',
      message: 'Ocorreu um erro no servidor. Tente recarregar a pagina em alguns instantes.',
      canRetry: true,
    };
  }
  if (error.includes('API not configured') || error.includes('ANTHROPIC_API_KEY')) {
    return {
      title: 'Servico indisponivel',
      message: 'O servico de avaliacao esta temporariamente indisponivel. Tente novamente mais tarde.',
      canRetry: true,
    };
  }
  if (error.includes('parse') || error.includes('AI response') || error.includes('JSON')) {
    return {
      title: 'Erro na analise',
      message: 'Erro ao processar a resposta da IA. Tente novamente.',
      canRetry: true,
    };
  }
  if (error.includes('non-2xx') || error.includes('Edge Function')) {
    return {
      title: 'Erro no servico',
      message: 'Erro no servico de feedback. Tente recarregar a pagina.',
      canRetry: true,
    };
  }
  return {
    title: 'Erro ao carregar feedback',
    message: error,
    canRetry: true,
  };
}

export function Feedback() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    feedback,
    scenario,
    transcript,
    evidences,
    objectionStatuses,
    sessionOutcome,
    loading,
    generating,
    waitingForTranscript,
    error,
    fetchFeedback,
  } = useFeedback();

  // Progressive step index for loading animation
  const [loadingStep, setLoadingStep] = useState(0);
  // Feedback timing (latency measurement)
  const feedbackStartRef = useRef(performance.now());
  const [feedbackTimeMs, setFeedbackTimeMs] = useState<number | null>(null);
  const showLatency = isLatencyEnabled();

  useEffect(() => {
    if (sessionId) {
      feedbackStartRef.current = performance.now();
      fetchFeedback(sessionId);
    }
  }, [sessionId, fetchFeedback]);

  // Capture feedback generation time when feedback arrives
  useEffect(() => {
    if (feedback && feedbackTimeMs === null) {
      const ms = performance.now() - feedbackStartRef.current;
      setFeedbackTimeMs(ms);
      console.log(`[Latency] feedback_generation: ${ms.toFixed(0)}ms`);
    }
  }, [feedback, feedbackTimeMs]);

  // Cycle through loading steps while generating
  useEffect(() => {
    if (!generating && !waitingForTranscript) {
      setLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        return prev; // Stay on last step
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [generating, waitingForTranscript]);

  // Loading / generating / waiting states
  if (loading || generating || waitingForTranscript) {
    const step = LOADING_STEPS[loadingStep];
    const isWaiting = waitingForTranscript && !generating;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="text-center max-w-sm">
          {/* Loading spinner */}
          <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-black border-t-yellow-400 animate-spin" />
          </div>

          <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-tight">
            {loading && !generating && !waitingForTranscript
              ? 'Carregando feedback...'
              : step.message}
          </h2>
          <p className="text-black font-mono mb-6">
            {loading && !generating && !waitingForTranscript
              ? 'Buscando resultados'
              : step.sub}
          </p>

          {/* Progress indicator */}
          {(generating || isWaiting) && (
            <div className="flex justify-center gap-1.5 mb-4">
              {LOADING_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i <= loadingStep
                      ? 'w-6 bg-yellow-400 border border-black'
                      : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Animated dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state with friendly messages
  if (error) {
    const friendly = getFriendlyError(error);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="max-w-md text-center border-2 border-black p-8 shadow-[4px_4px_0px_#000]">
          <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold">{friendly.canRetry ? '!' : 'x'}</span>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-tight">{friendly.title}</h2>
          <p className="text-black font-mono mb-8">{friendly.message}</p>
          <div className="flex flex-col gap-3">
            {friendly.canRetry && sessionId && (
              <Button
                onClick={() => {
                  setLoadingStep(0);
                  fetchFeedback(sessionId);
                }}
                variant="primary"
                size="lg"
              >
                Tentar Novamente
              </Button>
            )}
            <Button onClick={() => navigate('/home')} variant="outline" size="lg">
              Voltar para Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!feedback || !scenario) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="max-w-md text-center border-2 border-black p-8 shadow-[4px_4px_0px_#000]">
          <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold">?</span>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-tight">
            Feedback nao encontrado
          </h2>
          <p className="text-black font-mono mb-8">
            O feedback desta sessao ainda nao foi gerado ou a sessao foi muito curta para
            avaliar.
          </p>
          <div className="flex flex-col gap-3">
            {sessionId && (
              <Button
                onClick={() => {
                  setLoadingStep(0);
                  fetchFeedback(sessionId);
                }}
                variant="primary"
                size="lg"
              >
                Tentar Novamente
              </Button>
            )}
            <Button onClick={() => navigate('/home')} variant="outline" size="lg">
              Voltar para Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success - show feedback
  return (
    <div className="min-h-screen bg-white">
      {/* Latency badge (debug only) */}
      {showLatency && feedbackTimeMs && (
        <div className="bg-neutral-900 text-neutral-300 text-xs font-mono px-3 py-1 text-center">
          Feedback gerado em {(feedbackTimeMs / 1000).toFixed(1)}s
        </div>
      )}

      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 z-10 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-black uppercase tracking-tight">Resultado</h1>
          <button
            onClick={() => navigate('/home')}
            className="text-black hover:text-yellow-600 transition-colors font-bold uppercase tracking-wider text-sm"
          >
            Fechar
          </button>
        </div>
      </header>

      {/* Feedback Content */}
      <main className="pb-32">
        <FeedbackView
          feedback={feedback}
          scenario={scenario}
          transcript={transcript || undefined}
          evidences={evidences}
          objectionStatuses={objectionStatuses}
          sessionOutcome={sessionOutcome}
        />
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black p-4">
        <div className="max-w-2xl mx-auto flex gap-4">
          <Button
            onClick={() => navigate('/home')}
            variant="primary"
            size="lg"
            fullWidth
          >
            Novo Treino
          </Button>
          <Button
            onClick={() => navigate('/history')}
            variant="outline"
            size="lg"
            fullWidth
          >
            Ver Historico
          </Button>
        </div>
      </div>
    </div>
  );
}
