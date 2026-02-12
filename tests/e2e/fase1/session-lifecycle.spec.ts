import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getDataMessages,
  isSessionActive,
} from '../fixtures/session.fixture';

test.describe('Fase 1A: Session lifecycle -- inactivity detection', () => {
  test.setTimeout(180_000); // 3 minutes

  test('agent should send inactivity ping after 60s of silence', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    const initialMessages = await getDataMessages(page);
    const initialCount = initialMessages.length;

    // Wait 70s without interaction (user_away_timeout=60s + buffer)
    await page.waitForTimeout(70_000);

    const allMessages = await getDataMessages(page);
    const newMessages = allMessages.slice(initialCount);
    const agentTranscriptions = newMessages.filter(
      (m) =>
        m.type === 'transcription' && (m.speaker === 'agent' || m.speaker === 'avatar' || m.role === 'agent')
    );

    const inactivityPing = agentTranscriptions.find((m) => {
      const text = String(m.text || m.content || '').toLowerCase();
      return text.includes('tudo bem') || text.includes('continuar') || text.includes('retomar');
    });

    expect(inactivityPing).toBeDefined();
  });

  test('agent heartbeat should be active during session', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(15_000);

    const allMessages = await getDataMessages(page);
    const heartbeats = allMessages.filter((m) => m.type === 'heartbeat');
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
  });

  test('session should remain active with agent participating', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    expect(await isSessionActive(page)).toBe(true);
    await expect(page.locator('span.font-mono')).toBeVisible();
    await expect(page.locator('button:has-text("Encerrar")')).toBeVisible();
  });
});
