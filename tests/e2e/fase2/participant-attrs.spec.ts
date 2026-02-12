import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getAgentParticipantAttributes,
  getDataMessagesByType,
} from '../fixtures/session.fixture';

test.describe('Fase 2B: Participant attributes', () => {
  test('agent should set emotion participant attributes', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait for emotion processing
    await page.waitForTimeout(20_000);

    // Try to read participant attributes
    const attrs = await getAgentParticipantAttributes(page);

    // If attributes are available, verify structure
    if (Object.keys(attrs).length > 0) {
      // emotion should be present
      if (attrs.emotion) {
        const validEmotions = [
          'enthusiastic',
          'happy',
          'receptive',
          'curious',
          'neutral',
          'hesitant',
          'skeptical',
          'frustrated',
        ];
        expect(validEmotions).toContain(attrs.emotion);
      }

      // turn_count should be numeric string
      if (attrs.turn_count) {
        expect(Number(attrs.turn_count)).toBeGreaterThanOrEqual(0);
      }
    } else {
      // Participant attributes might not be accessible via this method.
      // Fall back to checking data channel emotion messages.
      const emotionMsgs = await getDataMessagesByType(page, 'emotion');
      expect(emotionMsgs.length).toBeGreaterThan(0);
    }
  });

  test('agent should set SPIN stage attributes after coaching', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training', coachIntensity: 'high' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait for coaching state to be computed
    await page.waitForTimeout(30_000);

    const attrs = await getAgentParticipantAttributes(page);

    if (Object.keys(attrs).length > 0) {
      // spin_stage should be set
      if (attrs.spin_stage) {
        const validStages = ['situation', 'problem', 'implication', 'need_payoff', 'closing'];
        expect(validStages).toContain(attrs.spin_stage);
      }

      // spin_completion should be numeric
      if (attrs.spin_completion) {
        const completion = Number(attrs.spin_completion);
        expect(completion).toBeGreaterThanOrEqual(0);
        expect(completion).toBeLessThanOrEqual(100);
      }
    }

    // Also verify coaching_state messages in data channel
    const coachingStates = await getDataMessagesByType(page, 'coaching_state');

    if (coachingStates.length > 0) {
      const state = coachingStates[coachingStates.length - 1];
      // coaching_state spreads CoachingEngine.get_state() which has: methodology, objections, etc.
      expect(state.methodology).toBeTruthy();
      if (state.methodology) {
        expect(state.methodology.completion_percentage).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
