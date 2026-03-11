import { useState } from 'react';
import { useLatency } from '../../hooks/useLatency';

// Thresholds for color coding (ms)
const FAST_THRESHOLD = 500;
const SLOW_THRESHOLD = 2000;

function getStatusColor(ms: number): string {
  if (ms < FAST_THRESHOLD) return 'text-green-400';
  if (ms < SLOW_THRESHOLD) return 'text-yellow-400';
  return 'text-red-400';
}

function getStatusLabel(ms: number): string {
  if (ms < FAST_THRESHOLD) return 'FAST';
  if (ms < SLOW_THRESHOLD) return 'OK';
  return 'SLOW';
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

// Ordered list of metric keys to display
const METRIC_ORDER = [
  'token_fetch',
  'livekit_connect',
  'agent_join',
  'avatar_load',
  'greeting',
  'response_time',
  'emotion_analysis',
  'coach_ai',
  'coach_keyword',
  'transcript_save',
  'feedback_generation',
];

export function LatencyOverlay() {
  const { latest, responseTimes, isEnabled, exportJSON } = useLatency();
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isEnabled) return null;

  const avgResponse = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJSON());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      console.log(exportJSON());
    }
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed top-16 left-3 z-50 bg-gray-900 border-2 border-black shadow-[4px_4px_0px_#000] px-3 py-1.5 text-xs font-mono text-gray-300 hover:text-white transition-colors"
      >
        LATENCY {avgResponse > 0 ? `${formatMs(avgResponse)}` : '...'}
      </button>
    );
  }

  return (
    <div className="fixed top-16 left-3 z-50 bg-gray-900 border-2 border-black shadow-[4px_4px_0px_#000] w-72 max-h-[70vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-black">
        <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">Latency Monitor</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
            title="Copiar JSON"
          >
            {copied ? 'OK' : 'JSON'}
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="text-gray-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-gray-700 transition-colors"
          >
            _
          </button>
        </div>
      </div>

      {/* Metrics List */}
      <div className="overflow-y-auto max-h-[55vh]">
        <div className="divide-y divide-gray-800">
          {METRIC_ORDER.map((key) => {
            const event = latest[key];
            if (!event) {
              return (
                <div key={key} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-gray-500">{key.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-gray-600 font-mono">--</span>
                </div>
              );
            }

            // For response_time, show the latest + count
            const displayLabel = key === 'response_time' && responseTimes.length > 1
              ? `Response #${responseTimes.length}`
              : event.label;

            return (
              <div key={key} className="flex items-center justify-between px-3 py-1.5">
                <div className="flex flex-col min-w-0 flex-1 mr-2">
                  <span className="text-xs text-gray-300 truncate">{displayLabel}</span>
                  {event.details && (
                    <span className="text-[10px] text-gray-500 truncate">{event.details}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-mono font-semibold ${getStatusColor(event.duration_ms)}`}>
                    {formatMs(event.duration_ms)}
                  </span>
                  <span className={`text-[10px] font-medium ${getStatusColor(event.duration_ms)}`}>
                    {getStatusLabel(event.duration_ms)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-black px-3 py-2 bg-gray-800/50">
        {responseTimes.length > 0 && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-400 uppercase">Avg Response</span>
            <span className={`text-xs font-mono font-bold ${getStatusColor(avgResponse)}`}>
              {formatMs(avgResponse)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase">Events</span>
          <span className="text-xs font-mono text-gray-300">
            {Object.keys(latest).length} / {METRIC_ORDER.length}
          </span>
        </div>
      </div>
    </div>
  );
}
