import { useState, useEffect, useCallback } from 'react';

interface SessionControlsProps {
  onEndSession: () => void;
  maxDuration?: number;
}

export function SessionControls({ onEndSession, maxDuration = 180 }: SessionControlsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxDuration) {
          clearInterval(interval);
          onEndSession();
          return prev;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [maxDuration, onEndSession]);

  const handleEndClick = useCallback(() => {
    setIsEnding(true);
    onEndSession();
  }, [onEndSession]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remaining = maxDuration - elapsed;
  const isWarning = remaining <= 30;
  const isCritical = remaining <= 10;
  const progress = (elapsed / maxDuration) * 100;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
      <div className="max-w-lg mx-auto">
        {/* Timer */}
        <div className="text-center mb-6">
          <span
            className={`text-5xl font-mono font-bold transition-colors ${
              isCritical
                ? 'text-red-500'
                : isWarning
                ? 'text-yellow-400'
                : 'text-yellow-400'
            }`}
          >
            {formatTime(remaining)}
          </span>

          {/* Progress bar */}
          <div className="w-full h-1 bg-white/10 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                isCritical ? 'bg-red-500' : 'bg-yellow-400'
              }`}
              style={{ width: `${100 - progress}%` }}
            />
          </div>

          <p className="text-gray-400 text-sm mt-3">
            {remaining > 30
              ? 'Tempo restante'
              : remaining > 10
              ? 'Finalize em breve'
              : 'Encerrando...'}
          </p>
        </div>

        {/* End Session Button */}
        <button
          onClick={handleEndClick}
          disabled={isEnding}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
            isEnding
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-yellow-400 text-black hover:bg-yellow-500 active:scale-[0.98]'
          }`}
        >
          {isEnding ? 'Encerrando...' : 'Encerrar Sessao'}
        </button>

        {/* Microphone indicator */}
        <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Microfone ativo</span>
        </div>
      </div>
    </div>
  );
}
