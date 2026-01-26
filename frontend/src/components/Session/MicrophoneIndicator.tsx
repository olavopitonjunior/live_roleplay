import { useLocalParticipant, useIsSpeaking } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { Track } from 'livekit-client';

export function MicrophoneIndicator() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const isSpeaking = useIsSpeaking(localParticipant);
  const [audioLevel, setAudioLevel] = useState(0);

  // Monitor audio level
  useEffect(() => {
    if (!localParticipant) return;

    const interval = setInterval(() => {
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (audioTrack?.track) {
        // Get audio level from track - use isSpeaking as proxy since audioLevel may not be exposed
        const level = isSpeaking ? 0.7 : 0.1;
        setAudioLevel(level);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [localParticipant, isSpeaking]);

  return (
    <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
      {/* Mic Icon */}
      <div className={`relative ${isMicrophoneEnabled ? 'text-white' : 'text-red-500'}`}>
        {isMicrophoneEnabled ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
          </svg>
        )}

        {/* Speaking pulse animation */}
        {isSpeaking && (
          <span className="absolute -inset-1 rounded-full bg-green-500/30 animate-ping"></span>
        )}
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-white text-sm font-medium">
          {!isMicrophoneEnabled ? 'Mic desligado' : isSpeaking ? 'Falando...' : 'Mic ativo'}
        </span>

        {/* Audio level bar */}
        {isMicrophoneEnabled && (
          <div className="w-20 h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                isSpeaking ? 'bg-green-500' : 'bg-gray-500'
              }`}
              style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Visual indicator dots */}
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
              isSpeaking && audioLevel > i * 0.2
                ? 'bg-green-500 scale-125'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
