import { useRef, useState } from 'react';
import type { Evidence } from '../../types';

interface TranscriptViewerProps {
  transcript: string;
  evidences?: Evidence[];
  highlightRange?: { start: number; end: number } | null;
  onClearHighlight?: () => void;
}

export function TranscriptViewer({
  transcript,
  evidences = [],
  highlightRange,
  onClearHighlight,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse transcript into lines with speaker detection
  const parseTranscriptLines = () => {
    const lines = transcript.split('\n').filter((line) => line.trim());
    return lines.map((line) => {
      const match = line.match(/^\[(.*?)\]\s*(Usuario|Avatar|User|Assistant):\s*(.*)$/i);
      if (match) {
        return {
          timestamp: match[1],
          speaker: match[2].toLowerCase().includes('user') ? 'user' : 'avatar',
          text: match[3],
        };
      }
      // Try simpler format
      const simpleMatch = line.match(/^(Usuario|Avatar|User|Assistant):\s*(.*)$/i);
      if (simpleMatch) {
        return {
          timestamp: null,
          speaker: simpleMatch[1].toLowerCase().includes('user') ? 'user' : 'avatar',
          text: simpleMatch[2],
        };
      }
      return { timestamp: null, speaker: 'unknown', text: line };
    });
  };

  const lines = parseTranscriptLines();
  const previewLines = isExpanded ? lines : lines.slice(0, 6);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-black flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Transcricao Completa
        </h3>
        {highlightRange && (
          <button
            onClick={onClearHighlight}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpar destaque
          </button>
        )}
      </div>

      {/* Legend */}
      {evidences.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            Criterio
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
            Momento-chave
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" />
            Objecao
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" />
            Destaque ativo
          </span>
        </div>
      )}

      {/* Transcript content */}
      <div ref={containerRef} className="p-4 max-h-96 overflow-y-auto">
        <div className="space-y-3">
          {previewLines.map((line, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                line.speaker === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  line.speaker === 'user'
                    ? 'bg-blue-100 text-blue-700'
                    : line.speaker === 'avatar'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {line.speaker === 'user' ? 'U' : line.speaker === 'avatar' ? 'A' : '?'}
              </div>

              {/* Message bubble */}
              <div
                className={`flex-1 max-w-[80%] p-3 rounded-lg ${
                  line.speaker === 'user'
                    ? 'bg-blue-50 text-blue-900'
                    : line.speaker === 'avatar'
                    ? 'bg-purple-50 text-purple-900'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                {line.timestamp && (
                  <p className="text-xs text-gray-400 mb-1">{line.timestamp}</p>
                )}
                <p className="text-sm leading-relaxed">{line.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Expand button */}
        {lines.length > 6 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-black flex items-center justify-center gap-1 border-t border-gray-200"
          >
            {isExpanded ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Mostrar menos
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Ver transcricao completa ({lines.length} mensagens)
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
