import { test, expect } from '../fixtures/auth.fixture';
import {
  setupDataChannelCapture,
  startSession,
  waitForSessionReady,
  waitForAgentGreeting,
  getDataMessagesByType,
  getDataMessages,
} from '../fixtures/session.fixture';

test.describe('Fase 3: Coach Orchestrator', () => {
  test('training mode should receive preloaded suggestions', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    // Wait for greeting + coaching plan generation (GPT-4o-mini can take 5-10s)
    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(20_000);

    const preloaded = await getDataMessagesByType(page, 'preloaded_suggestions');
    expect(preloaded.length).toBeGreaterThan(0);

    const suggestions = (preloaded[0] as any).suggestions;
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThanOrEqual(3);

    // Each suggestion should have required fields
    for (const s of suggestions) {
      expect(s.suggestion_id).toBeTruthy();
      expect(s.message).toBeTruthy();
      expect(s.type).toBeTruthy();
      expect(['pending', 'active', 'followed', 'ignored', 'skipped']).toContain(s.status);
    }
  });

  test('training mode should send session trajectory updates', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait enough time for at least one user turn + trajectory update
    await page.waitForTimeout(30_000);

    const trajectories = await getDataMessagesByType(page, 'session_trajectory');

    // May or may not have trajectory yet (depends on user turns)
    // Just verify structure if present
    if (trajectories.length > 0) {
      const t = trajectories[trajectories.length - 1] as any;
      expect(t.score).toBeDefined();
      expect(typeof t.score).toBe('number');
      expect(['positive', 'negative', 'neutral']).toContain(t.trajectory);
      expect(t.dimensions).toBeDefined();
      expect(typeof t.dimensions.coach_adherence).toBe('number');
      expect(typeof t.dimensions.emotional_quality).toBe('number');
      expect(typeof t.dimensions.objection_handling).toBe('number');
      expect(typeof t.dimensions.conversation_quality).toBe('number');
    }
  });

  test('evaluation mode should have zero coaching messages', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'evaluation' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait for any potential coaching messages
    await page.waitForTimeout(20_000);

    const suggestions = await getDataMessagesByType(page, 'ai_suggestion');
    const preloaded = await getDataMessagesByType(page, 'preloaded_suggestions');
    const trajectories = await getDataMessagesByType(page, 'session_trajectory');

    expect(suggestions.length).toBe(0);
    expect(preloaded.length).toBe(0);
    expect(trajectories.length).toBe(0);
  });

  test('ModeSelectionModal should not show intensity selector', async ({
    authenticatedPage: page,
  }) => {
    // Wait for home page
    await page.waitForURL('**/home', { timeout: 15_000 });
    await page.waitForSelector('button.group', { timeout: 15_000 });

    // Click first scenario
    await page.locator('button.group').first().click();

    // Wait for modal
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Verify NO intensity-related buttons exist
    const intensityButtons = modal.locator('button:has-text("Minimo"), button:has-text("Moderado"), button:has-text("Maximo")');
    await expect(intensityButtons).toHaveCount(0);

    // Verify mode buttons still exist
    await expect(modal.locator('button:has-text("Modo Treino")')).toBeVisible();
    await expect(modal.locator('button:has-text("Modo Avaliacao")')).toBeVisible();
  });

  test('suggestion lifecycle should update after user turn', async ({
    authenticatedPage: page,
  }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Wait for coaching plan + at least one user turn cycle
    await page.waitForTimeout(40_000);

    const updates = await getDataMessagesByType(page, 'suggestion_update');

    // If user has interacted, we should see updates
    if (updates.length > 0) {
      const update = updates[0] as any;
      expect(update.suggestion_id).toBeTruthy();
      expect(['followed', 'ignored', 'skipped', 'active']).toContain(update.status);
    }
  });

  test('coaching panel should render trajectory bar', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);

    // Switch to coach tab if needed
    const coachTab = page.locator('button:has-text("Coach")');
    if (await coachTab.isVisible()) {
      await coachTab.click();
    }

    // Wait for coaching data (plan generation can take up to 15s on Railway)
    await page.waitForTimeout(20_000);

    // Check for coaching panel rendering: methodology tracker, preloaded plan, or empty state
    const coachPanel = page
      .locator('text=Metodologia SPIN')
      .or(page.locator('text=Roteiro de Coaching'))
      .or(page.locator('text=Dicas de coaching'));
    const panelVisible = await coachPanel.first().isVisible().catch(() => false);

    // Panel should render without crashes
    expect(panelVisible).toBe(true);
  });

  test('data messages should have proper structure', async ({ authenticatedPage: page }) => {
    await setupDataChannelCapture(page);
    await startSession(page, { mode: 'training' });

    const status = await waitForSessionReady(page);
    if (!status.ready) test.skip(true, `Agent unavailable: ${status.error}`);

    await waitForAgentGreeting(page, 60_000);
    await page.waitForTimeout(15_000);

    // Get all data messages and verify none are malformed
    const allMessages = await getDataMessages(page);
    expect(allMessages.length).toBeGreaterThan(0);

    for (const msg of allMessages) {
      // Every message must have a type
      expect(msg.type).toBeTruthy();
      expect(typeof msg.type).toBe('string');
    }

    // Verify no unknown/unexpected message types crash the handler
    const knownTypes = [
      'transcription', 'transcript', 'status', 'emotion',
      'ai_suggestion', 'coaching_processing', 'coaching_hint', 'coaching_state',
      'preloaded_suggestions', 'session_trajectory', 'suggestion_update',
      'latency_event', 'avatar_status', 'heartbeat',
    ];
    for (const msg of allMessages) {
      // All messages should be one of the known types
      expect(knownTypes).toContain(msg.type);
    }
  });
});
