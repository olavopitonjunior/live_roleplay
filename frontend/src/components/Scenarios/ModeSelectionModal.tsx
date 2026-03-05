import { useState } from 'react';
import type { Scenario, SessionMode, AiVoice, CharacterGender } from '../../types';

interface ModeSelectionModalProps {
  scenario: Scenario;
  onStart: (mode: SessionMode, durationSeconds: number, voiceOverride?: AiVoice) => void;
  onCancel: () => void;
  difficultyLevel?: number;
}

const VOICE_OPTIONS: { value: AiVoice; label: string; gender: CharacterGender }[] = [
  { value: 'echo', label: 'Echo — Amigavel', gender: 'male' },
  { value: 'ash', label: 'Ash — Seria', gender: 'male' },
  { value: 'sage', label: 'Sage — Assertiva', gender: 'male' },
  { value: 'shimmer', label: 'Shimmer — Suave', gender: 'female' },
  { value: 'coral', label: 'Coral — Expressiva', gender: 'female' },
];

const DURATION_OPTIONS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '4 min', seconds: 240 },
  { label: '5 min', seconds: 300 },
];

function getSessionTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const map: Record<string, string> = {
    cold_call: 'Cold Call',
    interview: 'Entrevista',
    entrevista: 'Entrevista',
    negotiation: 'Negociacao',
    negociacao: 'Negociacao',
    retention: 'Retencao',
    retencao: 'Retencao',
    prospeccao_consultiva: 'Prospeccao',
    apresentacao: 'Apresentacao',
  };
  return map[type] || type;
}

// Helper function to get difficulty label and color
function getDifficultyInfo(level: number): { label: string; color: string; bgColor: string } {
  if (level <= 3) {
    return { label: 'Facil', color: 'text-green-700', bgColor: 'bg-green-100' };
  } else if (level <= 6) {
    return { label: 'Medio', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  } else {
    return { label: 'Dificil', color: 'text-red-700', bgColor: 'bg-red-100' };
  }
}

export function ModeSelectionModal({ scenario, onStart, onCancel, difficultyLevel = 3 }: ModeSelectionModalProps) {
  const [selectedMode, setSelectedMode] = useState<SessionMode>(
    scenario.default_session_mode || 'training'
  );
  const defaultDuration = scenario.target_duration_seconds || 180;
  const [selectedDuration, setSelectedDuration] = useState(defaultDuration);

  const gender: CharacterGender = scenario.character_gender || 'male';
  const availableVoices = VOICE_OPTIONS.filter(v => v.gender === gender);
  const [selectedVoice, setSelectedVoice] = useState<AiVoice>(scenario.ai_voice || availableVoices[0]?.value || 'echo');

  const handleStart = () => {
    const voiceOverride = selectedVoice !== scenario.ai_voice ? selectedVoice : undefined;
    onStart(selectedMode, selectedDuration, voiceOverride);
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-black">{scenario.title}</h2>
              {scenario.character_name && (
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-medium">{scenario.character_name}</span>
                  {scenario.character_role && (
                    <span className="text-gray-500"> — {scenario.character_role}</span>
                  )}
                </p>
              )}
            </div>
            {scenario.session_type && (
              <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                {getSessionTypeLabel(scenario.session_type)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{scenario.context}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Difficulty Level Indicator */}
          {difficultyLevel && (
            <div className="mb-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">Nivel de Dificuldade</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold text-black">{difficultyLevel}</span>
                    <span className="text-gray-400">/10</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyInfo(difficultyLevel).bgColor} ${getDifficultyInfo(difficultyLevel).color}`}>
                      {getDifficultyInfo(difficultyLevel).label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-6 rounded-sm ${
                        i < difficultyLevel
                          ? difficultyLevel <= 3
                            ? 'bg-green-400'
                            : difficultyLevel <= 6
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {difficultyLevel <= 3 && 'O avatar sera mais receptivo e aceita argumentos facilmente.'}
                {difficultyLevel > 3 && difficultyLevel <= 6 && 'O avatar fara perguntas e apresentara objecoes moderadas.'}
                {difficultyLevel > 6 && 'O avatar sera exigente, pedindo provas e resistindo aos argumentos.'}
              </p>
            </div>
          )}

          {/* Duration Selector */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Duracao da sessao</h3>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  onClick={() => setSelectedDuration(opt.seconds)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    selectedDuration === opt.seconds
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selector */}
          {availableVoices.length > 1 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Voz do personagem</h3>
              <div className="flex gap-2">
                {availableVoices.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setSelectedVoice(v.value)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      selectedVoice === v.value
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
