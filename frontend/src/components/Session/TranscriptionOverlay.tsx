import { useEffect, useState, useRef, createContext, useContext } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';

interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'avatar';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

// Context for sharing emotion state
interface EmotionContextType {
  emotion: string;
  agentStatus: string;
}

const EmotionContext = createContext<EmotionContextType>({ emotion: 'neutral', agentStatus: 'Aguardando...' });

export function useEmotion() {
  return useContext(EmotionContext);
}

// Typing indicator component
function TypingIndicator({ speaker }: { speaker: 'user' | 'avatar' }) {
  return (
    <div className={`flex items-center gap-1 px-3 py-2 rounded-2xl ${
      speaker === 'user'
        ? 'bg-yellow-400/80'
        : 'bg-gray-700/80'
    }`}>
      <span className={`w-2 h-2 rounded-full animate-bounce ${
        speaker === 'user' ? 'bg-gray-800' : 'bg-gray-400'
      }`} style={{ animationDelay: '0ms' }} />
      <span className={`w-2 h-2 rounded-full animate-bounce ${
        speaker === 'user' ? 'bg-gray-800' : 'bg-gray-400'
      }`} style={{ animationDelay: '150ms' }} />
      <span className={`w-2 h-2 rounded-full animate-bounce ${
        speaker === 'user' ? 'bg-gray-800' : 'bg-gray-400'
      }`} style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// Keywords to highlight (objections and important terms)
const HIGHLIGHT_KEYWORDS = [
  // Objections
  'caro', 'preço', 'orçamento', 'pensar', 'depois', 'não sei', 'dúvida',
  // Positive signals
  'interessante', 'gostei', 'fechado', 'vamos', 'concordo', 'perfeito',
  // Questions
  'como', 'quanto', 'quando', 'por que', 'qual'
];

function highlightKeywords(text: string): React.ReactNode {
  const lowerText = text.toLowerCase();
  let hasHighlight = false;

  for (const keyword of HIGHLIGHT_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      hasHighlight = true;
      break;
    }
  }

  if (!hasHighlight) return text;

  // Simple highlight - wrap matching words
  const parts = text.split(/(\s+)/);
  return parts.map((part, i) => {
    const lowerPart = part.toLowerCase();
    const isHighlighted = HIGHLIGHT_KEYWORDS.some(kw => lowerPart.includes(kw));
    if (isHighlighted) {
      return <span key={i} className="bg-yellow-500/30 rounded px-0.5">{part}</span>;
    }
    return part;
  });
}

interface TranscriptionOverlayProps {
  variant?: 'overlay' | 'sidebar';
}

export function TranscriptionOverlay({ variant = 'overlay' }: TranscriptionOverlayProps) {
  const room = useRoomContext();
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<string>('Aguardando...');
  const [emotion, setEmotion] = useState<string>('neutral');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Listen for data from the agent
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);

        // Handle transcription
        if (data.type === 'transcription' || data.type === 'transcript') {
          const newMessage: TranscriptMessage = {
            id: `${Date.now()}-${Math.random()}`,
            speaker: data.speaker === 'user' ? 'user' : 'avatar',
            text: data.text || data.content,
            timestamp: new Date(),
            isFinal: data.isFinal !== false,
          };

          setMessages((prev) => {
            if (!newMessage.isFinal) {
              const existingIndex = prev.findIndex(
                (m) => m.speaker === newMessage.speaker && !m.isFinal
              );
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newMessage;
                return updated;
              }
            }
            return [...prev.slice(-20), newMessage]; // Keep last 20 messages
          });
        }

        // Handle status updates
        if (data.type === 'status') {
          setAgentStatus(data.message || data.status);
        }

        // Handle emotion updates
        if (data.type === 'emotion') {
          setEmotion(data.value || 'neutral');
        }
      } catch (e) {
        console.debug('Non-JSON data received:', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Sidebar variant - full height chat
  if (variant === 'sidebar') {
    return (
      <EmotionContext.Provider value={{ emotion, agentStatus }}>
        <div className="h-full flex flex-col bg-gray-900 text-white">
          {/* Status */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agentStatus.includes('Ouvindo') ? 'bg-green-500' :
              agentStatus.includes('Processando') ? 'bg-yellow-500' :
              'bg-blue-500'
            }`} />
            <span className="text-gray-300 text-xs">{agentStatus}</span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3">
            {messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                <div className={`flex items-start gap-2 ${
                  msg.speaker === 'user' ? 'flex-row-reverse' : ''
                }`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                    msg.speaker === 'user'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-600 text-gray-200'
                  }`}>
                    {msg.speaker === 'user' ? 'Vc' : 'Av'}
                  </div>

                  {/* Message */}
                  <div className={`flex-1 ${msg.speaker === 'user' ? 'text-right' : ''}`}>
                    {!msg.isFinal ? (
                      <div className={`inline-flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <TypingIndicator speaker={msg.speaker} />
                      </div>
                    ) : (
                      <p className={`text-sm leading-relaxed ${
                        msg.speaker === 'user' ? 'text-yellow-300' : 'text-gray-100'
                      }`}>
                        {highlightKeywords(msg.text)}
                      </p>
                    )}
                    {msg.isFinal && (
                      <span className="text-[10px] text-gray-500">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                A conversa aparecera aqui
              </div>
            )}
          </div>
        </div>
      </EmotionContext.Provider>
    );
  }

  // Overlay variant - floating at bottom (original)
  return (
    <EmotionContext.Provider value={{ emotion, agentStatus }}>
      <div className="absolute bottom-24 left-4 right-4 max-w-2xl mx-auto">
        {/* Agent Status */}
        <div className="flex items-center justify-center mb-3">
          <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 border border-gray-700">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              agentStatus.includes('Ouvindo') ? 'bg-green-500' :
              agentStatus.includes('Processando') ? 'bg-yellow-500' :
              'bg-blue-500'
            }`} />
            <span className="text-gray-200 text-sm">{agentStatus}</span>
          </div>
        </div>

        {/* Transcription Messages */}
        <div ref={scrollRef} className="max-h-40 overflow-y-auto space-y-2 scrollbar-hide">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {!msg.isFinal ? (
                <TypingIndicator speaker={msg.speaker} />
              ) : (
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.speaker === 'user'
                      ? 'bg-yellow-400 text-gray-900 rounded-br-sm'
                      : 'bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700'
                  }`}
                >
                  <p className="text-sm">{highlightKeywords(msg.text)}</p>
                </div>
              )}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4 bg-gray-900/60 rounded-lg">
              A transcrição aparecerá aqui durante a conversa
            </div>
          )}
        </div>
      </div>
    </EmotionContext.Provider>
  );
}
