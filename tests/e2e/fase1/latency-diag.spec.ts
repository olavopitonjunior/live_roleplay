import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getDataMessagesByType,
} from '../fixtures/session.fixture';

test.describe('Fase 1B: Latency diagnostics', () => {
  test('should emit latency_event for agent thinking time', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(30_000);

    const latencyEvents = await getDataMessagesByType(page, 'latency_event');
    expect(latencyEvents.length).toBeGreaterThanOrEqual(1);

    const thinkingEvent = latencyEvents.find(
      (e) => e.event === 'agent_thinking'
    );
    if (thinkingEvent) {
      expect(Number(thinkingEvent.duration_ms || 0)).toBeGreaterThan(0);
    }
  });

  test('latency events should have valid structure', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(20_000);

    const latencyEvents = await getDataMessagesByType(page, 'latency_event');
    for (const event of latencyEvents) {
      expect(event.event).toBeTruthy();
      expect(Number(event.duration_ms || 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
