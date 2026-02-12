import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  isSessionActive,
} from '../fixtures/session.fixture';

test.describe('FIX 3: Disconnect grace period (5s)', () => {
  test('session should survive brief network disconnection (<5s)', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    expect(await isSessionActive(page)).toBe(true);

    // Simulate network disconnection
    await page.context().setOffline(true);
    await page.waitForTimeout(3_000); // within 5s grace period
    await page.context().setOffline(false);
    await page.waitForTimeout(2_000);

    // Session should still be active
    expect(page.url()).toContain('/session/');
    expect(page.url()).not.toContain('/feedback/');
  });

  test('session elements remain visible after brief disconnect', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Brief disconnect
    await page.context().setOffline(true);
    await page.waitForTimeout(2_000);
    await page.context().setOffline(false);
    await page.waitForTimeout(3_000);

    await expect(page.locator('span.font-mono')).toBeVisible();
    await expect(page.locator('button:has-text("Encerrar")')).toBeVisible();
  });
});
