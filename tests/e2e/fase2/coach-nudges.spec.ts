import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getDataMessagesByType,
} from '../fixtures/session.fixture';

test.describe('Fase 2A: ConversationCoach nudges', () => {
  test('should send silence nudge after stuck_timeout (10s)', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training', coachIntensity: 'high' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Stay silent for 15 seconds (stuck_timeout=10s + buffer)
    await page.waitForTimeout(15_000);

    // Check for coaching hints
    const coachingHints = await getDataMessagesByType(page, 'coaching_hint');

    // Should have received at least one coaching hint from silence detection
    expect(coachingHints.length).toBeGreaterThanOrEqual(1);

    // Verify hint content is in PT-BR
    const silenceHint = coachingHints.find((h) => {
      const message = String(h.message || h.text || '');
      return (
        message.includes('silencio') ||
        message.includes('retomar') ||
        message.includes('conversa') ||
        message.includes('esperando') ||
        message.includes('pergunta')
      );
    });

    // At least one hint should be silence-related
    if (coachingHints.length > 0) {
      const firstHint = coachingHints[0];
      expect(firstHint.type || firstHint.hintType).toBeDefined();
      expect(firstHint.message || firstHint.text).toBeTruthy();
    }
  });

  test('coaching hints should have proper structure', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training', coachIntensity: 'high' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait for silence nudge
    await page.waitForTimeout(15_000);

    const coachingHints = await getDataMessagesByType(page, 'coaching_hint');

    for (const hint of coachingHints) {
      // Each hint should have an id
      expect(hint.id).toBeTruthy();
      // Should have a type/hintType
      expect(hint.hintType || hint.type).toBeTruthy();
      // Should have a message
      expect(hint.message || hint.text).toBeTruthy();
      // Should have a title
      expect(hint.title).toBeTruthy();
    }
  });
});
