import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  isSessionActive,
} from '../fixtures/session.fixture';

test.describe('FIX 2: Session end false positive prevention', () => {
  test('session should NOT end prematurely during normal conversation', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Monitor session stability for 60 seconds
    for (const seconds of [15, 30, 45, 60]) {
      await page.waitForTimeout(seconds === 15 ? 15_000 : 15_000);
      expect(await isSessionActive(page)).toBe(true);
    }

    // Verify timer and end button visible
    await expect(page.locator('span.font-mono')).toBeVisible();
    await expect(page.locator('button:has-text("Encerrar")')).toBeVisible();
  });

  test('session URL should remain on /session/ path for 60s', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(60_000);

    expect(page.url()).toContain('/session/');
    expect(page.url()).not.toContain('/feedback/');
  });
});
