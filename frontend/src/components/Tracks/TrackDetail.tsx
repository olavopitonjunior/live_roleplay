import type { TrainingTrack, TrackScenario, TrackCompletedScenario } from '../../types';
import { TrackProgress } from './TrackProgress';

interface TrackDetailProps {
  track: TrainingTrack;
  onStartScenario: (scenarioId: string, trackScenarioId: string, position: number) => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
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

export function TrackDetail({ track, onStartScenario }: TrackDetailProps) {
  const scenarios = track.track_scenarios || [];
  const completedMap = new Map<string, TrackCompletedScenario>();
  for (const c of track.progress?.completed_scenarios || []) {
    completedMap.set(c.scenario_id, c);
  }

  const currentPosition = track.progress?.current_position ?? 0;
  const totalScenarios = scenarios.length;
  const completedCount = completedMap.size;

  return (
    <div>
      {/* Track header */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-bold text-black">{track.title}</h1>
            {track.description && (
              <p className="text-black text-sm mt-1">{track.description}</p>
            )}
          </div>
          {track.category && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
              {track.category}
            </span>
          )}
        </div>
        <div className="mt-4">
          <TrackProgress
            current={completedCount}
            total={totalScenarios}
            completedAt={track.progress?.completed_at ?? null}
          />
        </div>
      </div>

      {/* Scenario timeline */}
      <div className="space-y-0">
        {scenarios.map((ts: TrackScenario, index: number) => {
          const scenario = ts.scenarios;
          if (!scenario) return null;

          const completed = completedMap.get(ts.scenario_id);
          const isAvailable = !completed && (index === 0 || completedMap.has(scenarios[index - 1]?.scenario_id));
          const isLocked = !completed && !isAvailable;

          return (
            <div key={ts.id} className="flex gap-4">
              {/* Timeline line + node */}
              <div className="flex flex-col items-center w-8 shrink-0">
                <div
                  className={`w-8 h-8 border-2 border-black flex items-center justify-center font-bold text-sm ${
                    completed
                      ? 'bg-green-500 text-white'
                      : isAvailable
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {completed ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    ts.position
                  )}
                </div>
                {index < scenarios.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[24px] ${
                    completed ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>

              {/* Scenario card */}
              <div
                className={`flex-1 mb-4 p-4 border-2 border-black transition-all ${
                  isLocked
                    ? 'bg-gray-100 opacity-60'
                    : completed
                      ? 'bg-white shadow-[2px_2px_0px_#000]'
                      : 'bg-white shadow-[4px_4px_0px_#000]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className={`font-bold ${isLocked ? 'text-gray-400' : 'text-black'}`}>
                    {scenario.title}
                  </h3>
                  <div className="flex gap-1">
                    {scenario.session_type && SESSION_TYPE_LABELS[scenario.session_type] && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
                        {SESSION_TYPE_LABELS[scenario.session_type]}
                      </span>
                    )}
                    {!ts.is_required && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-600 font-bold border border-gray-400 uppercase tracking-wider">
                        Opcional
                      </span>
                    )}
                  </div>
                </div>

                {/* Character info */}
                {scenario.character_name && (
                  <p className={`text-sm mb-2 ${isLocked ? 'text-gray-400' : 'text-black'}`}>
                    {scenario.character_name}
                    {scenario.character_role && ` — ${scenario.character_role}`}
                  </p>
                )}

                {/* Skills badges */}
                {ts.skills_expected.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {ts.skills_expected.map((skill, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-300 uppercase tracking-wider">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Score (if completed) or action button */}
                <div className="flex items-center justify-between mt-2">
                  {completed ? (
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${
                        completed.score >= 75 ? 'text-green-600' :
                        completed.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        Score: {completed.score}%
                      </span>
                      <button
                        onClick={() => onStartScenario(ts.scenario_id, ts.id, ts.position)}
                        className="text-xs font-bold text-black hover:text-yellow-600 underline transition-colors"
                      >
                        Refazer
                      </button>
                    </div>
                  ) : isAvailable ? (
                    <button
                      onClick={() => onStartScenario(ts.scenario_id, ts.id, ts.position)}
                      className="px-4 py-2 bg-yellow-400 text-black font-bold text-sm border-2 border-black
                                 shadow-[4px_4px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1
                                 transition-all uppercase tracking-wider"
                    >
                      Iniciar Cenario
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs font-bold uppercase tracking-wider">Bloqueado</span>
                    </div>
                  )}
                  <div />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
