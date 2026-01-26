import { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

interface CoachingHint {
  id: string;
  type: 'encouragement' | 'warning' | 'suggestion' | 'reminder' | 'objection';
  title: string;
  message: string;
  priority: number;
  methodology_step?: string;
  timestamp: string;
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
  addressed: boolean;
  timestamp: string;
}

interface CoachingState {
  methodology: MethodologyProgress;
  objections: Objection[];
  addressed_objections: Objection[];
  recent_hints: CoachingHint[];
  talk_ratio: number;
  user_word_count: number;
  avatar_word_count: number;
}

const HINT_ICONS: Record<string, string> = {
  encouragement: '🎯',
  warning: '⚠️',
  suggestion: '💡',
  reminder: '📋',
  objection: '🚨',
};

const HINT_COLORS: Record<string, string> = {
  encouragement: 'border-green-500 bg-green-500/10',
  warning: 'border-orange-500 bg-orange-500/10',
  suggestion: 'border-blue-500 bg-blue-500/10',
  reminder: 'border-purple-500 bg-purple-500/10',
  objection: 'border-red-500 bg-red-500/10',
};

const METHODOLOGY_LABELS: Record<string, string> = {
  situation: 'Situacao',
  problem: 'Problema',
  implication: 'Implicacao',
  need_payoff: 'Necessidade',
};

const OBJECTION_LABELS: Record<string, string> = {
  price: 'Preco',
  timing: 'Timing',
  need: 'Necessidade',
  authority: 'Autoridade',
  trust: 'Confianca',
};

export function CoachingPanel() {
  const room = useRoomContext();
  const [hints, setHints] = useState<CoachingHint[]>([]);
  const [state, setState] = useState<CoachingState | null>(null);
  const [latestHint, setLatestHint] = useState<CoachingHint | null>(null);
  const hintsRef = useRef<HTMLDivElement>(null);

  // Listen for coaching data
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        // Handle new coaching hint
        if (data.type === 'coaching_hint') {
          const hint: CoachingHint = {
            id: data.id,
            type: data.type === 'coaching_hint' ? data.type : data.type,
            title: data.title,
            message: data.message,
            priority: data.priority,
            methodology_step: data.methodology_step,
            timestamp: data.timestamp,
          };
          // Fix: extract the actual hint type from the nested data
          hint.type = data.type === 'coaching_hint'
            ? (data as { type: string; id: string; title: string; message: string; priority: number; methodology_step?: string; timestamp: string }).type
            : data.type;

          // Parse the hint type from the full data object
          const hintData = data as CoachingHint & { type: string };
          const actualType = ['encouragement', 'warning', 'suggestion', 'reminder', 'objection'].find(
            t => data[t] || data.type === t
          ) || 'suggestion';

          setHints(prev => {
            const newHints = [...prev, { ...hint, type: actualType as CoachingHint['type'] }];
            return newHints.slice(-10); // Keep last 10 hints
          });
          setLatestHint({ ...hint, type: actualType as CoachingHint['type'] });

          // Auto-clear latest hint after 5 seconds
          setTimeout(() => setLatestHint(null), 5000);
        }

        // Handle full coaching state update
        if (data.type === 'coaching_state') {
          setState({
            methodology: data.methodology,
            objections: data.objections || [],
            addressed_objections: data.addressed_objections || [],
            recent_hints: data.recent_hints || [],
            talk_ratio: data.talk_ratio || 50,
            user_word_count: data.user_word_count || 0,
            avatar_word_count: data.avatar_word_count || 0,
          });
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Auto-scroll hints
  useEffect(() => {
    if (hintsRef.current) {
      hintsRef.current.scrollTop = hintsRef.current.scrollHeight;
    }
  }, [hints]);

  const talkRatio = state?.talk_ratio ?? 50;
  const methodology = state?.methodology;
  const objections = state?.objections ?? [];

  return (
    <div className="h-full flex flex-col bg-neutral-900 text-white overflow-hidden">
      {/* Latest Hint Banner */}
      {latestHint && (
        <div className={`p-3 border-l-4 ${HINT_COLORS[latestHint.type]} animate-fade-in`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{HINT_ICONS[latestHint.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-white">{latestHint.title}</p>
              <p className="text-xs text-neutral-300 mt-0.5">{latestHint.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Methodology Tracker (SPIN) */}
        {methodology && (
          <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Metodologia SPIN
              </h3>
              <span className="text-xs text-primary-400 font-medium">
                {methodology.completion_percentage}%
              </span>
            </div>
            <div className="space-y-2">
              {(['situation', 'problem', 'implication', 'need_payoff'] as const).map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    methodology[step]
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-700 text-neutral-500'
                  }`}>
                    {methodology[step] ? (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    methodology[step] ? 'text-green-400' : 'text-neutral-400'
                  }`}>
                    {METHODOLOGY_LABELS[step]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Objections */}
        {objections.length > 0 && (
          <div className="bg-neutral-800/50 rounded-lg p-3 border border-red-500/30">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>🚨</span>
              Objecoes Pendentes ({objections.length})
            </h3>
            <ul className="space-y-2">
              {objections.map((obj) => (
                <li key={obj.id} className="text-sm text-neutral-300 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <div>
                    <span className="text-xs text-red-400 font-medium">
                      {OBJECTION_LABELS[obj.category] || obj.category}:
                    </span>
                    <p className="text-neutral-400 text-xs mt-0.5 line-clamp-2">{obj.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Talk Ratio */}
        <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Talk Ratio
            </h3>
            <span className={`text-xs font-medium ${
              talkRatio >= 30 && talkRatio <= 50 ? 'text-green-400' :
              talkRatio > 50 && talkRatio <= 60 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {talkRatio}% voce
            </span>
          </div>
          <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                talkRatio >= 30 && talkRatio <= 50 ? 'bg-green-500' :
                talkRatio > 50 && talkRatio <= 60 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${talkRatio}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-neutral-500">
            <span>0%</span>
            <span className="text-green-400">30-50% ideal</span>
            <span>100%</span>
          </div>
        </div>

        {/* Hint History */}
        {hints.length > 0 && (
          <div className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Historico de Dicas
            </h3>
            <div ref={hintsRef} className="space-y-2 max-h-40 overflow-y-auto">
              {hints.map((hint) => (
                <div key={hint.id} className="flex items-start gap-2 text-xs">
                  <span>{HINT_ICONS[hint.type] || '💡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-300 font-medium">{hint.title}</p>
                    <p className="text-neutral-500 text-[10px] mt-0.5 line-clamp-1">{hint.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!methodology && hints.length === 0 && (
          <div className="text-center py-8 text-neutral-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">Dicas de coaching aparecao aqui</p>
            <p className="text-xs mt-1">durante a conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}
