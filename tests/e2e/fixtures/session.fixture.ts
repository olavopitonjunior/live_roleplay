import { Page, expect } from '@playwright/test';

export interface DataMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Initializes data message capture and console error tracking.
 * In E2E mode, SessionRoom exposes data messages to window.__testDataMessages
 * via the RoomEvent.DataReceived handler (app-level, not RTCDataChannel-level).
 */
export async function setupDataChannelCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__testDataMessages = (window as any).__testDataMessages || [];
    (window as any).__testConsoleErrors = [];

    // Capture console errors
    const origError = console.error;
    console.error = function (...args: any[]) {
      (window as any).__testConsoleErrors.push(args.map(String).join(' '));
      origError.apply(console, args);
    };
  });
}

/**
 * Get all captured data channel messages.
 */
export async function getDataMessages(page: Page): Promise<DataMessage[]> {
  return page.evaluate(() => (window as any).__testDataMessages || []);
}

/**
 * Get captured data messages filtered by type.
 */
export async function getDataMessagesByType(
  page: Page,
  type: string
): Promise<DataMessage[]> {
  const all = await getDataMessages(page);
  return all.filter((m) => m.type === type);
}

/**
 * Get captured console errors.
 */
export async function getConsoleErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__testConsoleErrors || []);
}

/**
 * Wait for a data channel message of a specific type.
 */
export async function waitForDataMessage(
  page: Page,
  type: string,
  timeoutMs: number = 60_000
): Promise<DataMessage> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const messages = await getDataMessagesByType(page, type);
    if (messages.length > 0) {
      return messages[messages.length - 1];
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(`Timeout waiting for data message type="${type}" after ${timeoutMs}ms`);
}

/**
 * Select a scenario and start a session.
 * Returns after the session page loads.
 */
export async function startSession(
  page: Page,
  options: {
    scenarioIndex?: number;
    mode?: 'training' | 'evaluation';
  } = {}
): Promise<void> {
  const { scenarioIndex = 0, mode = 'training' } = options;

  // Ensure we're on home
  await page.waitForURL('**/home', { timeout: 15_000 });

  // Wait for scenario cards to load (cards contain "Comecar treino" CTA)
  await page.waitForSelector('button:has-text("Comecar treino")', { timeout: 15_000 });

  // Click scenario card (filter to only cards with CTA text, not category toggles)
  const cards = page.locator('button:has-text("Comecar treino")');
  await cards.nth(scenarioIndex).click();

  // Wait for mode modal
  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // Select mode
  if (mode === 'evaluation') {
    await modal.locator('button:has-text("Modo Avaliacao")').click();
  } else {
    await modal.locator('button:has-text("Modo Treino")').click();
  }

  // Start session (JS click — modal may overflow fixed viewport)
  await modal.locator('button:has-text("Iniciar Sessao")').dispatchEvent('click');

  // Wait for session page
  await page.waitForURL(/\/session\//, { timeout: 30_000 });
}

/**
 * Wait for the session to be fully connected (loading complete).
 * Checks for the timer element OR error states.
 */
export async function waitForSessionReady(
  page: Page,
  timeoutMs: number = 90_000
): Promise<{ ready: boolean; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();

    // If redirected to feedback — session ended or errored
    if (url.includes('/feedback/')) {
      return { ready: false, error: 'Redirected to feedback page (session may have failed)' };
    }

    // Check for error states
    const errorText = await page.locator('text=Erro').first().isVisible().catch(() => false);
    if (errorText) {
      const msg = await page.locator('body').textContent();
      return { ready: false, error: `Error on page: ${msg?.substring(0, 200)}` };
    }

    // Check for retry button (loading error)
    const retryBtn = await page.locator('button:has-text("Tentar novamente")').isVisible().catch(() => false);
    if (retryBtn) {
      return { ready: false, error: 'Session loading failed — retry button visible' };
    }

    // Check for timer (session active)
    const timerVisible = await page.locator('span.font-mono').isVisible().catch(() => false);
    if (timerVisible) {
      return { ready: true };
    }

    // Check for loading steps (still loading)
    const loadingSteps = await page.locator('text=Conectando').isVisible().catch(() => false);
    if (loadingSteps) {
      // Still loading, keep waiting
    }

    await page.waitForTimeout(2000);
  }
  return { ready: false, error: `Timeout after ${timeoutMs}ms waiting for session` };
}

/**
 * Wait for the agent to send a greeting (first agent transcript).
 */
export async function waitForAgentGreeting(
  page: Page,
  timeoutMs: number = 60_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const messages = await getDataMessagesByType(page, 'transcription');
    const agentMessages = messages.filter((m) =>
      m.speaker === 'agent' || m.speaker === 'avatar' || m.role === 'agent'
    );
    if (agentMessages.length > 0) {
      return String(agentMessages[0].text || agentMessages[0].content || '');
    }
    await page.waitForTimeout(2000);
  }
  throw new Error(`Agent greeting not received within ${timeoutMs}ms`);
}

/**
 * Check if session is still active (not redirected to feedback).
 */
export async function isSessionActive(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes('/session/') && !url.includes('/feedback/');
}

/**
 * Get participant attributes from the agent (remote participant).
 */
export async function getAgentParticipantAttributes(
  page: Page
): Promise<Record<string, string>> {
  return page.evaluate(() => {
    // Try to access LiveKit room from React context
    const roomEl = document.querySelector('[data-lk-room]');
    if (roomEl) {
      const room = (roomEl as any).__lkRoom;
      if (room) {
        for (const [, participant] of room.remoteParticipants) {
          if (participant.attributes) {
            return { ...participant.attributes };
          }
        }
      }
    }
    return {};
  });
}
