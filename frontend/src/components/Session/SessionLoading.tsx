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

interface SessionLoadingProps {
  scenarioTitle?: string;
  scenarioContext?: string;
  connectionState?: AgentConnectionState;
  hasToken?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function SessionLoading({
  scenarioTitle,
  scenarioContext,
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

        {/* Scenario info */}
        {(scenarioTitle || scenarioContext) && (
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400">📋</span>
              <span className="text-sm text-neutral-400">Cenario</span>
            </div>

            {scenarioTitle && (
              <h3 className="text-lg font-semibold text-white mb-2">
                {scenarioTitle}
              </h3>
            )}

            {scenarioContext && (
              <p className="text-sm text-neutral-400 line-clamp-3">
                {scenarioContext}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
