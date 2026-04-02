import type { TrainingTrack } from '../../types';

interface TrackCardProps {
  track: TrainingTrack;
  onClick: () => void;
}

export function TrackCard({ track, onClick }: TrackCardProps) {
  const totalScenarios = track.track_scenarios?.length ?? 0;
  const completedCount = track.progress?.completed_scenarios?.length ?? 0;
  const progressPct = totalScenarios > 0 ? Math.round((completedCount / totalScenarios) * 100) : 0;
  const isCompleted = track.progress?.completed_at != null;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white p-6 border-2 border-black
                 shadow-[4px_4px_0px_#000] hover:shadow-[4px_4px_0px_#FACC15]
                 transition-all duration-200 cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-xl font-bold text-black">{track.title}</h3>
        {track.category && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider">
            {track.category}
          </span>
        )}
      </div>

      {/* Description */}
      {track.description && (
        <p className="text-black text-sm mb-4 line-clamp-2">{track.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs font-bold mb-1">
          <span className="text-black uppercase tracking-wider">
            {completedCount} de {totalScenarios} cenarios
          </span>
          <span className={isCompleted ? 'text-green-600' : 'text-black'}>
            {isCompleted ? 'CONCLUIDA' : `${progressPct}%`}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 border border-black">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted ? 'bg-green-500' : 'bg-yellow-400'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {totalScenarios > 0 && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-black font-bold border border-black uppercase tracking-wider">
              {totalScenarios} cenarios
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-black group-hover:text-yellow-600 transition-colors">
          {isCompleted ? 'Revisar' : completedCount > 0 ? 'Continuar' : 'Iniciar'} &rarr;
        </span>
      </div>
    </button>
  );
}
