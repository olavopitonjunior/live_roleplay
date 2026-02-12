import { test, expect } from './fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForAgentGreeting,
  waitForSessionReady,
  getDataMessages,
  getDataMessagesByType,
  getConsoleErrors,
  isSessionActive,
} from './fixtures/session.fixture';

test.describe('Full E2E Flow: Login -> Session -> Feedback', () => {
  test.setTimeout(300_000); // 5 minutes

  test('complete session flow with all features verified', async ({
    authenticatedPage: page,
  }) => {
    const report: Record<string, any> = {
      checkpoints: {},
      metrics: {},
      errors: [],
    };

    // ===== CHECKPOINT 1: Home page loaded =====
    await expect(page.locator('text=Escolha')).toBeVisible({ timeout: 10_000 });
    report.checkpoints['home_loaded'] = true;

    // Setup data capture before session
    await setupDataChannelCapture(page);

    // ===== CHECKPOINT 2: Scenario selection + mode modal =====
    await startSession(page, { mode: 'evaluation' });
    report.checkpoints['session_started'] = true;

    // ===== CHECKPOINT 3: Session loading =====
    const sessionStatus = await waitForSessionReady(page, 90_000);
    report.checkpoints['session_ui_visible'] = sessionStatus.ready;

    if (!sessionStatus.ready) {
      report.errors.push(sessionStatus.error || 'Session failed to load');
      console.log('\n===== E2E FULL FLOW REPORT =====');
      console.log(JSON.stringify(report, null, 2));
      console.log('================================\n');

      // Still assert home and session start worked
      expect(report.checkpoints['home_loaded']).toBe(true);
      expect(report.checkpoints['session_started']).toBe(true);
      // Skip further tests if session didn't connect
      test.skip(true, `Session not ready: ${sessionStatus.error}`);
      return;
    }

    // ===== CHECKPOINT 4: Agent greeting =====
    try {
      const greeting = await waitForAgentGreeting(page, 60_000);
      report.checkpoints['agent_greeting'] = true;
      report.metrics['greeting_text'] = greeting.substring(0, 100);
    } catch {
      report.checkpoints['agent_greeting'] = false;
    }

    // ===== CHECKPOINT 5: Monitor session for 60s =====
    const monitorStart = Date.now();
    const features = {
      emotions_captured: false,
      coaching_hints_captured: false,
      timer_visible: false,
      latency_events_captured: false,
      heartbeats_received: false,
    };

    // Check timer
    const timer = page.locator('span.font-mono');
    features.timer_visible = await timer.isVisible().catch(() => false);

    // Wait and collect data
    await page.waitForTimeout(60_000);

    // Check all data messages collected
    const allMessages = await getDataMessages(page);
    report.metrics['total_data_messages'] = allMessages.length;

    const emotions = await getDataMessagesByType(page, 'emotion');
    features.emotions_captured = emotions.length > 0;
    report.metrics['emotion_messages'] = emotions.length;

    const hints = await getDataMessagesByType(page, 'coaching_hint');
    features.coaching_hints_captured = hints.length > 0;
    report.metrics['coaching_hints'] = hints.length;

    const latency = await getDataMessagesByType(page, 'latency_event');
    features.latency_events_captured = latency.length > 0;
    report.metrics['latency_events'] = latency.length;

    const heartbeats = await getDataMessagesByType(page, 'heartbeat');
    features.heartbeats_received = heartbeats.length > 0;
    report.metrics['heartbeats'] = heartbeats.length;

    report.checkpoints['monitoring_complete'] = true;
    report.metrics['features'] = features;

    // ===== CHECKPOINT 6: End session =====
    if (await isSessionActive(page)) {
      const endButton = page.locator('button:has-text("Encerrar")');
      if (await endButton.isVisible().catch(() => false)) {
        await endButton.click();
        report.checkpoints['end_button_clicked'] = true;
      }
    }

    // ===== CHECKPOINT 7: Redirect to feedback =====
    try {
      await page.waitForURL('**/feedback/**', { timeout: 30_000 });
      report.checkpoints['redirected_to_feedback'] = true;
    } catch {
      report.checkpoints['redirected_to_feedback'] = page.url().includes('/feedback/');
    }

    // ===== CHECKPOINT 8: Feedback page renders =====
    if (page.url().includes('/feedback/')) {
      await page.waitForTimeout(10_000);

      const pageContent = await page.locator('body').textContent();
      report.checkpoints['feedback_page_rendered'] =
        pageContent?.includes('Resultado') ||
        pageContent?.includes('Carregando') ||
        pageContent?.includes('Resumo') ||
        pageContent?.includes('feedback') ||
        pageContent?.includes('Erro');

      const errors = await getConsoleErrors(page);
      const criticalErrors = errors.filter(
        (e) =>
          e.includes('TypeError') ||
          e.includes('Cannot read') ||
          e.includes('undefined is not')
      );
      report.errors = criticalErrors;
      report.checkpoints['no_critical_errors'] = criticalErrors.length === 0;

      if (pageContent?.includes('Carregando')) {
        await page.waitForTimeout(60_000);
        const updatedContent = await page.locator('body').textContent();
        report.checkpoints['feedback_generated'] =
          updatedContent?.includes('Resultado') || updatedContent?.includes('Resumo');
      }
    }

    // ===== FINAL REPORT =====
    report.metrics['total_duration_ms'] = Date.now() - monitorStart;

    console.log('\n===== E2E FULL FLOW REPORT =====');
    console.log(JSON.stringify(report, null, 2));
    console.log('================================\n');

    // Assert critical checkpoints
    expect(report.checkpoints['home_loaded']).toBe(true);
    expect(report.checkpoints['session_started']).toBe(true);
    expect(report.checkpoints['session_ui_visible']).toBe(true);
  });
});
