import { useState, useCallback, useRef, useEffect } from 'react';
import {
  RoomAudioRenderer,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';
import { AvatarView } from './AvatarView';
import { MicrophoneIndicator } from './MicrophoneIndicator';
import { SidePanel } from './SidePanel';
import { EmotionMeter } from './EmotionMeter';
import { LatencyOverlay } from './LatencyOverlay';

interface MobileSessionLayoutProps {
  onSessionEnd: (durationSeconds: number) => void;
  scenarioTitle?: string;
  scenarioContext?: string;
  maxDuration?: number;
}

type ActiveTab = 'video' | 'chat';

/**
 * Mobile-optimized session layout with bottom tab navigation.
 *
 * On mobile, the 70/30 split layout doesn't work well, so we use
 * a full-screen approach with tabs to switch between avatar and chat.
 */
export function MobileSessionLayout({
  onSessionEnd,
  scenarioTitle,
  scenarioContext,
  maxDuration = 180,
}: MobileSessionLayoutProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('video');
  const handleEndRef = useRef<() => void>(() => {});

  // Ensure microphone is enabled (critical for existingRoom flow)
  // In E2E mode, skip mic to prevent WebRTC ICE renegotiation crash in headless Chromium
  useEffect(() => {
    const isE2E = typeof window !== 'undefined' && localStorage.getItem('e2e_mode') === 'true';
    if (isE2E) {
      console.log('[MobileSession] E2E mode: skipping mic enablement');
      return;
    }
    if (room.localParticipant && !room.localParticipant.isMicrophoneEnabled) {
      console.log('[MobileSession] Mic not enabled, enabling now...');
      room.localParticipant.setMicrophoneEnabled(true).catch(err => {
        console.error('[MobileSession] Failed to enable microphone:', err);
      });
    }
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

  // Auto-handle unexpected disconnect (agent died, network lost)
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected && !isEnding) {
      console.warn('[MobileSession] Unexpected disconnect, ending session...');
      handleEndRef.current();
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

  // Connection states
  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="mt-4 text-white text-base">Conectando...</p>
        <p className="mt-1 text-neutral-400 text-sm">Preparando treinamento</p>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-white text-base">Conexao encerrada</p>
        <p className="mt-1 text-neutral-400 text-sm">Gerando feedback...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-neutral-950 flex flex-col overflow-hidden">
      {/* Latency Monitor (debug only) */}
      <LatencyOverlay />

      {/* Compact Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 safe-area-top">
        {/* Timer */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${
          isCritical ? 'bg-red-500/20 text-red-400' :
          isWarning ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-neutral-800 text-white'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isCritical ? 'bg-red-500 animate-pulse' :
            isWarning ? 'bg-yellow-500' :
            'bg-green-500'
          }`} />
          <span className="font-mono font-semibold">
            {formatTime(remaining)}
          </span>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-1.5 bg-red-500 px-2 py-0.5 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs font-semibold uppercase">Ao Vivo</span>
        </div>

        {/* End button */}
        <button
          onClick={handleEnd}
          disabled={isEnding}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium text-sm transition-all ${
            isEnding
              ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed'
              : 'bg-red-500/20 text-red-400 active:bg-red-500/30'
          }`}
        >
          {isEnding ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          <span className="hidden xs:inline">{isEnding ? 'Encerrando' : 'Sair'}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Video Tab Content */}
        {activeTab === 'video' && (
          <div className="w-full h-full relative bg-black">
            {/* Avatar Video */}
            <AvatarView />

            {/* Audio Renderer */}
            <RoomAudioRenderer />

            {/* Emotion Meter - Compact for mobile */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
              <div className="bg-neutral-900/80 backdrop-blur-sm rounded-xl p-2 border border-neutral-800">
                <EmotionMeter />
              </div>
            </div>

            {/* Microphone Indicator - Bottom center */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <MicrophoneIndicator />
            </div>

            {/* Scenario Title Overlay */}
            <div className="absolute top-2 left-2 right-2 z-10">
              <div className="bg-neutral-900/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <p className="text-white text-xs font-medium truncate">
                  {scenarioTitle || 'Treinamento'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Chat Tab Content */}
        {activeTab === 'chat' && (
          <div className="w-full h-full">
            <SidePanel
              scenarioTitle={scenarioTitle}
              scenarioContext={scenarioContext}
            />
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="flex border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-sm safe-area-bottom">
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
            activeTab === 'video'
              ? 'text-yellow-400'
              : 'text-neutral-400 active:text-neutral-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Avatar</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
            activeTab === 'chat'
              ? 'text-yellow-400'
              : 'text-neutral-400 active:text-neutral-300'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-xs font-medium">Chat</span>
        </button>
      </nav>
    </div>
  );
}
