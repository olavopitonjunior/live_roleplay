import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  getDataMessagesByType,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getConsoleErrors,
} from '../fixtures/session.fixture';

const VALID_EMOTIONS_EN = new Set([
  'enthusiastic', 'happy', 'receptive', 'curious',
  'neutral', 'hesitant', 'skeptical', 'frustrated',
]);

const EMOTIONS_PT_BR = new Set([
  'entusiasmado', 'satisfeito', 'receptivo', 'curioso',
  'neutro', 'hesitante', 'cetico', 'frustrado',
]);

test.describe('FIX 1: Emotion Enum PT-BR to EN mapping', () => {
  test('emotions sent by agent should be in English', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(15_000);

    let emotionMessages = await getDataMessagesByType(page, 'emotion');
    if (emotionMessages.length === 0) {
      await page.waitForTimeout(15_000);
      emotionMessages = await getDataMessagesByType(page, 'emotion');
    }

    expect(emotionMessages.length).toBeGreaterThan(0);

    for (const msg of emotionMessages) {
      const val = String(msg.value || msg.emotion || '');
      if (val) {
        expect(VALID_EMOTIONS_EN.has(val)).toBe(true);
        expect(EMOTIONS_PT_BR.has(val)).toBe(false);
      }
    }
  });

  test('no console errors from emotion handling', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(20_000);

    const errors = await getConsoleErrors(page);
    const emotionErrors = errors.filter(
      (e) =>
        e.toLowerCase().includes('emotion') ||
        e.toLowerCase().includes('avatar') ||
        e.toLowerCase().includes('cannot read')
    );
    expect(emotionErrors).toHaveLength(0);
  });
});
