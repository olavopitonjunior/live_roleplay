import { useState } from 'react';
import type { Scenario, SessionMode, CoachIntensity } from '../../types';

interface ModeSelectionModalProps {
  scenario: Scenario;
  onStart: (mode: SessionMode, coachIntensity?: CoachIntensity) => void;
  onCancel: () => void;
}

export function ModeSelectionModal({ scenario, onStart, onCancel }: ModeSelectionModalProps) {
  const [selectedMode, setSelectedMode] = useState<SessionMode>(
    scenario.default_session_mode || 'training'
  );
  const [coachIntensity, setCoachIntensity] = useState<CoachIntensity>('medium');

  const handleStart = () => {
    onStart(selectedMode, selectedMode === 'training' ? coachIntensity : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-black">{scenario.title}</h2>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{scenario.context}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Selecione o modo</h3>

          {/* Mode Selection */}
          <div className="space-y-3">
            {/* Training Mode */}
            <button
              onClick={() => setSelectedMode('training')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'training'
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'training'
                      ? 'border-yellow-400 bg-yellow-400'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedMode === 'training' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">Modo Treino</span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Receba dicas em tempo real durante a conversa. Ideal para aprender e
                    praticar novas tecnicas.
                  </p>
                </div>
              </div>
            </button>

            {/* Evaluation Mode */}
            <button
              onClick={() => setSelectedMode('evaluation')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                selectedMode === 'evaluation'
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'evaluation'
                      ? 'border-yellow-400 bg-yellow-400'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedMode === 'evaluation' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">Modo Avaliacao</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      Teste real
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Sem dicas durante a sessao. Avalie seu desempenho real em uma
                    simulacao mais realista.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Coach Intensity (only for training mode) */}
          {selectedMode === 'training' && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Intensidade do Coach
              </h3>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as CoachIntensity[]).map((intensity) => (
                  <button
                    key={intensity}
                    onClick={() => setCoachIntensity(intensity)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      coachIntensity === intensity
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {intensity === 'low' && 'Minimo'}
                    {intensity === 'medium' && 'Moderado'}
                    {intensity === 'high' && 'Maximo'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {coachIntensity === 'low' && 'Apenas dicas criticas quando necessario.'}
                {coachIntensity === 'medium' && 'Equilibrio entre autonomia e orientacao.'}
                {coachIntensity === 'high' && 'Orientacao constante para aprendizado intensivo.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-black bg-yellow-400 hover:bg-yellow-500 transition-colors"
          >
            Iniciar Sessao
          </button>
        </div>
      </div>
    </div>
  );
}
