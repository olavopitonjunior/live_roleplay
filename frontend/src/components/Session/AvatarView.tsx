import { useEffect, useState } from 'react';
import { AudioTrack, VideoTrack, useRemoteParticipants, useTracks, useRoomContext } from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { AvatarEmotionOverlay } from './AvatarEmotionOverlay';

type AvatarStatus = 'connecting' | 'ready' | 'audio_only' | 'failed';

interface AvatarViewProps {
  showEmotionOverlay?: boolean;
}

export function AvatarView({ showEmotionOverlay = true }: AvatarViewProps) {
  const room = useRoomContext();
  const participants = useRemoteParticipants();
  const videoTracks = useTracks([Track.Source.Camera]).filter((track) => !track.participant.isLocal);
  const audioTracks = useTracks([Track.Source.Microphone]).filter((track) => !track.participant.isLocal);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('connecting');

  // Listen for avatar_status messages from the agent
  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'avatar_status') {
          setAvatarStatus(data.status as AvatarStatus);
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Find the avatar's video track (from the agent)
  const avatarTrack =
    videoTracks.find((track) => {
      const identity = track.participant.identity.toLowerCase();
      return (
        identity.includes('agent') ||
        identity.includes('simli') ||
        identity.includes('liveavatar') ||
        identity.includes('heygen') ||
        identity.includes('hedra')
      );
    }) ?? videoTracks[0];
  const avatarAudioTrack = avatarTrack
    ? audioTracks.find((track) => track.participant.identity === avatarTrack.participant.identity)
    : null;
  const resolvedAudioTrack = avatarAudioTrack ?? audioTracks[0] ?? null;

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

  // No video track - show appropriate message based on avatar status
  if (!avatarTrack) {
    const isAudioOnly = avatarStatus === 'audio_only' || avatarStatus === 'failed';
    const statusMessage = isAudioOnly
      ? 'Modo somente audio'
      : avatarStatus === 'connecting'
        ? 'Iniciando avatar...'
        : 'Aguardando video...';
    const subMessage = isAudioOnly
      ? 'Avatar indisponivel - sessao continua com audio'
      : 'Por favor aguarde';

    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
        <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
          isAudioOnly
            ? 'bg-gradient-to-br from-blue-500 to-blue-700'
            : 'bg-gradient-to-br from-primary-500 to-primary-700'
        }`}>
          {isAudioOnly ? (
            // Audio-only icon (headphones/speaker)
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
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0"
              />
              <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
            </svg>
          ) : (
            // User placeholder icon
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
          )}
        </div>
        <p className="mt-6 text-gray-300">{statusMessage}</p>
        <p className="mt-2 text-gray-500 text-sm">{subMessage}</p>
        {/* Audio-only badge */}
        {isAudioOnly && (
          <div className="mt-4 flex items-center gap-2 bg-blue-500/20 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-400 text-sm font-medium">Audio Ativo</span>
          </div>
        )}
        {resolvedAudioTrack && (
          <AudioTrack trackRef={resolvedAudioTrack} className="hidden" />
        )}
      </div>
    );
  }

  // Render video with emotion overlay
  const videoContent = (
    <div className="w-full h-full bg-black relative">
      <VideoTrack
        trackRef={avatarTrack}
        className="w-full h-full object-contain bg-black"
      />
      {resolvedAudioTrack && (
        <AudioTrack trackRef={resolvedAudioTrack} className="hidden" />
      )}
      {/* Live indicator */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 border-2 border-black">
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
