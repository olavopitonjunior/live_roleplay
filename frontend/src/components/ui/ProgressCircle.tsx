import { useEffect, useState } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  animate?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-yellow-400';
  if (score >= 50) return 'bg-gray-400';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente';
  if (score >= 80) return 'Muito bom';
  if (score >= 70) return 'Bom';
  if (score >= 60) return 'Regular';
  return 'Precisa melhorar';
}

export function ProgressCircle({
  value,
  max = 100,
  size = 'lg',
  showValue = true,
  animate = true,
  className = '',
}: ProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  const percentage = (displayValue / max) * 100;
  const barColor = getScoreColor(value);

  const sizeConfig = {
    sm: { number: 'text-2xl', label: 'text-sm', bar: 'h-2' },
    md: { number: 'text-4xl', label: 'text-base', bar: 'h-3' },
    lg: { number: 'text-6xl', label: 'text-lg', bar: 'h-4' },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    let frame: number;
    const duration = 1000;
    const startTime = performance.now();

    const animateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(value * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        frame = requestAnimationFrame(animateValue);
      }
    };

    frame = requestAnimationFrame(animateValue);

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, animate]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {showValue && (
        <div className="text-center mb-6">
          <span
            className={`font-bold ${config.number} ${value >= 70 ? 'text-yellow-500' : 'text-black'}`}
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {displayValue}
          </span>
          <span className={`text-gray-400 ${config.label} ml-1`} style={{ fontFamily: "'Space Mono', monospace" }}>
            /{max}
          </span>
        </div>
      )}

      {/* Progress bar — brutalist */}
      <div className={`w-full max-w-xs bg-gray-200 border-2 border-black ${config.bar}`}>
        <div
          className={`${config.bar} ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Label */}
      {size === 'lg' && (
        <div className="mt-4 text-center">
          <p className="text-xl font-bold text-black uppercase tracking-tight">{getScoreLabel(value)}</p>
          <p className="text-gray-500 mt-1">Sua performance neste treino</p>
        </div>
      )}
    </div>
  );
}

export { getScoreColor, getScoreLabel };

export function getScoreEmoji(_score: number): string {
  return '';
}
