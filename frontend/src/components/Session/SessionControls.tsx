import { useState, useEffect, useCallback } from 'react';
import { PauseModal } from './PauseModal';

interface SessionControlsProps {
  onEndSession: () => void;
  maxDuration?: number;
}

export function SessionControls({ onEndSession, maxDuration = 180 }: SessionControlsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

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
  }, [maxDuration, onEndSession, isPaused]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to pause/resume (only when body is focused)
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
      // Escape to end (when not paused)
      if (e.key === 'Escape' && !isPaused) {
        handleEndClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused]);

  const handleEndClick = useCallback(() => {
    setIsEnding(true);
    onEndSession();
  }, [onEndSession]);

  const handlePauseClick = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResumeClick = useCallback(() => {
    setIsPaused(false);
  }, []);

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
    <>
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
              {isPaused
                ? 'Sessao pausada'
                : remaining > 30
                ? 'Tempo restante'
                : remaining > 10
                ? 'Finalize em breve'
                : 'Encerrando...'}
            </p>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3">
            {/* Pause Button */}
            <button
              onClick={handlePauseClick}
              disabled={isEnding}
              className="flex-1 py-4 rounded-lg font-semibold text-lg transition-all
                         bg-neutral-800 text-white hover:bg-neutral-700 active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pausar
            </button>

            {/* End Session Button */}
            <button
              onClick={handleEndClick}
              disabled={isEnding}
              className={`flex-1 py-4 rounded-lg font-semibold text-lg transition-all ${
                isEnding
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-400 text-black hover:bg-yellow-500 active:scale-[0.98]'
              }`}
            >
              {isEnding ? 'Encerrando...' : 'Encerrar'}
            </button>
          </div>

          {/* Microphone indicator */}
          <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-sm">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span>{isPaused ? 'Microfone pausado' : 'Microfone ativo'}</span>
            <span className="text-neutral-600 ml-2">|</span>
            <span className="text-neutral-500 text-xs">Espaco para pausar</span>
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      <PauseModal
        isOpen={isPaused}
        onClose={handleResumeClick}
        onEndSession={handleEndClick}
      />
    </>
  );
}
