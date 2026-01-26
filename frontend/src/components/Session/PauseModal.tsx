import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

interface CoachingHint {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: number;
  methodology_step?: string;
}

interface MethodologyProgress {
  situation: boolean;
  problem: boolean;
  implication: boolean;
  need_payoff: boolean;
  completion_percentage: number;
}

interface Objection {
  id: string;
  text: string;
  category: string;
}

interface PauseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEndSession: () => void;
}

const METHODOLOGY_TIPS: Record<string, string> = {
  situation: 'Pergunte: "Como voces fazem [processo] hoje?"',
  problem: 'Pergunte: "Qual seu maior desafio com isso?"',
  implication: 'Pergunte: "Como isso afeta [metrica importante]?"',
  need_payoff: 'Pergunte: "E se voce pudesse resolver isso em [tempo]?"',
};

const OBJECTION_TIPS: Record<string, string> = {
  price: 'Mostre o ROI ou divida o valor em parcelas menores.',
  timing: 'Crie urgencia: "Quanto custa esperar mais um mes?"',
  need: 'Relembre os problemas que o cliente mencionou.',
  authority: 'Pergunte como voce pode ajudar no processo de decisao.',
  trust: 'Mencione cases de sucesso ou ofereca um trial.',
};

export function PauseModal({ isOpen, onClose, onEndSession }: PauseModalProps) {
  const room = useRoomContext();
  const [methodology, setMethodology] = useState<MethodologyProgress | null>(null);
  const [objections, setObjections] = useState<Objection[]>([]);
  const [recentHints, setRecentHints] = useState<CoachingHint[]>([]);
  const [talkRatio, setTalkRatio] = useState(50);

  // Listen for coaching state
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'coaching_state') {
          setMethodology(data.methodology);
          setObjections(data.objections || []);
          setRecentHints(data.recent_hints || []);
          setTalkRatio(data.talk_ratio || 50);
        }
      } catch {
        // Ignore
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Find next methodology step to complete
  const nextStep = methodology
    ? !methodology.situation ? 'situation'
    : !methodology.problem ? 'problem'
    : !methodology.implication ? 'implication'
    : !methodology.need_payoff ? 'need_payoff'
    : null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-neutral-900 rounded-2xl border border-neutral-700 shadow-2xl animate-fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Sessao Pausada</h2>
              <p className="text-sm text-neutral-400">Revise seu progresso e retome</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Primary Suggestion */}
          {(nextStep || objections.length > 0) && (
            <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
              <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span>💡</span> Proximo Passo Sugerido
              </h3>
              {objections.length > 0 ? (
                <div>
                  <p className="text-white font-medium">Responda a objecao de {objections[0].category}</p>
                  <p className="text-neutral-300 text-sm mt-1">
                    {OBJECTION_TIPS[objections[0].category] || 'Tente entender melhor a preocupacao do cliente.'}
                  </p>
                </div>
              ) : nextStep ? (
                <div>
                  <p className="text-white font-medium">Avance na metodologia SPIN</p>
                  <p className="text-neutral-300 text-sm mt-1">
                    {METHODOLOGY_TIPS[nextStep]}
                  </p>
                </div>
              ) : (
                <p className="text-white">Continue a conversa naturalmente!</p>
              )}
            </div>
          )}

          {/* Methodology Progress */}
          {methodology && (
            <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                  Progresso SPIN
                </h3>
                <span className="text-sm font-medium text-primary-400">
                  {methodology.completion_percentage}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['situation', 'problem', 'implication', 'need_payoff'] as const).map((step) => (
                  <div
                    key={step}
                    className={`p-2 rounded-lg text-center ${
                      methodology[step]
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-neutral-700/50 border border-neutral-600'
                    }`}
                  >
                    <div className={`text-xl ${methodology[step] ? '' : 'opacity-50'}`}>
                      {methodology[step] ? '✓' : step[0].toUpperCase()}
                    </div>
                    <div className={`text-[10px] mt-1 ${methodology[step] ? 'text-green-400' : 'text-neutral-500'}`}>
                      {step === 'need_payoff' ? 'Need' : step.charAt(0).toUpperCase() + step.slice(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Objections */}
          {objections.length > 0 && (
            <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
                Objecoes Pendentes ({objections.length})
              </h3>
              <ul className="space-y-2">
                {objections.slice(0, 3).map((obj) => (
                  <li key={obj.id} className="text-sm text-neutral-300">
                    <span className="text-red-400 font-medium">{obj.category}:</span>{' '}
                    <span className="text-neutral-400">"{obj.text.slice(0, 60)}..."</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Talk Ratio */}
          <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                Talk Ratio
              </h3>
              <span className={`text-sm font-medium ${
                talkRatio >= 30 && talkRatio <= 50 ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {talkRatio}% voce
              </span>
            </div>
            <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  talkRatio >= 30 && talkRatio <= 50 ? 'bg-green-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${talkRatio}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {talkRatio < 30
                ? 'Voce esta muito quieto. Faca mais perguntas!'
                : talkRatio > 50
                ? 'Voce esta falando muito. Deixe o cliente falar mais.'
                : 'Otimo equilibrio! Continue assim.'}
            </p>
          </div>

          {/* Recent Hints */}
          {recentHints.length > 0 && (
            <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Dicas Recentes
              </h3>
              <ul className="space-y-2">
                {recentHints.slice(-3).map((hint) => (
                  <li key={hint.id} className="text-sm flex items-start gap-2">
                    <span className="text-primary-400">•</span>
                    <span className="text-neutral-300">{hint.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-neutral-700 flex gap-3">
          <button
            onClick={onEndSession}
            className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 text-neutral-300 font-medium
                       hover:bg-neutral-700 transition-colors"
          >
            Encerrar Sessao
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-yellow-500 text-black font-semibold
                       hover:bg-yellow-400 transition-colors"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
