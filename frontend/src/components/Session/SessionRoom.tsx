import { useCallback, useRef, useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState, Room, RoomEvent } from 'livekit-client';
import { AvatarContainer } from './AvatarContainer';
import { MicrophoneIndicator } from './MicrophoneIndicator';
import { SidePanel } from './SidePanel';
import { EmotionMeter } from './EmotionMeter';
import { LatencyOverlay } from './LatencyOverlay';
import { MobileSessionLayout } from './MobileSessionLayout';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { TranscriptProvider } from '../../hooks/useTranscript';
import { LatencyProvider } from '../../hooks/useLatency';
import { SessionCoachPanel } from './SessionCoachPanel';

interface SessionRoomProps {
  token: string;
  serverUrl: string;
  onSessionEnd: (durationSeconds: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
  maxDuration?: number; // Maximum session duration in seconds (default: 180)
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
  maxDuration = 180,
}: {
  onSessionEnd: (duration: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
  maxDuration?: number;
}) {
  const isMobile = useIsMobile();

  // Use mobile layout on small screens
  if (isMobile) {
    return (
      <MobileSessionLayout
        onSessionEnd={onSessionEnd}
        scenarioTitle={scenarioTitle}
        scenarioContext={scenarioContext}
        maxDuration={maxDuration}
      />
    );
  }

  // Desktop layout
  return (
    <DesktopSessionLayout
      onSessionEnd={onSessionEnd}
      scenarioTitle={scenarioTitle}
      scenarioContext={scenarioContext}
      maxDuration={maxDuration}
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
  maxDuration = 180,
}: {
  onSessionEnd: (duration: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
  maxDuration?: number;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [agentAlive, setAgentAlive] = useState(true);
  const lastHeartbeatRef = useRef(Date.now());
  const handleEndRef = useRef<() => void>(() => {});

  // Ensure microphone is enabled (critical for existingRoom flow)
  // In E2E mode, skip mic to prevent WebRTC ICE renegotiation crash in headless Chromium
  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && localStorage.getItem('e2e_mode') === 'true';
    if (isE2E) {
      console.log('[SessionRoom] E2E mode: skipping mic enablement');
      return;
    }
    if (room.localParticipant && !room.localParticipant.isMicrophoneEnabled) {
      console.log('[SessionRoom] Mic not enabled, enabling now...');
      room.localParticipant.setMicrophoneEnabled(true).catch(err => {
        console.error('[SessionRoom] Failed to enable microphone:', err);
      });
    }
  }, [room]);

  // Heartbeat monitor: detect if agent dies
  // In E2E mode, also expose all data messages to window for test capture
  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && localStorage.getItem('e2e_mode') === 'true';
    if (isE2E) {
      (window as any).__testDataMessages = (window as any).__testDataMessages || [];
    }

    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'heartbeat') {
          lastHeartbeatRef.current = Date.now();
          setAgentAlive(true);
        }
        // Expose to E2E tests
        if (isE2E) {
          (window as any).__testDataMessages.push({ ...msg, _capturedAt: Date.now() });
        }
      } catch { /* ignore non-JSON */ }
    };

    room.on(RoomEvent.DataReceived, onData);

    const checker = setInterval(() => {
      const sinceLastHb = Date.now() - lastHeartbeatRef.current;
      setAgentAlive((prev) => {
        if (sinceLastHb > 15000 && prev) {
          console.warn('[SessionRoom] No heartbeat for 15s - agent may be dead');
          return false;
        }
        return prev;
      });
    }, 5000);

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      clearInterval(checker);
    };
  }, [room]);

  // handleEnd: single path for ending session (no room.disconnect here - Session.tsx handles it)
  const handleEnd = useCallback(() => {
    if (isEnding) return;
    setIsEnding(true);
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    onSessionEnd(duration);
  }, [onSessionEnd, isEnding]);

  // Keep ref updated so timer/effects always call latest version
  useEffect(() => {
    handleEndRef.current = handleEnd;
  }, [handleEnd]);

  // Auto-handle unexpected disconnect with grace period for reconnection
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected && !isEnding) {
      console.warn('[SessionRoom] Disconnect detected, waiting 5s for reconnection...');
      const timeout = setTimeout(() => {
        // Re-check: only end if room is truly disconnected (not reconnecting)
        if (room.state === ConnectionState.Disconnected) {
          console.warn('[SessionRoom] Still disconnected after 5s, ending session');
          handleEndRef.current();
        } else {
          console.log('[SessionRoom] Room recovered during grace period');
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [connectionState, isEnding]);

  // Timer (uses ref to avoid stale closure)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxDuration) {
          clearInterval(interval);
          handleEndRef.current();
          return prev;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [maxDuration]);

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
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="mt-6 text-white text-lg">Reconectando...</p>
        <p className="mt-2 text-gray-400 text-sm">Por favor aguarde</p>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-red-500/20 flex items-center justify-center mb-4 border-2 border-black shadow-[4px_4px_0px_#000]">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-lg">Conexao encerrada</p>
        <p className="mt-2 text-gray-400 text-sm">Redirecionando para feedback...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Audio Renderer - ensures all remote audio tracks play */}
      <RoomAudioRenderer />

      {/* Latency Monitor (debug only) */}
      <LatencyOverlay />

      {/* Agent heartbeat warning */}
      {!agentAlive && (
        <div className="bg-yellow-500/20 text-yellow-400 text-xs text-center py-1 px-2 border-b-2 border-black">
          Sem sinal do agente - verificando conexao...
        </div>
      )}

      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b-2 border-black">
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 border-2 border-black ${
            isCritical ? 'bg-red-500/20 text-red-400' :
            isWarning ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-800 text-white'
          }`}>
            <div className={`w-2 h-2 ${
              isCritical ? 'bg-red-500 animate-pulse' :
              isWarning ? 'bg-yellow-500' :
              'bg-green-500'
            }`} />
            <span className="font-mono font-semibold text-sm">
              {formatTime(remaining)}
            </span>
          </div>

          {/* Scenario badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 border-2 border-black">
            <span className="text-gray-400 text-xs uppercase tracking-wider">Cenario:</span>
            <span className="text-white text-xs font-medium truncate max-w-[200px]">
              {scenarioTitle || 'Treinamento'}
            </span>
          </div>
        </div>

        {/* End button */}
        <button
          onClick={handleEnd}
          disabled={isEnding}
          className={`flex items-center gap-2 px-4 py-2 font-medium text-sm transition-all border-2 border-black shadow-[4px_4px_0px_#000] active:shadow-none active:translate-x-1 active:translate-y-1 ${
            isEnding
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
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
        <div className="flex-1 flex items-center justify-center bg-gray-950 p-4">
          <div className="relative w-full max-w-3xl">
            {/* 16:9 Aspect Ratio Container */}
            <div className="relative aspect-video bg-black overflow-hidden border-2 border-black shadow-[4px_4px_0px_#000]">
              {/* Avatar Video */}
              <AvatarContainer />

              {/* Emotion Meter - Left side inside video */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                <div className="bg-gray-900 p-2 border-2 border-black">
                  <EmotionMeter />
                </div>
              </div>

              {/* Microphone Indicator - Bottom center inside video */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <MicrophoneIndicator />
              </div>

              {/* Live badge - Top right inside video */}
              <div className="absolute top-3 right-3 z-10">
                <div className="flex items-center gap-2 bg-red-500 px-3 py-1 border-2 border-black">
                  <div className="w-2 h-2 bg-white animate-pulse" />
                  <span className="text-white text-xs font-semibold uppercase tracking-wider">Ao Vivo</span>
                </div>
              </div>
            </div>

            {/* Coach Panel - Below video */}
            <div className="mt-3 max-w-md mx-auto w-full">
              <SessionCoachPanel />
            </div>
          </div>
        </div>

        {/* Side Panel (Right - Fixed Width) */}
        <div className="w-80 lg:w-96 border-l-2 border-black flex-shrink-0">
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
  maxDuration = 180,
  existingRoom,
}: SessionRoomProps) {
  // If we have an existing room from useAgentConnection, use it
  // Otherwise, let LiveKitRoom create a new connection
  // IMPORTANT: Never pass connect={false} — LiveKitRoom disconnects the room when connect is false.
  // When existingRoom is provided with token=undefined, LiveKitRoom skips connecting (no-op).
  return (
    <LiveKitRoom
      room={existingRoom ?? undefined}
      token={existingRoom ? undefined : token}
      serverUrl={existingRoom ? undefined : serverUrl}
      audio={existingRoom ? false : true}
      video={false}
      options={existingRoom ? undefined : {
        adaptiveStream: true,
        dynacast: true,
      }}
      onDisconnected={(reason) => {
        console.log('Disconnected from room, reason:', reason);
      }}
      onError={(error) => {
        console.error('LiveKit error:', error);
      }}
      onMediaDeviceFailure={(failure) => {
        console.error('Media device failure:', failure);
      }}
    >
      <TranscriptProvider>
        <LatencyProvider>
          <SessionContent
            onSessionEnd={onSessionEnd}
            scenarioTitle={scenarioTitle}
            scenarioContext={scenarioContext}
            maxDuration={maxDuration}
          />
        </LatencyProvider>
      </TranscriptProvider>
    </LiveKitRoom>
  );
}
