import { useEffect, useState } from 'react';

interface LoadingStep {
  id: string;
  label: string;
  description: string;
}

const LOADING_STEPS: LoadingStep[] = [
  { id: 'connect', label: 'Conectando', description: 'Estabelecendo conexao com o servidor' },
  { id: 'avatar', label: 'Preparando avatar', description: 'Inicializando avatar de IA' },
  { id: 'ready', label: 'Iniciando conversa', description: 'Avatar pronto para comecar' },
];

interface SessionLoadingProps {
  scenarioTitle?: string;
  scenarioContext?: string;
  currentStep?: number;
}

export function SessionLoading({
  scenarioTitle,
  scenarioContext,
  currentStep = 0
}: SessionLoadingProps) {
  const [animatedStep, setAnimatedStep] = useState(0);

  // Animate through steps if no explicit step provided
  useEffect(() => {
    if (currentStep > 0) {
      setAnimatedStep(currentStep);
      return;
    }

    // Auto-advance steps for visual feedback
    const timers = [
      setTimeout(() => setAnimatedStep(1), 800),
      setTimeout(() => setAnimatedStep(2), 2000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [currentStep]);

  const activeStep = currentStep > 0 ? currentStep : animatedStep;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <div className="max-w-md w-full">
        {/* Spinner */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-neutral-800 border-t-yellow-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center">
                <span className="text-2xl">🎭</span>
              </div>
            </div>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="space-y-3 mb-8">
          {LOADING_STEPS.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-yellow-400/10 border border-yellow-400/30'
                    : isCompleted
                      ? 'bg-green-400/10'
                      : 'bg-neutral-900/50'
                }`}
              >
                {/* Step indicator */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive
                    ? 'bg-yellow-400 text-black'
                    : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-700 text-neutral-400'
                }`}>
                  {isCompleted ? (
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
                    isActive ? 'text-yellow-400' : isCompleted ? 'text-green-400' : 'text-neutral-400'
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-sm text-neutral-500 truncate">
                    {step.description}
                  </p>
                </div>

                {/* Loading dots for active step */}
                {isActive && (
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
