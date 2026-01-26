import { VideoTrack, useRemoteParticipants, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { AvatarEmotionOverlay } from './AvatarEmotionOverlay';

interface AvatarViewProps {
  showEmotionOverlay?: boolean;
}

export function AvatarView({ showEmotionOverlay = true }: AvatarViewProps) {
  const participants = useRemoteParticipants();
  const videoTracks = useTracks([Track.Source.Camera]);

  // Find the avatar's video track (from the agent)
  const avatarTrack = videoTracks.find(
    (track) => track.participant.identity.includes('agent') ||
               track.participant.identity.includes('simli')
  );

  // Loading state
  if (participants.length === 0) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gray-800 animate-pulse"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
        <p className="mt-6 text-gray-400 animate-pulse">Conectando ao avatar...</p>
      </div>
    );
  }

  // No video track yet
  if (!avatarTrack) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <p className="mt-6 text-gray-300">Avatar conectado</p>
        <p className="mt-2 text-gray-500 text-sm">Aguardando video...</p>
      </div>
    );
  }

  // Render video with emotion overlay
  const videoContent = (
    <div className="w-full h-full bg-black relative">
      <VideoTrack
        trackRef={avatarTrack}
        className="w-full h-full object-cover"
      />
      {/* Live indicator */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-white text-sm">Ao vivo</span>
        </div>
      </div>
    </div>
  );

  // Wrap with emotion overlay if enabled
  if (showEmotionOverlay) {
    return (
      <AvatarEmotionOverlay showBorder={true} showCornerIndicator={true} showPulse={true}>
        {videoContent}
      </AvatarEmotionOverlay>
    );
  }

  return videoContent;
}
