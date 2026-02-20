import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';

const SPIN_STAGES = ['S', 'P', 'I', 'N'] as const;

const SPIN_LABELS: Record<string, string> = {
  S: 'Situacao',
  P: 'Problema',
  I: 'Implicacao',
  N: 'Necessidade',
};

const SPIN_COLORS: Record<string, { active: string; inactive: string }> = {
  S: { active: 'bg-blue-500 text-white', inactive: 'bg-neutral-700 text-neutral-400' },
  P: { active: 'bg-orange-500 text-white', inactive: 'bg-neutral-700 text-neutral-400' },
  I: { active: 'bg-red-500 text-white', inactive: 'bg-neutral-700 text-neutral-400' },
  N: { active: 'bg-green-500 text-white', inactive: 'bg-neutral-700 text-neutral-400' },
};

/**
 * SessionCoachPanel displays real-time SPIN stage and conversation progress
 * based on participant attributes set by the agent.
 */
export function SessionCoachPanel() {
  const { spinStage, conversationProgress } = useParticipantAttributes();

  const activeStage = spinStage?.toUpperCase()?.charAt(0) || null;
  const progress = conversationProgress != null ? Math.round(conversationProgress * 100) : null;

  return (
    <div className="bg-neutral-900/80 backdrop-blur-sm rounded-xl p-3 border border-neutral-700 space-y-3">
      {/* SPIN Stage Indicator */}
      <div>
        <p className="text-xs text-neutral-400 mb-2">Estagio SPIN</p>
        <div className="flex gap-2">
          {SPIN_STAGES.map((stage) => {
            const isActive = activeStage === stage;
            const colors = SPIN_COLORS[stage];
            return (
              <div
                key={stage}
                className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-lg transition-all ${
                  isActive ? colors.active : colors.inactive
                }`}
                title={SPIN_LABELS[stage]}
              >
                <span className="text-sm font-bold">{stage}</span>
                <span className="text-[10px] opacity-80">{SPIN_LABELS[stage]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversation Progress */}
      {progress != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-neutral-400">Progresso</p>
            <span className="text-xs text-neutral-300 font-mono">{progress}%</span>
          </div>
          <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
