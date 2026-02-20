/**
 * Avatar3D — Three.js 3D avatar with NVIDIA Audio2Face-3D lip-sync.
 *
 * Receives ARKit blendshape weights from the agent via LiveKit data channel
 * (topic: "blendshapes") and applies them to a ReadyPlayerMe GLB model's
 * morph targets for real-time facial animation.
 *
 * Data channel protocol:
 *   Header (once):  { type: "header", names: ["EyeBlinkLeft", ...] }
 *   Frames (30fps): { type: "bs", t: 0.1234, v: [0.0, 0.5, ...] }
 *
 * Requires: @react-three/fiber, @react-three/drei, three
 *
 * Usage:
 *   <Avatar3D modelUrl="/avatar.glb" />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, DataPacket_Kind } from 'livekit-client';
import * as THREE from 'three';

// ── Types ──────────────────────────────────────────────────────────

interface BlendshapeHeader {
  type: 'header';
  names: string[];
}

interface BlendshapeFrame {
  type: 'bs';
  t: number;
  v: number[];
}

type BlendshapeMessage = BlendshapeHeader | BlendshapeFrame;

interface Avatar3DProps {
  /** URL to a ReadyPlayerMe GLB model with ARKit morph targets */
  modelUrl?: string;
  /** Camera distance from face (default: 0.6) */
  cameraDistance?: number;
  /** Enable orbit controls for debugging (default: false) */
  enableOrbitControls?: boolean;
}

// ── Blendshape data store (shared between React and Three.js) ──────

interface BlendshapeStore {
  names: string[];
  values: number[];
  dirty: boolean;
}

const TOPIC = 'blendshapes';

// ── AvatarModel (Three.js scene) ───────────────────────────────────

function AvatarModel({
  modelUrl,
  store,
}: {
  modelUrl: string;
  store: React.MutableRefObject<BlendshapeStore>;
}) {
  const { scene } = useGLTF(modelUrl);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  // Find all meshes with morph targets on load
  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.morphTargetDictionary &&
        child.morphTargetInfluences
      ) {
        meshes.push(child);
      }
    });
    meshesRef.current = meshes;

    if (meshes.length > 0) {
      const totalMorphs = meshes.reduce(
        (sum, m) => sum + Object.keys(m.morphTargetDictionary!).length,
        0
      );
      console.log(
        `[Avatar3D] Found ${meshes.length} meshes with ${totalMorphs} total morph targets`
      );
    } else {
      console.warn('[Avatar3D] No meshes with morph targets found in model');
    }
  }, [scene]);

  // Apply blendshapes every frame
  useFrame(() => {
    if (!store.current.dirty || store.current.names.length === 0) return;
    store.current.dirty = false;

    const { names, values } = store.current;

    for (const mesh of meshesRef.current) {
      const dict = mesh.morphTargetDictionary!;
      const influences = mesh.morphTargetInfluences!;

      for (let i = 0; i < names.length; i++) {
        const idx = dict[names[i]];
        if (idx !== undefined && i < values.length) {
          // Smooth interpolation for natural movement
          influences[idx] += (values[i] - influences[idx]) * 0.5;
        }
      }
    }
  });

  return <primitive object={scene} position={[0, -0.6, 0]} />;
}

// ── Main component ─────────────────────────────────────────────────

export function Avatar3D({
  modelUrl = '/avatar.glb',
  cameraDistance = 0.6,
  enableOrbitControls = false,
}: Avatar3DProps) {
  const room = useRoomContext();
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const storeRef = useRef<BlendshapeStore>({
    names: [],
    values: [],
    dirty: false,
  });

  // Subscribe to LiveKit data channel for blendshape messages
  const handleDataReceived = useCallback(
    (payload: Uint8Array, participant: unknown, kind: DataPacket_Kind, topic?: string) => {
      if (topic !== TOPIC) return;

      try {
        const text = new TextDecoder().decode(payload);
        const msg: BlendshapeMessage = JSON.parse(text);

        if (msg.type === 'header') {
          storeRef.current.names = msg.names;
          console.log(`[Avatar3D] Received header: ${msg.names.length} blendshapes`);
          setConnected(true);
        } else if (msg.type === 'bs') {
          storeRef.current.values = msg.v;
          storeRef.current.dirty = true;
          setFrameCount((c) => c + 1);
        }
      } catch {
        // Ignore malformed messages
      }
    },
    []
  );

  useEffect(() => {
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, handleDataReceived]);

  return (
    <div className="w-full h-full bg-gray-900 relative">
      <Canvas
        camera={{
          position: [0, 0, cameraDistance],
          fov: 30,
          near: 0.01,
          far: 10,
        }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Studio lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} intensity={1.0} />
        <directionalLight position={[-2, 1, 1]} intensity={0.4} color="#b0d0ff" />

        <AvatarModel modelUrl={modelUrl} store={storeRef} />

        {enableOrbitControls && <OrbitControls />}
      </Canvas>

      {/* Status overlay */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`}
          />
          <span className="text-white text-sm">
            {connected ? 'Ao vivo (3D)' : 'Aguardando blendshapes...'}
          </span>
        </div>
      </div>

      {/* Debug frame counter */}
      {connected && frameCount > 0 && (
        <div className="absolute bottom-4 right-4 z-10">
          <span className="text-white/30 text-xs font-mono">
            {frameCount} frames
          </span>
        </div>
      )}
    </div>
  );
}
