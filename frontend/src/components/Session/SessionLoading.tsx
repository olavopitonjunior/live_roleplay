import { useEffect, useState } from 'react';
import type { AgentConnectionState } from '../../hooks/useAgentConnection';

interface LoadingStep {
  id: string;
  label: string;
  description: string;
}

const LOADING_STEPS: LoadingStep[] = [
  { id: 'token', label: 'Preparando', description: 'Obtendo credenciais de acesso' },
  { id: 'connect', label: 'Conectando', description: 'Estabelecendo conexao com o servidor' },
  { id: 'agent', label: 'Aguardando agente', description: 'Inicializando avatar de IA' },
  { id: 'ready', label: 'Pronto', description: 'Avatar pronto para comecar' },
];

function getSessionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    cold_call: 'Cold Call',
    interview: 'Entrevista',
    entrevista: 'Entrevista',
    negotiation: 'Negociacao',
    negociacao: 'Negociacao',
    retention: 'Retencao',
    retencao: 'Retencao',
    prospeccao_consultiva: 'Discovery',
    discovery: 'Discovery',
    apresentacao: 'Apresentacao',
    presentation: 'Apresentacao',
  };
  return map[type] || type;
}

function getSessionTip(type: string): string {
  const tips: Record<string, string> = {
    cold_call: 'O avatar NAO espera sua ligacao. Conquiste a atencao nos primeiros 30 segundos ou ele pode desligar.',
    apresentacao: 'O avatar esta esperando esta reuniao. Conduza a conversa e apresente seu valor.',
    presentation: 'O avatar esta esperando esta reuniao. Conduza a conversa e apresente seu valor.',
    negociacao: 'Prepare argumentos solidos. O avatar vai defender sua posicao e exigir contrapartidas.',
    negotiation: 'Prepare argumentos solidos. O avatar vai defender sua posicao e exigir contrapartidas.',
    retencao: 'O avatar quer cancelar. Demonstre empatia e ofereca solucoes concretas.',
    retention: 'O avatar quer cancelar. Demonstre empatia e ofereca solucoes concretas.',
    entrevista: 'O avatar e um candidato. Faca perguntas abertas para avaliar competencias.',
    interview: 'O avatar e um candidato. Faca perguntas abertas para avaliar competencias.',
    discovery: 'O avatar aceitou uma reuniao exploratoria. Identifique necessidades antes de propor solucoes.',
    prospeccao_consultiva: 'O avatar aceitou uma reuniao exploratoria. Identifique necessidades antes de propor solucoes.',
  };
  return tips[type] || 'Mantenha o foco no objetivo e conduza a conversa de forma profissional.';
}

interface SessionLoadingProps {
  scenarioTitle?: string;
  scenarioContext?: string;
  characterName?: string | null;
  characterRole?: string | null;
  sessionType?: string | null;
  targetDurationSeconds?: number | null;
  connectionState?: AgentConnectionState;
  hasToken?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function SessionLoading({
  scenarioTitle,
  scenarioContext,
  characterName,
  characterRole,
  sessionType,
  targetDurationSeconds,
  connectionState = 'idle',
  hasToken = false,
  error = null,
  onRetry,
  onCancel,
}: SessionLoadingProps) {
  const [animatedStep, setAnimatedStep] = useState(0);

  // Map connection state to step number
  const getStepFromState = (): number => {
    if (!hasToken) return 0; // Getting token
    switch (connectionState) {
      case 'idle':
        return 0;
      case 'connecting':
        return 1;
      case 'waiting_agent':
        return 2;
      case 'ready':
        return 3;
      case 'reconnecting':
        return animatedStep; // Keep current step while reconnecting
      case 'error':
        return animatedStep; // Keep current step on error
      default:
        return 0;
    }
  };

  // Update animated step based on real state
  useEffect(() => {
    const targetStep = getStepFromState();
    if (targetStep > animatedStep) {
      setAnimatedStep(targetStep);
    }
  }, [connectionState, hasToken]);

  const activeStep = getStepFromState();
  const hasError = connectionState === 'error' || !!error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <div className="max-w-md w-full">
        {/* Spinner or Error Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {hasError ? (
              // Error state
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/30">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            ) : (
              // Loading spinner
              <>
                <div className="w-20 h-20 rounded-full border-4 border-neutral-800 border-t-yellow-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center">
                    <span className="text-2xl">🎭</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Error message */}
        {hasError && (
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">
              Erro na conexao
            </h2>
            <p className="text-neutral-400 mb-6">
              {error || 'Nao foi possivel conectar com o agente. Por favor, tente novamente.'}
            </p>
            <div className="flex gap-3 justify-center">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-2.5 bg-yellow-400 text-black font-semibold rounded-full hover:bg-yellow-300 transition-colors"
                >
                  Tentar novamente
                </button>
              )}
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-6 py-2.5 bg-neutral-800 text-white font-semibold rounded-full hover:bg-neutral-700 transition-colors"
                >
                  Voltar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Steps indicator - hide when error is showing with action buttons */}
        {!hasError && (
          <div className="space-y-3 mb-8">
            {LOADING_STEPS.map((step, index) => {
              const isActive = index === activeStep;
              const isCompleted = index < activeStep;
              const isError = hasError && index === activeStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                    isError
                      ? 'bg-red-400/10 border border-red-400/30'
                      : isActive
                        ? 'bg-yellow-400/10 border border-yellow-400/30'
                        : isCompleted
                          ? 'bg-green-400/10'
                          : 'bg-neutral-900/50'
                  }`}
                >
                  {/* Step indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isError
                      ? 'bg-red-500 text-white'
                      : isActive
                        ? 'bg-yellow-400 text-black'
                        : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-neutral-700 text-neutral-400'
                  }`}>
                    {isError ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Step text */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      isError
                        ? 'text-red-400'
                        : isActive
                          ? 'text-yellow-400'
                          : isCompleted
                            ? 'text-green-400'
                            : 'text-neutral-400'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-neutral-500 truncate">
                      {step.description}
                    </p>
                  </div>

                  {/* Loading dots for active step (not on error) */}
                  {isActive && !isError && (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scenario info card */}
        {scenarioTitle && (
          <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
            {/* Header: Title + session type badge */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-lg font-semibold text-white">{scenarioTitle}</h3>
              {sessionType && (
                <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-neutral-700 text-neutral-300 font-medium">
                  {getSessionTypeLabel(sessionType)}
                </span>
              )}
            </div>

            {/* Character info */}
            {characterName && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
                  <span className="text-yellow-400 text-sm">🎭</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{characterName}</p>
                  {characterRole && (
                    <p className="text-xs text-neutral-400">{characterRole}</p>
                  )}
                </div>
              </div>
            )}

            {/* Context (truncated) */}
            {scenarioContext && (
              <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                {scenarioContext}
              </p>
            )}

            {/* Duration badge */}
            {targetDurationSeconds && (
              <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {Math.floor(targetDurationSeconds / 60)} min
                </span>
              </div>
            )}

            {/* Session tip */}
            {sessionType && (
              <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                <p className="text-xs text-yellow-400/80 font-medium mb-1">Dica</p>
                <p className="text-xs text-neutral-400">
                  {getSessionTip(sessionType)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
