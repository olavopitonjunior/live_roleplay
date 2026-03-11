import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

type EmotionState =
  | 'enthusiastic'
  | 'happy'
  | 'receptive'
  | 'curious'
  | 'neutral'
  | 'hesitant'
  | 'skeptical'
  | 'frustrated';

interface EmotionVisuals {
  borderColor: string;
  glowColor: string;
  icon: string;
  pulseColor: string;
}

const EMOTION_VISUALS: Record<EmotionState, EmotionVisuals> = {
  enthusiastic: {
    borderColor: 'border-green-300',
    glowColor: 'shadow-green-400/40',
    icon: '🤩',
    pulseColor: 'bg-green-300',
  },
  happy: {
    borderColor: 'border-green-400',
    glowColor: 'shadow-green-500/30',
    icon: '😊',
    pulseColor: 'bg-green-400',
  },
  receptive: {
    borderColor: 'border-emerald-400',
    glowColor: 'shadow-emerald-500/30',
    icon: '🙂',
    pulseColor: 'bg-emerald-400',
  },
  curious: {
    borderColor: 'border-cyan-400',
    glowColor: 'shadow-cyan-500/30',
    icon: '🤔',
    pulseColor: 'bg-cyan-400',
  },
  neutral: {
    borderColor: 'border-yellow-400',
    glowColor: 'shadow-yellow-500/20',
    icon: '😐',
    pulseColor: 'bg-yellow-400',
  },
  hesitant: {
    borderColor: 'border-orange-400',
    glowColor: 'shadow-orange-500/30',
    icon: '😕',
    pulseColor: 'bg-orange-400',
  },
  skeptical: {
    borderColor: 'border-orange-500',
    glowColor: 'shadow-orange-600/30',
    icon: '🤨',
    pulseColor: 'bg-orange-500',
  },
  frustrated: {
    borderColor: 'border-red-400',
    glowColor: 'shadow-red-500/40',
    icon: '😤',
    pulseColor: 'bg-red-400',
  },
};

// Get emotion from intensity (matches backend emotion_analyzer.py thresholds)
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

interface AvatarEmotionOverlayProps {
  children: React.ReactNode;
  showBorder?: boolean;
  showCornerIndicator?: boolean;
  showPulse?: boolean;
}

/**
 * Overlay component that wraps the avatar video and adds visual emotion feedback.
 *
 * Features:
 * - Colored border that changes with emotion state
 * - Subtle glow effect matching the emotion
 * - Corner indicator with emoji
 * - Pulse animation on emotion changes
 */
export function AvatarEmotionOverlay({
  children,
  showBorder = true,
  showCornerIndicator = true,
  showPulse = true,
}: AvatarEmotionOverlayProps) {
  const room = useRoomContext();
  const [emotion, setEmotion] = useState<EmotionState>('neutral');
  const [intensity, setIntensity] = useState(50);
  const [isChanging, setIsChanging] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'emotion') {
          const newIntensity = typeof data.intensity === 'number' ? data.intensity : 50;
          const newEmotion = (data.value && data.value in EMOTION_VISUALS)
            ? data.value as EmotionState
            : getEmotionFromIntensity(newIntensity);

          // Trigger change animation if emotion changed
          if (newEmotion !== emotion) {
            setIsChanging(true);
            setTimeout(() => setIsChanging(false), 600);
          }

          setEmotion(newEmotion);
          setIntensity(newIntensity);

          // Show reason briefly
          if (data.reason) {
            setReason(data.reason);
            setTimeout(() => setReason(null), 3000);
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

  const visuals = EMOTION_VISUALS[emotion];

  // Calculate border width based on intensity (more intense = thicker border)
  const borderWidth = emotion === 'neutral' ? 2 : Math.max(2, Math.floor((100 - intensity) / 20) + 2);

  return (
    <div className="relative w-full h-full">
      {/* Main content (avatar video) */}
      <div
        className={`w-full h-full overflow-hidden transition-all duration-500 ${
          showBorder ? `border-${borderWidth} ${visuals.borderColor} rounded-lg shadow-lg ${visuals.glowColor}` : ''
        } ${isChanging ? 'scale-[1.01]' : 'scale-100'}`}
        style={{
          borderWidth: showBorder ? `${borderWidth}px` : 0,
        }}
      >
        {children}
      </div>

      {/* Corner emotion indicator */}
      {showCornerIndicator && (
        <div
          className={`absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full
                      bg-black/60 border border-white/10
                      transition-all duration-300 ${isChanging ? 'scale-110' : 'scale-100'}`}
        >
          <span className={`text-lg ${isChanging ? 'animate-bounce' : ''}`}>
            {visuals.icon}
          </span>
          <div className={`w-2 h-2 rounded-full ${visuals.pulseColor} ${showPulse ? 'animate-pulse' : ''}`} />
        </div>
      )}

      {/* Reason tooltip */}
      {reason && (
        <div className="absolute top-14 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 animate-fade-in max-w-48">
          {reason}
        </div>
      )}

      {/* Edge glow effect for strong emotions */}
      {(emotion === 'enthusiastic' || emotion === 'happy' || emotion === 'frustrated') && (
        <div
          className={`absolute inset-0 pointer-events-none rounded-lg transition-opacity duration-500
                      ${emotion === 'enthusiastic' ? 'bg-gradient-to-t from-green-400/15 to-transparent' : ''}
                      ${emotion === 'happy' ? 'bg-gradient-to-t from-green-500/10 to-transparent' : ''}
                      ${emotion === 'frustrated' ? 'bg-gradient-to-t from-red-500/15 to-transparent' : ''}
                      ${isChanging ? 'opacity-100' : 'opacity-50'}`}
        />
      )}

      {/* Pulse ring on emotion change */}
      {isChanging && (
        <div
          className={`absolute inset-0 pointer-events-none rounded-lg border-4 ${visuals.borderColor}
                      animate-ping opacity-30`}
        />
      )}
    </div>
  );
}
