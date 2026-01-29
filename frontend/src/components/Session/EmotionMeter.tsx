import { useEffect, useState, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

// Expanded from 5 to 8 emotion states for more precise detection
type EmotionState =
  | 'enthusiastic'  // NEW: Very interested, ready to act
  | 'happy'         // Satisfied, positive
  | 'receptive'     // Open, engaged
  | 'curious'       // NEW: Asking questions, seeking info
  | 'neutral'       // Evaluating
  | 'hesitant'      // Uncertain, has doubts
  | 'skeptical'     // NEW: Doubting, challenging
  | 'frustrated';   // Irritated, losing patience

type TrendType = 'improving' | 'declining' | 'stable';

interface EmotionConfig {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const EMOTIONS: Record<EmotionState, EmotionConfig> = {
  enthusiastic: {
    label: 'Entusiasmado',
    emoji: '🤩',
    color: 'text-green-300',
    bgColor: 'bg-green-400',
  },
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
  curious: {
    label: 'Curioso',
    emoji: '🤔',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500',
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
  skeptical: {
    label: 'Cetico',
    emoji: '🤨',
    color: 'text-orange-500',
    bgColor: 'bg-orange-600',
  },
  frustrated: {
    label: 'Frustrado',
    emoji: '😤',
    color: 'text-red-400',
    bgColor: 'bg-red-500',
  },
};

// Get emotion state from intensity value (updated for 8 states)
function getEmotionFromIntensity(intensity: number): EmotionState {
  if (intensity >= 95) return 'enthusiastic';
  if (intensity >= 82) return 'happy';
  if (intensity >= 68) return 'receptive';
  if (intensity >= 55) return 'curious';
  if (intensity >= 42) return 'neutral';
  if (intensity >= 28) return 'hesitant';
  if (intensity >= 12) return 'skeptical';
  return 'frustrated';
}

// Get color for intensity level (8-tier gradient)
function getIntensityColor(intensity: number): string {
  if (intensity >= 95) return 'bg-green-400';
  if (intensity >= 82) return 'bg-green-500';
  if (intensity >= 68) return 'bg-emerald-500';
  if (intensity >= 55) return 'bg-cyan-500';
  if (intensity >= 42) return 'bg-yellow-500';
  if (intensity >= 28) return 'bg-orange-500';
  if (intensity >= 12) return 'bg-orange-600';
  return 'bg-red-500';
}

export function EmotionMeter() {
  const room = useRoomContext();
  const [emotion, setEmotion] = useState<EmotionState>('neutral');
  const [targetIntensity, setTargetIntensity] = useState(50);
  const [displayIntensity, setDisplayIntensity] = useState(50);
  const [trend, setTrend] = useState<TrendType>('stable');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const reasonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth animation to target intensity (faster easing: 0.15)
  useEffect(() => {
    const animate = () => {
      setDisplayIntensity(prev => {
        const diff = targetIntensity - prev;
        if (Math.abs(diff) < 0.5) return targetIntensity;
        return prev + diff * 0.15; // Faster easing for more responsive feel
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
          // Stop processing animation when we get emotion data
          setIsProcessing(false);

          // Handle new format with intensity
          if (typeof data.intensity === 'number') {
            setTargetIntensity(data.intensity);
            setTrend(data.trend || 'stable');
            setIsStreaming(data.is_streaming || false);

            // Get emotion from value or intensity
            const newEmotion = (data.value && EMOTIONS[data.value as EmotionState])
              ? data.value as EmotionState
              : getEmotionFromIntensity(data.intensity);

            if (EMOTIONS[newEmotion] && newEmotion !== emotion) {
              setIsAnimating(true);
              setEmotion(newEmotion);
              setTimeout(() => setIsAnimating(false), 500);

              // Show reason if provided (and not streaming)
              if (data.reason && !data.is_streaming) {
                if (reasonTimeoutRef.current) {
                  clearTimeout(reasonTimeoutRef.current);
                }
                setReason(data.reason);
                reasonTimeoutRef.current = setTimeout(() => setReason(null), 4000);
              }
            }
          }
          // Handle legacy format (just value)
          else if (data.value && EMOTIONS[data.value as EmotionState]) {
            const newEmotion = data.value as EmotionState;
            const legacyIntensity: Record<EmotionState, number> = {
              enthusiastic: 100,
              happy: 88,
              receptive: 75,
              curious: 62,
              neutral: 50,
              hesitant: 35,
              skeptical: 20,
              frustrated: 0,
            };
            setTargetIntensity(legacyIntensity[newEmotion]);
            setTrend('stable');
            setIsStreaming(false);

            if (newEmotion !== emotion) {
              setIsAnimating(true);
              setEmotion(newEmotion);
              setTimeout(() => setIsAnimating(false), 500);
            }
          }
        }
        // Handle processing state (when user is speaking)
        else if (data.type === 'emotion_processing') {
          setIsProcessing(true);
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
        } ${isProcessing ? 'animate-pulse' : ''} ${isStreaming ? 'opacity-80' : ''}`}>
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

        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Streaming indicator (analyzing partial input) */}
        {isStreaming && !isProcessing && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75" />
          </div>
        )}
      </div>

      {/* Thermometer */}
      <div className={`relative w-6 h-32 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700 ${
        isProcessing ? 'ring-2 ring-yellow-400/50 ring-offset-1 ring-offset-neutral-900' : ''
      } ${isStreaming ? 'ring-1 ring-cyan-400/30' : ''}`}>
        {/* Gradient background - 8 tier */}
        <div className="absolute inset-0 opacity-30"
             style={{
               background: 'linear-gradient(to top, #ef4444, #ea580c, #f97316, #eab308, #06b6d4, #10b981, #22c55e, #4ade80)'
             }}
        />

        {/* Level indicator - now uses continuous intensity */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-colors duration-300 ${barColor} ${
            isStreaming ? 'opacity-80' : ''
          }`}
          style={{ height: `${displayIntensity}%` }}
        />

        {/* Marker lines - 8 levels */}
        {[0, 12, 28, 42, 55, 68, 82, 100].map((pos) => (
          <div
            key={pos}
            className="absolute left-0 right-0 h-px bg-neutral-600"
            style={{ bottom: `${pos}%` }}
          />
        ))}

        {/* Current position indicator */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 w-4 h-1 rounded-full shadow-lg transition-opacity ${
            isStreaming ? 'bg-white/70' : 'bg-white'
          }`}
          style={{ bottom: `calc(${displayIntensity}% - 2px)` }}
        />
      </div>

      {/* Label */}
      <div className={`text-xs font-medium ${config.color} transition-colors duration-300 ${
        isStreaming ? 'opacity-80' : ''
      }`}>
        {config.label}
        {isStreaming && <span className="ml-1 text-[10px] text-cyan-400">...</span>}
      </div>

      {/* Reason tooltip */}
      {reason && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-neutral-800 text-xs text-neutral-200 px-2 py-1 rounded-md whitespace-nowrap shadow-lg border border-neutral-700 animate-fade-in">
          {reason}
        </div>
      )}
    </div>
  );
}
