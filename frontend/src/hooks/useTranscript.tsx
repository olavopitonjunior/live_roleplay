import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import type { PreloadedSuggestion, SessionTrajectory } from '../types';

// Types
export interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'avatar';
  text: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface CoachingHint {
  id: string;
  type: 'encouragement' | 'warning' | 'suggestion' | 'reminder' | 'objection';
  title: string;
  message: string;
  priority: number;
  methodology_step?: string;
  timestamp: string;
}

export interface AISuggestion {
  id: string;
  type: 'question' | 'statement' | 'technique' | 'objection_response' | 'encouragement';
  title: string;
  message: string;
  context: string;
  priority: number;
  methodology_step?: string;
  is_streaming: boolean;
  confidence: number;
  timestamp: string;
}

export interface MethodologyProgress {
  situation: boolean;
  problem: boolean;
  implication: boolean;
  need_payoff: boolean;
  completion_percentage: number;
}

export interface Objection {
  id: string;
  text: string;
  category: string;
  addressed: boolean;
  timestamp: string;
}

export interface CoachingState {
  methodology: MethodologyProgress | null;
  objections: Objection[];
  addressed_objections: Objection[];
  recent_hints: CoachingHint[];
  talk_ratio: number;
  user_word_count: number;
  avatar_word_count: number;
}

// PreloadedSuggestion and SessionTrajectory imported from '../types'

interface TranscriptContextType {
  // Transcript data
  messages: TranscriptMessage[];
  agentStatus: string;
  emotion: string;

  // Coaching data
  hints: CoachingHint[];
  latestHint: CoachingHint | null;
  aiSuggestion: AISuggestion | null;
  coachingState: CoachingState | null;
  isProcessing: boolean;

  // Orchestrator data
  preloadedSuggestions: PreloadedSuggestion[];
  sessionTrajectory: SessionTrajectory | null;
}

const TranscriptContext = createContext<TranscriptContextType | null>(null);

interface TranscriptProviderProps {
  children: ReactNode;
}

/**
 * Provider that manages transcript and coaching state.
 * This state persists across tab switches (Chat/Coach/Info).
 */
export function TranscriptProvider({ children }: TranscriptProviderProps) {
  // Transcript state
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<string>('Aguardando...');
  const [emotion, setEmotion] = useState<string>('neutral');

  // Coaching state
  const [hints, setHints] = useState<CoachingHint[]>([]);
  const [latestHint, setLatestHint] = useState<CoachingHint | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [coachingState, setCoachingState] = useState<CoachingState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Orchestrator state
  const [preloadedSuggestions, setPreloadedSuggestions] = useState<PreloadedSuggestion[]>([]);
  const [sessionTrajectory, setSessionTrajectory] = useState<SessionTrajectory | null>(null);

  const room = useRoomContext();

  // Single listener for all data from the agent
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
            return [...prev.slice(-50), newMessage]; // Keep last 50 messages
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

        // Handle AI suggestion
        if (data.type === 'ai_suggestion') {
          const suggestionType = data.suggestionType || 'question';
          const suggestion: AISuggestion = {
            id: data.id,
            type: suggestionType,
            title: data.title,
            message: data.message,
            context: data.context || '',
            priority: data.priority,
            methodology_step: data.methodology_step,
            is_streaming: data.is_streaming || false,
            confidence: data.confidence || 1.0,
            timestamp: data.timestamp,
          };

          setAiSuggestion(suggestion);
          setIsProcessing(false);

          // Auto-clear after 8 seconds
          setTimeout(() => setAiSuggestion(null), 8000);
        }

        // Handle processing state
        if (data.type === 'coaching_processing') {
          setIsProcessing(true);
        }

        // Handle coaching hint (keyword-based)
        if (data.type === 'coaching_hint') {
          const hintType = data.hintType || 'suggestion';
          const hint: CoachingHint = {
            id: data.id,
            type: hintType,
            title: data.title,
            message: data.message,
            priority: data.priority,
            methodology_step: data.methodology_step,
            timestamp: data.timestamp,
          };

          setHints(prev => {
            const newHints = [...prev, hint];
            return newHints.slice(-10); // Keep last 10 hints
          });
          setLatestHint(hint);

          // Auto-clear latest hint after 3 seconds
          setTimeout(() => setLatestHint(null), 3000);
        }

        // Handle full coaching state update
        if (data.type === 'coaching_state') {
          setCoachingState({
            methodology: data.methodology,
            objections: data.objections || [],
            addressed_objections: data.addressed_objections || [],
            recent_hints: data.recent_hints || [],
            talk_ratio: data.talk_ratio || 50,
            user_word_count: data.user_word_count || 0,
            avatar_word_count: data.avatar_word_count || 0,
          });
        }

        // Handle preloaded suggestions from orchestrator
        if (data.type === 'preloaded_suggestions') {
          setPreloadedSuggestions(data.suggestions || []);
        }

        // Handle session trajectory update from orchestrator
        if (data.type === 'session_trajectory') {
          setSessionTrajectory({
            score: data.score,
            trajectory: data.trajectory,
            dimensions: data.dimensions || {},
          });
        }

        // Handle suggestion lifecycle status update
        if (data.type === 'suggestion_update') {
          setPreloadedSuggestions(prev =>
            prev.map(s =>
              s.suggestion_id === data.suggestion_id
                ? { ...s, status: data.status }
                : s
            )
          );
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const value: TranscriptContextType = {
    messages,
    agentStatus,
    emotion,
    hints,
    latestHint,
    aiSuggestion,
    coachingState,
    isProcessing,
    preloadedSuggestions,
    sessionTrajectory,
  };

  return (
    <TranscriptContext.Provider value={value}>
      {children}
    </TranscriptContext.Provider>
  );
}

/**
 * Hook to access transcript and coaching data.
 * Must be used within a TranscriptProvider.
 */
export function useTranscript() {
  const context = useContext(TranscriptContext);
  if (!context) {
    throw new Error('useTranscript must be used within a TranscriptProvider');
  }
  return context;
}

/**
 * Hook for emotion data only (backward compatibility).
 */
export function useEmotion() {
  const { emotion, agentStatus } = useTranscript();
  return { emotion, agentStatus };
}
