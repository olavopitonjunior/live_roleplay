import { useMemo } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

export interface ParticipantAttributes {
  emotion: string | null;
  spinStage: string | null;
  conversationProgress: number | null;
}

/**
 * Reads real-time participant attributes set by the agent via LiveKit.
 * The agent sets attributes like emotion, spin_stage, conversation_progress
 * on its participant using set_attributes().
 */
export function useParticipantAttributes(): ParticipantAttributes {
  const participants = useRemoteParticipants();

  return useMemo(() => {
    // Find the agent participant (identity starts with "agent" or has attributes)
    const agent = participants.find(
      (p) => p.identity?.startsWith('agent') || p.metadata?.includes('agent')
    );

    if (!agent || !agent.attributes) {
      return { emotion: null, spinStage: null, conversationProgress: null };
    }

    const attrs = agent.attributes as Record<string, string>;

    return {
      emotion: attrs.emotion || null,
      spinStage: attrs.spin_stage || null,
      conversationProgress: attrs.conversation_progress
        ? parseFloat(attrs.conversation_progress)
        : null,
    };
  }, [participants]);
}
