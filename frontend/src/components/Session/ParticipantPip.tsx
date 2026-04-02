import { EmotionMeter } from './EmotionMeter';
import { MicrophoneIndicator } from './MicrophoneIndicator';

export function ParticipantPip() {
  return (
    <div
      className="absolute bottom-16 left-4 z-20
                 w-[160px] bg-gray-900 border-2 border-black shadow-[4px_4px_0px_#000]
                 flex flex-col items-center gap-1 p-2"
    >
      {/* Live badge */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-1.5 h-1.5 bg-red-500 animate-pulse" />
        <span className="text-[9px] text-white font-bold uppercase tracking-wider">Ao Vivo</span>
      </div>

      {/* Emotion + Mic row */}
      <div className="flex items-center gap-2">
        <div className="scale-75 origin-center">
          <EmotionMeter />
        </div>
        <div className="scale-75 origin-center">
          <MicrophoneIndicator />
        </div>
      </div>
    </div>
  );
}
