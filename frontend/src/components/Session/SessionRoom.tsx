import { useCallback, useRef, useState, useEffect } from 'react';
import {
  LiveKitRoom,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState, Room } from 'livekit-client';
import { AvatarView } from './AvatarView';
import { MicrophoneIndicator } from './MicrophoneIndicator';
import { SidePanel } from './SidePanel';
import { EmotionMeter } from './EmotionMeter';
import { MobileSessionLayout } from './MobileSessionLayout';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface SessionRoomProps {
  token: string;
  serverUrl: string;
  onSessionEnd: (durationSeconds: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
  existingRoom?: Room | null; // Pass existing room from useAgentConnection
}

/**
 * SessionContent decides which layout to render based on screen size.
 * Mobile (<768px): Tab-based layout with bottom navigation
 * Desktop (>=768px): Split layout with 70/30 ratio
 */
function SessionContent({
  onSessionEnd,
  scenarioTitle,
  scenarioContext,
}: {
  onSessionEnd: (duration: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
}) {
  const isMobile = useIsMobile();

  // Use mobile layout on small screens
  if (isMobile) {
    return (
      <MobileSessionLayout
        onSessionEnd={onSessionEnd}
        scenarioTitle={scenarioTitle}
        scenarioContext={scenarioContext}
      />
    );
  }

  // Desktop layout
  return (
    <DesktopSessionLayout
      onSessionEnd={onSessionEnd}
      scenarioTitle={scenarioTitle}
      scenarioContext={scenarioContext}
    />
  );
}

/**
 * Desktop layout with 70/30 split between avatar and chat panel.
 */
function DesktopSessionLayout({
  onSessionEnd,
  scenarioTitle,
  scenarioContext,
}: {
  onSessionEnd: (duration: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const maxDuration = 180; // 3 minutes

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxDuration) {
          clearInterval(interval);
          handleEnd();
          return prev;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEnd = useCallback(() => {
    if (isEnding) return;
    setIsEnding(true);
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    room.disconnect();
    onSessionEnd(duration);
  }, [room, onSessionEnd, isEnding]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remaining = maxDuration - elapsed;
  const isWarning = remaining <= 30;
  const isCritical = remaining <= 10;

  // Connection states - these should rarely be seen since connection
  // is verified during loading, but kept as fallback
  if (connectionState === ConnectionState.Connecting) {
    // This should not happen normally since we connect during loading
    // But keep as fallback just in case
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="mt-6 text-white text-lg">Reconectando...</p>
        <p className="mt-2 text-neutral-400 text-sm">Por favor aguarde</p>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-lg">Conexao encerrada</p>
        <p className="mt-2 text-neutral-400 text-sm">Redirecionando para feedback...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-neutral-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800">
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            isCritical ? 'bg-red-500/20 text-red-400' :
            isWarning ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-neutral-800 text-white'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isCritical ? 'bg-red-500 animate-pulse' :
              isWarning ? 'bg-yellow-500' :
              'bg-green-500'
            }`} />
            <span className="font-mono font-semibold text-sm">
              {formatTime(remaining)}
            </span>
          </div>

          {/* Scenario badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 rounded-full">
            <span className="text-neutral-400 text-xs">Cenario:</span>
            <span className="text-white text-xs font-medium truncate max-w-[200px]">
              {scenarioTitle || 'Treinamento'}
            </span>
          </div>
        </div>

        {/* End button */}
        <button
          onClick={handleEnd}
          disabled={isEnding}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
            isEnding
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-95'
          }`}
        >
          {isEnding ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Encerrando...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Encerrar
            </>
          )}
        </button>
      </header>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Avatar Area (Left) - YouTube-style centered 16:9 video */}
        <div className="flex-1 flex items-center justify-center bg-neutral-950 p-4">
          <div className="relative w-full max-w-4xl">
            {/* 16:9 Aspect Ratio Container */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
              {/* Avatar Video */}
              <AvatarView />

              {/* Emotion Meter - Left side inside video */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                <div className="bg-neutral-900/80 backdrop-blur-sm rounded-xl p-2 border border-neutral-700">
                  <EmotionMeter />
                </div>
              </div>

              {/* Microphone Indicator - Bottom center inside video */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <MicrophoneIndicator />
              </div>

              {/* Live badge - Top right inside video */}
              <div className="absolute top-3 right-3 z-10">
                <div className="flex items-center gap-2 bg-red-500 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs font-semibold uppercase">Ao Vivo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel (Right - Fixed Width) */}
        <div className="w-80 lg:w-96 border-l border-neutral-800 flex-shrink-0">
          <SidePanel
            scenarioTitle={scenarioTitle}
            scenarioContext={scenarioContext}
          />
        </div>
      </div>
    </div>
  );
}

export function SessionRoom({
  token,
  serverUrl,
  onSessionEnd,
  scenarioTitle,
  scenarioContext,
  existingRoom,
}: SessionRoomProps) {
  // If we have an existing room from useAgentConnection, use it
  // Otherwise, let LiveKitRoom create a new connection
  return (
    <LiveKitRoom
      room={existingRoom ?? undefined}
      token={existingRoom ? undefined : token}
      serverUrl={existingRoom ? undefined : serverUrl}
      connect={!existingRoom} // Don't auto-connect if room already exists
      audio={true}
      video={false}
      options={{
        adaptiveStream: true,
        dynacast: true,
      }}
      onDisconnected={() => {
        console.log('Disconnected from room');
      }}
      onError={(error) => {
        console.error('LiveKit error:', error);
      }}
    >
      <SessionContent
        onSessionEnd={onSessionEnd}
        scenarioTitle={scenarioTitle}
        scenarioContext={scenarioContext}
      />
    </LiveKitRoom>
  );
}
