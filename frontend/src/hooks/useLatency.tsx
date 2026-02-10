import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

export interface LatencyEvent {
  event: string;
  duration_ms: number;
  label: string;
  details?: string;
  timestamp: number;
  source: 'agent' | 'frontend';
}

interface LatencyContextType {
  events: LatencyEvent[];
  latest: Record<string, LatencyEvent>;
  responseTimes: number[];
  isEnabled: boolean;
  record: (event: string, duration_ms: number, label: string, details?: string) => void;
  exportJSON: () => string;
}

const LatencyContext = createContext<LatencyContextType | null>(null);

// Global pending events queue for pre-connection measurements
// (token fetch, livekit connect, agent join happen BEFORE LatencyProvider mounts)
const _pendingEvents: LatencyEvent[] = [];

export function isLatencyEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('debug') && params.get('debug') === 'latency') return true;
  if (import.meta.env.VITE_DEBUG_LATENCY === 'true') return true;
  return false;
}

/**
 * Record a latency event from anywhere (before or after LatencyProvider mounts).
 * Pre-mount events are queued and picked up when the provider initializes.
 */
export function recordLatencyGlobal(event: string, duration_ms: number, label: string, details?: string) {
  if (!isLatencyEnabled()) return;
  const entry: LatencyEvent = {
    event,
    duration_ms,
    label,
    details,
    timestamp: Date.now(),
    source: 'frontend',
  };
  console.log(`[Latency] ${event}: ${duration_ms.toFixed(0)}ms ${details || ''}`);
  _pendingEvents.push(entry);
}

interface LatencyProviderProps {
  children: ReactNode;
}

export function LatencyProvider({ children }: LatencyProviderProps) {
  const [events, setEvents] = useState<LatencyEvent[]>([]);
  const [latest, setLatest] = useState<Record<string, LatencyEvent>>({});
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const enabled = useRef(isLatencyEnabled()).current;

  const room = useRoomContext();

  // Drain pending events on mount
  useEffect(() => {
    if (!enabled || _pendingEvents.length === 0) return;
    const pending = _pendingEvents.splice(0);
    setEvents(prev => [...prev, ...pending]);
    const newLatest: Record<string, LatencyEvent> = {};
    const newResponseTimes: number[] = [];
    for (const e of pending) {
      newLatest[e.event] = e;
      if (e.event === 'response_time') newResponseTimes.push(e.duration_ms);
    }
    setLatest(prev => ({ ...prev, ...newLatest }));
    if (newResponseTimes.length > 0) {
      setResponseTimes(prev => [...prev, ...newResponseTimes]);
    }
  }, [enabled]);

  const record = useCallback((event: string, duration_ms: number, label: string, details?: string) => {
    if (!enabled) return;

    const entry: LatencyEvent = {
      event,
      duration_ms,
      label,
      details,
      timestamp: Date.now(),
      source: 'frontend',
    };

    console.log(`[Latency] ${event}: ${duration_ms.toFixed(0)}ms ${details || ''}`);

    setEvents(prev => [...prev, entry]);
    setLatest(prev => ({ ...prev, [event]: entry }));

    if (event === 'response_time') {
      setResponseTimes(prev => [...prev, duration_ms]);
    }
  }, [enabled]);

  // Listen for latency_event from agent data channel
  useEffect(() => {
    if (!room || !enabled) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === 'latency_event') {
          const entry: LatencyEvent = {
            event: data.event,
            duration_ms: data.duration_ms,
            label: data.label,
            details: data.details || '',
            timestamp: data.timestamp || Date.now(),
            source: 'agent',
          };

          console.log(`[Latency] ${data.event}: ${data.duration_ms.toFixed(0)}ms ${data.details || ''} (agent)`);

          setEvents(prev => [...prev, entry]);
          setLatest(prev => ({ ...prev, [data.event]: entry }));

          if (data.event === 'response_time') {
            setResponseTimes(prev => [...prev, data.duration_ms]);
          }
        }
      } catch {
        // Ignore non-JSON or non-latency data
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room, enabled]);

  const exportJSON = useCallback(() => {
    const avgResponse = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      events,
      summary: {
        avg_response_ms: Math.round(avgResponse),
        max_response_ms: responseTimes.length > 0 ? Math.round(Math.max(...responseTimes)) : 0,
        min_response_ms: responseTimes.length > 0 ? Math.round(Math.min(...responseTimes)) : 0,
        response_count: responseTimes.length,
        avatar_load_ms: latest.avatar_load?.duration_ms ?? null,
        greeting_ms: latest.greeting?.duration_ms ?? null,
        token_fetch_ms: latest.token_fetch?.duration_ms ?? null,
        livekit_connect_ms: latest.livekit_connect?.duration_ms ?? null,
        agent_join_ms: latest.agent_join?.duration_ms ?? null,
        feedback_ms: latest.feedback_generation?.duration_ms ?? null,
      },
    }, null, 2);
  }, [events, responseTimes, latest]);

  const value: LatencyContextType = {
    events,
    latest,
    responseTimes,
    isEnabled: enabled,
    record,
    exportJSON,
  };

  return (
    <LatencyContext.Provider value={value}>
      {children}
    </LatencyContext.Provider>
  );
}

export function useLatency() {
  const ctx = useContext(LatencyContext);
  if (!ctx) {
    // Return a no-op version if used outside provider (safe fallback)
    return {
      events: [] as LatencyEvent[],
      latest: {} as Record<string, LatencyEvent>,
      responseTimes: [] as number[],
      isEnabled: false,
      record: () => {},
      exportJSON: () => '{}',
    };
  }
  return ctx;
}
