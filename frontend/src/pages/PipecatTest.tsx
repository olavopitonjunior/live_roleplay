/**
 * PipecatTest — Minimal test page for the Pipecat PoC agent.
 *
 * Accepts a LiveKit token via query param and renders AvatarContainer
 * inside a LiveKitRoom provider. Used for testing Avatar3D (NVIDIA A2F),
 * audio-only mode, and other Pipecat features without the full session flow.
 *
 * Usage:
 *   1. Start Pipecat agent (auto-generates tokens)
 *   2. Copy user token from agent output
 *   3. Open: /pipecat-test?token=<TOKEN>
 */
import { useSearchParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, useConnectionState } from '@livekit/components-react';
import { AvatarContainer } from '../components/Session/AvatarContainer';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

function RoomStatus() {
  const connectionState = useConnectionState();
  return (
    <div className="absolute top-4 right-4 z-20">
      <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <span className="text-white/70 text-xs font-mono">
          {connectionState}
        </span>
      </div>
    </div>
  );
}

export function PipecatTest() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const url = params.get('url') || LIVEKIT_URL;

  if (!token) {
    return (
      <div className="w-screen h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center text-white/70 max-w-md">
          <h1 className="text-xl font-semibold mb-4">Pipecat PoC Test</h1>
          <p className="text-sm mb-2">
            Pass a LiveKit token as query param:
          </p>
          <code className="text-xs text-blue-400 bg-neutral-900 px-3 py-1.5 rounded block">
            /pipecat-test?token=eyJ...
          </code>
          <p className="text-xs text-white/40 mt-4">
            Start the Pipecat agent to auto-generate tokens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={url} token={token} connect={true}>
      <div className="w-screen h-screen bg-neutral-950 flex items-center justify-center relative">
        <div className="aspect-video max-w-4xl w-full h-full max-h-screen">
          <AvatarContainer />
        </div>
        <RoomStatus />
      </div>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
