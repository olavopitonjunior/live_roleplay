/**
 * AvatarContainer — Smart wrapper that auto-detects avatar mode.
 *
 * Listens for blendshape data channel messages from the agent.
 * If a blendshape header arrives (nvidia-a2f mode), renders Avatar3D.
 * Otherwise, renders AvatarView (Hedra/Simli video or audio-only fallback).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { AvatarView } from './AvatarView';
import { Avatar3D } from './Avatar3D';

type AvatarMode = 'detecting' | 'video' | '3d';

const BLENDSHAPE_TOPIC = 'blendshapes';

// Grace period to wait for blendshape header before falling back to video
const DETECTION_TIMEOUT_MS = 5000;

interface AvatarContainerProps {
  showEmotionOverlay?: boolean;
  /** Override auto-detection: force a specific mode */
  forceMode?: 'video' | '3d';
  /** URL to ReadyPlayerMe GLB model for 3D mode */
  modelUrl?: string;
}

export function AvatarContainer({
  showEmotionOverlay = true,
  forceMode,
  modelUrl,
}: AvatarContainerProps) {
  const room = useRoomContext();
  const [mode, setMode] = useState<AvatarMode>(forceMode ?? 'detecting');

  // Listen for blendshape header to detect nvidia-a2f mode
  const handleDataReceived = useCallback(
    (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      if (topic !== BLENDSHAPE_TOPIC) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'header') {
          console.log('[AvatarContainer] Blendshape header received — switching to 3D mode');
          setMode('3d');
        }
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    if (forceMode) return; // Skip detection if forced

    room.on(RoomEvent.DataReceived, handleDataReceived);

    // Timeout: if no blendshapes arrive, fall back to video mode
    const timeout = setTimeout(() => {
      setMode((prev) => {
        if (prev === 'detecting') {
          console.log('[AvatarContainer] No blendshapes detected — using video mode');
          return 'video';
        }
        return prev;
      });
    }, DETECTION_TIMEOUT_MS);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      clearTimeout(timeout);
    };
  }, [room, handleDataReceived, forceMode]);

  if (mode === '3d') {
    return <Avatar3D modelUrl={modelUrl} />;
  }

  // Both 'detecting' and 'video' render AvatarView
  // (AvatarView already handles its own loading/connecting state)
  return <AvatarView showEmotionOverlay={showEmotionOverlay} />;
}
