interface TrackProgressProps {
  current: number;
  total: number;
  completedAt: string | null;
}

export function TrackProgress({ current, total, completedAt }: TrackProgressProps) {
  const isComplete = completedAt != null;

  return (
    <div className="flex items-center gap-3">
      {/* Step indicators */}
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum <= current;
          return (
            <div
              key={i}
              className={`w-8 h-2 border border-black ${
                isDone
                  ? isComplete ? 'bg-green-500' : 'bg-yellow-400'
                  : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap">
        {isComplete ? 'Concluida' : `${current}/${total}`}
      </span>
    </div>
  );
}
