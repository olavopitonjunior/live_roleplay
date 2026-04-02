import { useState } from 'react';
import type { Scenario, SessionMode, AiVoice, CharacterGender, PresentationData } from '../../types';
import { usePresentation } from '../../hooks/usePresentation';
import { PresentationUpload } from './PresentationUpload';
import { useAuth } from '../../hooks/useAuth';

interface ModeSelectionModalProps {
  scenario: Scenario;
  onStart: (mode: SessionMode, durationSeconds: number, voiceOverride?: AiVoice, presentationData?: PresentationData) => void;
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
  const { accessCode } = useAuth();
  const [selectedMode, setSelectedMode] = useState<SessionMode>(
    scenario.default_session_mode || 'training'
  );
  const defaultDuration = scenario.target_duration_seconds || 180;
  const [selectedDuration, setSelectedDuration] = useState(defaultDuration);
  const [showPresentation, setShowPresentation] = useState(false);

  const gender: CharacterGender = scenario.character_gender || 'male';
  const availableVoices = VOICE_OPTIONS.filter(v => v.gender === gender);
  const [selectedVoice, setSelectedVoice] = useState<AiVoice>(scenario.ai_voice || availableVoices[0]?.value || 'echo');

  const {
    presentationData,
    isProcessing,
    processingStatus,
    error: presentationError,
    uploadPdf,
    removePresentation,
  } = usePresentation();

  const handleStart = () => {
    const voiceOverride = selectedVoice !== scenario.ai_voice ? selectedVoice : undefined;
    onStart(selectedMode, selectedDuration, voiceOverride, presentationData ?? undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white border-2 border-black shadow-[8px_8px_0px_#000] max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b-2 border-black">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-black uppercase tracking-tight">{scenario.title}</h2>
              {scenario.character_name && (
                <p className="text-sm text-black mt-1">
                  <span className="font-medium">{scenario.character_name}</span>
                  {scenario.character_role && (
                    <span className="text-black"> — {scenario.character_role}</span>
                  )}
                </p>
              )}
            </div>
            {scenario.session_type && (
              <span className="shrink-0 text-xs px-2.5 py-1 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
                {getSessionTypeLabel(scenario.session_type)}
              </span>
            )}
          </div>
          <p className="text-sm text-black mt-2 line-clamp-2">{scenario.context}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Difficulty Level Indicator */}
          {difficultyLevel && (
            <div className="mb-5 p-4 bg-white border-2 border-black">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black uppercase font-mono font-medium tracking-wider">Nivel de Dificuldade</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{difficultyLevel}</span>
                    <span className="text-black font-mono">/10</span>
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
              <p className="text-xs text-black font-mono mt-2">
                {difficultyLevel <= 3 && 'O avatar sera mais receptivo e aceita argumentos facilmente.'}
                {difficultyLevel > 3 && difficultyLevel <= 6 && 'O avatar fara perguntas e apresentara objecoes moderadas.'}
                {difficultyLevel > 6 && 'O avatar sera exigente, pedindo provas e resistindo aos argumentos.'}
              </p>
            </div>
          )}

          {/* Duration Selector */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-black mb-3 uppercase tracking-wider font-mono">Duracao da sessao</h3>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  onClick={() => setSelectedDuration(opt.seconds)}
                  className={`flex-1 py-2 px-3 text-sm font-bold transition-all border-2 border-black ${
                    selectedDuration === opt.seconds
                      ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_#000]'
                      : 'bg-white text-black hover:bg-gray-100'
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
              <h3 className="text-sm font-bold text-black mb-3 uppercase tracking-wider font-mono">Voz do personagem</h3>
              <div className="flex gap-2">
                {availableVoices.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setSelectedVoice(v.value)}
                    className={`flex-1 py-2 px-3 text-sm font-bold transition-all border-2 border-black ${
                      selectedVoice === v.value
                        ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_#000]'
                        : 'bg-white text-black hover:bg-gray-100'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-sm font-bold text-black mb-4 uppercase tracking-wider font-mono">Selecione o modo</h3>

          {/* Mode Selection */}
          <div className="space-y-3">
            {/* Training Mode */}
            <button
              onClick={() => setSelectedMode('training')}
              className={`w-full p-4 border-2 text-left transition-all ${
                selectedMode === 'training'
                  ? 'border-black bg-yellow-400 shadow-[4px_4px_0px_#000]'
                  : 'border-black hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'training'
                      ? 'border-black bg-black'
                      : 'border-black'
                  }`}
                >
                  {selectedMode === 'training' && (
                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
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
                    <span className="font-bold text-black uppercase tracking-wider">Modo Treino</span>
                    <span className="text-xs px-2 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-sm text-black mt-1">
                    Receba dicas em tempo real durante a conversa. Ideal para aprender e
                    praticar novas tecnicas.
                  </p>
                </div>
              </div>
            </button>

            {/* Evaluation Mode */}
            <button
              onClick={() => setSelectedMode('evaluation')}
              className={`w-full p-4 border-2 text-left transition-all ${
                selectedMode === 'evaluation'
                  ? 'border-black bg-yellow-400 shadow-[4px_4px_0px_#000]'
                  : 'border-black hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMode === 'evaluation'
                      ? 'border-black bg-black'
                      : 'border-black'
                  }`}
                >
                  {selectedMode === 'evaluation' && (
                    <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
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
                    <span className="font-bold text-black uppercase tracking-wider">Modo Avaliacao</span>
                    <span className="text-xs px-2 py-0.5 bg-white text-black font-bold border border-black uppercase tracking-wider">
                      Teste real
                    </span>
                  </div>
                  <p className="text-sm text-black mt-1">
                    Sem dicas durante a sessao. Avalie seu desempenho real em uma
                    simulacao mais realista.
                  </p>
                </div>
              </div>
            </button>
          </div>

        </div>

        {/* Presentation Upload (collapsible) */}
        <div className="px-6 py-4 border-t-2 border-black">
          <button
            onClick={() => setShowPresentation(!showPresentation)}
            className="flex items-center gap-2 text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider w-full"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showPresentation ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Apresentacao (opcional)
            {presentationData && (
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 font-bold border border-green-300 uppercase tracking-wider ml-auto">
                {presentationData.total_slides} slides
              </span>
            )}
          </button>
          {showPresentation && (
            <div className="mt-3">
              <PresentationUpload
                onUpload={(file) => uploadPdf(file, accessCode?.code ?? null)}
                onRemove={removePresentation}
                presentationData={presentationData}
                isProcessing={isProcessing}
                processingStatus={processingStatus}
                error={presentationError}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t-2 border-black flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 font-bold text-black bg-white border-2 border-black hover:bg-gray-100 transition-colors uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 px-4 font-bold text-black bg-yellow-400 border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase tracking-wider"
          >
            Iniciar Sessao
          </button>
        </div>
      </div>
    </div>
  );
}
