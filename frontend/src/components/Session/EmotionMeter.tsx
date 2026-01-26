import { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

type EmotionState = 'happy' | 'receptive' | 'neutral' | 'hesitant' | 'frustrated';
type TrendType = 'improving' | 'declining' | 'stable';

interface EmotionConfig {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const EMOTIONS: Record<EmotionState, EmotionConfig> = {
  happy: {
    label: 'Satisfeito',
    emoji: '😊',
    color: 'text-green-400',
    bgColor: 'bg-green-500',
  },
  receptive: {
    label: 'Receptivo',
    emoji: '🙂',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500',
  },
  neutral: {
    label: 'Neutro',
    emoji: '😐',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
  },
  hesitant: {
    label: 'Hesitante',
    emoji: '😕',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
  },
  frustrated: {
    label: 'Frustrado',
    emoji: '😤',
    color: 'text-red-400',
    bgColor: 'bg-red-500',
  },
};

// Get emotion state from intensity value
function getEmotionFromIntensity(intensity: number): EmotionState {
  if (intensity >= 88) return 'happy';
  if (intensity >= 63) return 'receptive';
  if (intensity >= 38) return 'neutral';
  if (intensity >= 13) return 'hesitant';
  return 'frustrated';
}

// Get color for intensity level
function getIntensityColor(intensity: number): string {
  if (intensity >= 88) return 'bg-green-500';
  if (intensity >= 63) return 'bg-emerald-500';
  if (intensity >= 38) return 'bg-yellow-500';
  if (intensity >= 13) return 'bg-orange-500';
  return 'bg-red-500';
}

export function EmotionMeter() {
  const room = useRoomContext();
  const [emotion, setEmotion] = useState<EmotionState>('neutral');
  const [targetIntensity, setTargetIntensity] = useState(50);
  const [displayIntensity, setDisplayIntensity] = useState(50);
  const [trend, setTrend] = useState<TrendType>('stable');
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);

  // Smooth animation to target intensity
  useEffect(() => {
    const animate = () => {
      setDisplayIntensity(prev => {
        const diff = targetIntensity - prev;
        if (Math.abs(diff) < 0.5) return targetIntensity;
        return prev + diff * 0.08; // Smooth easing
      });

      if (Math.abs(displayIntensity - targetIntensity) > 0.5) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetIntensity, displayIntensity]);

  // Listen for emotion updates from agent
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'emotion') {
          // Handle new format with intensity
          if (typeof data.intensity === 'number') {
            setTargetIntensity(data.intensity);
            setTrend(data.trend || 'stable');

            // Get emotion from intensity if not provided
            const newEmotion = data.value as EmotionState || getEmotionFromIntensity(data.intensity);
            if (EMOTIONS[newEmotion] && newEmotion !== emotion) {
              setIsAnimating(true);
              setEmotion(newEmotion);
              setTimeout(() => setIsAnimating(false), 500);
            }
          }
          // Handle legacy format (just value)
          else if (data.value && EMOTIONS[data.value as EmotionState]) {
            const newEmotion = data.value as EmotionState;
            const legacyIntensity: Record<EmotionState, number> = {
              happy: 100,
              receptive: 75,
              neutral: 50,
              hesitant: 25,
              frustrated: 0,
            };
            setTargetIntensity(legacyIntensity[newEmotion]);
            setTrend('stable');

            if (newEmotion !== emotion) {
              setIsAnimating(true);
              setEmotion(newEmotion);
              setTimeout(() => setIsAnimating(false), 500);
            }
          }
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, emotion]);

  const config = EMOTIONS[emotion];
  const barColor = getIntensityColor(displayIntensity);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Emoji indicator with trend */}
      <div className="relative">
        <div className={`text-3xl transition-transform duration-300 ${
          isAnimating ? 'scale-125' : 'scale-100'
        }`}>
          {config.emoji}
        </div>

        {/* Trend indicator */}
        <div className={`absolute -right-4 top-0 text-lg font-bold transition-all duration-300 ${
          trend === 'improving' ? 'text-green-400' :
          trend === 'declining' ? 'text-red-400' :
          'text-neutral-500'
        }`}>
          {trend === 'improving' && '↑'}
          {trend === 'declining' && '↓'}
          {trend === 'stable' && '→'}
        </div>
      </div>

      {/* Thermometer */}
      <div className="relative w-6 h-32 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
        {/* Gradient background */}
        <div className="absolute inset-0 opacity-30"
             style={{
               background: 'linear-gradient(to top, #ef4444, #f97316, #eab308, #22c55e, #10b981)'
             }}
        />

        {/* Level indicator - now uses continuous intensity */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-colors duration-300 ${barColor}`}
          style={{ height: `${displayIntensity}%` }}
        />

        {/* Marker lines */}
        {[0, 25, 50, 75, 100].map((pos) => (
          <div
            key={pos}
            className="absolute left-0 right-0 h-px bg-neutral-600"
            style={{ bottom: `${pos}%` }}
          />
        ))}

        {/* Current position indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-1 bg-white rounded-full shadow-lg"
          style={{ bottom: `calc(${displayIntensity}% - 2px)` }}
        />
      </div>

      {/* Label */}
      <div className={`text-xs font-medium ${config.color} transition-colors duration-300`}>
        {config.label}
      </div>
    </div>
  );
}
