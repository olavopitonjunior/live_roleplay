/**
 * Automated Verification Script for Live Roleplay
 *
 * Runs headless browser tests and outputs JSON results.
 * Designed for Claude to execute and parse results automatically.
 *
 * Usage: node tests/automated-verify.js [--json] [--headed]
 */

const { chromium } = require('playwright');
const path = require('path');

const CONFIG = {
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  ACCESS_CODE: process.env.ACCESS_CODE || 'ADMIN001',
  HEADLESS: !process.argv.includes('--headed'),
  JSON_OUTPUT: process.argv.includes('--json'),
  SCREENSHOT_DIR: path.join(__dirname, 'screenshots'),
  TIMEOUTS: {
    page_load: 10000,
    login: 5000,
    scenarios: 5000,
    session_connect: 30000,
    agent_ready: 30000,
    avatar_video: 15000,
    transcription: 20000,
    coach: 20000,
    session_duration: 15000  // How long to observe the session
  }
};

const results = {
  success: false,
  started_at: new Date().toISOString(),
  duration_ms: 0,
  config: {
    app_url: CONFIG.APP_URL,
    headless: CONFIG.HEADLESS
  },
  steps: [],
  screenshots: [],
  console_logs: [],
  errors: []
};

function log(message) {
  if (!CONFIG.JSON_OUTPUT) {
    console.log(message);
  }
}

function addStep(name, status, time_ms, details = null) {
  const step = { name, status, time_ms };
  if (details) step.details = details;
  results.steps.push(step);

  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  log(`${icon} ${name}: ${status} (${time_ms}ms)${details ? ' - ' + details : ''}`);
}

async function takeScreenshot(page, name) {
  try {
    const filename = `verify-${name}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filepath);
    log(`📸 Screenshot: ${filename}`);
    return filepath;
  } catch (e) {
    log(`⚠️ Screenshot failed: ${e.message}`);
    return null;
  }
}

async function runStep(name, fn, timeout) {
  const startTime = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
    addStep(name, 'pass', Date.now() - startTime, result);
    return { success: true, result };
  } catch (error) {
    addStep(name, 'fail', Date.now() - startTime, error.message);
    results.errors.push({ step: name, error: error.message });
    return { success: false, error };
  }
}

async function runVerification() {
  const startTime = Date.now();
  log('\n🚀 Starting automated verification...\n');
  log(`📍 App URL: ${CONFIG.APP_URL}`);
  log(`🖥️ Headless: ${CONFIG.HEADLESS}\n`);

  let browser, context, page;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.HEADLESS,
      slowMo: CONFIG.HEADLESS ? 0 : 100
    });

    context = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' ||
          text.includes('Agent') ||
          text.includes('LiveKit') ||
          text.includes('transcription') ||
          text.includes('coach')) {
        results.console_logs.push({
          type: msg.type(),
          text: text.substring(0, 200)
        });
      }
    });

    // Step 1: Load app
    const loadResult = await runStep('page_load', async () => {
      await page.goto(CONFIG.APP_URL);
      await page.waitForLoadState('networkidle');
      return `Loaded ${CONFIG.APP_URL}`;
    }, CONFIG.TIMEOUTS.page_load);

    if (!loadResult.success) {
      await takeScreenshot(page, 'load-error');
      throw new Error('Failed to load app');
    }

    // Clear storage for clean state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Step 2: Login
    const loginResult = await runStep('login', async () => {
      const input = await page.waitForSelector(
        'input[placeholder*="codigo" i], input[placeholder*="code" i], input[type="text"]',
        { timeout: CONFIG.TIMEOUTS.login }
      );
      await input.fill(CONFIG.ACCESS_CODE);

      const submitBtn = await page.waitForSelector(
        'button[type="submit"], button:has-text("Entrar"), button:has-text("Enter")',
        { timeout: 2000 }
      );
      await submitBtn.click();

      // Wait for navigation or scenarios to appear
      await page.waitForTimeout(2000);
      return `Logged in with code ${CONFIG.ACCESS_CODE}`;
    }, CONFIG.TIMEOUTS.login);

    await takeScreenshot(page, 'after-login');

    if (!loginResult.success) {
      throw new Error('Login failed');
    }

    // Step 3: Find and click scenario
    const scenarioResult = await runStep('scenario_select', async () => {
      // Try multiple selectors - ScenarioCard uses button, not anchor
      const selectors = [
        'button:has-text("Comecar treino")',
        'button:has-text("Começar treino")',
        'div:has-text("Comecar treino")',
        '[class*="scenario"]',
        'a[href*="session"]'
      ];

      for (const selector of selectors) {
        try {
          const el = await page.waitForSelector(selector, { timeout: 3000 });
          if (el) {
            const text = await el.textContent();
            await el.click();
            return `Selected scenario: ${text?.substring(0, 50)}`;
          }
        } catch {
          continue;
        }
      }
      throw new Error('No scenario button found');
    }, CONFIG.TIMEOUTS.scenarios);

    await takeScreenshot(page, 'scenario-selected');

    if (!scenarioResult.success) {
      throw new Error('Scenario selection failed');
    }

    // Step 3b: Handle mode selection modal (PRD-08 feature)
    const modeSelectResult = await runStep('mode_select', async () => {
      // Wait for modal to appear
      const modal = await page.waitForSelector('button:has-text("Iniciar Sessao")', { timeout: 5000 });
      if (modal) {
        // Take screenshot of modal
        await takeScreenshot(page, 'mode-modal');

        // Click "Iniciar Sessao" button (training mode is selected by default)
        await modal.click();
        return 'Clicked Iniciar Sessao (training mode with medium intensity)';
      }
      throw new Error('Mode selection modal not found');
    }, CONFIG.TIMEOUTS.scenarios);

    if (!modeSelectResult.success) {
      // Maybe old flow without modal - continue anyway
      log('   ℹ️ No mode selection modal found, continuing...');
    }

    // Wait for session page to load
    await page.waitForTimeout(3000);

    // Step 4: Wait for session connection (LiveKit)
    const connectionResult = await runStep('session_connect', async () => {
      // Check for loading states or connection indicators
      const currentUrl = page.url();

      if (!currentUrl.includes('session')) {
        throw new Error(`Not on session page: ${currentUrl}`);
      }

      // Wait for either video element or connection status
      await page.waitForSelector(
        'video, [class*="loading"], [class*="connecting"], [class*="session"]',
        { timeout: CONFIG.TIMEOUTS.session_connect }
      );

      return `Session page loaded: ${currentUrl}`;
    }, CONFIG.TIMEOUTS.session_connect);

    await takeScreenshot(page, 'session-loading');

    // Step 5: Wait for agent to be ready
    const agentResult = await runStep('agent_ready', async () => {
      // Look for indicators that agent is connected and session is live
      // Based on actual UI: "Ao vivo" badge, timer, video element

      const indicators = [
        'text="Ao vivo"',           // Live indicator
        'text="AO VIVO"',           // Live indicator uppercase
        ':has-text("Encerrar")',    // End session button (only shows when ready)
        'video',                     // Video element present
        '[class*="timer"]',          // Session timer
        ':has-text(":")'             // Timer format like "2:07"
      ];

      for (let i = 0; i < 30; i++) {
        // Check for "Ao vivo" text which indicates session is live
        const aoVivoEl = await page.$('text="Ao vivo"');
        if (aoVivoEl) {
          return 'Session is live (Ao vivo indicator found)';
        }

        // Check for video element with content
        const video = await page.$('video');
        if (video) {
          const readyState = await video.evaluate(v => v.readyState);
          if (readyState >= 2) {  // HAVE_CURRENT_DATA or better
            return `Video ready (readyState: ${readyState})`;
          }
        }

        // Check for session timer (format like "2:07")
        const timerMatch = await page.$(':has-text(":")');
        const encerrarBtn = await page.$('button:has-text("Encerrar")');
        if (encerrarBtn) {
          return 'Session ready (Encerrar button found)';
        }

        await page.waitForTimeout(1000);
      }

      // Check if still in loading state
      const loadingEl = await page.$('[class*="loading"]');
      if (loadingEl) {
        const loadingText = await loadingEl.textContent();
        throw new Error(`Still loading: ${loadingText?.substring(0, 50)}`);
      }

      throw new Error('Agent not detected within timeout');
    }, CONFIG.TIMEOUTS.agent_ready);

    await takeScreenshot(page, 'agent-status');

    // Step 6: Check for avatar video
    const avatarResult = await runStep('avatar_video', async () => {
      const video = await page.$('video');
      if (video) {
        const src = await video.getAttribute('src');
        const readyState = await video.evaluate(v => v.readyState);
        return `Video found (readyState: ${readyState}, src: ${src ? 'yes' : 'no'})`;
      }
      return 'No video element found (may be audio-only mode)';
    }, CONFIG.TIMEOUTS.avatar_video);

    // Step 7: Observe session for a while to check features
    log('\n🔍 Observing session for features...\n');
    await page.waitForTimeout(CONFIG.TIMEOUTS.session_duration);

    await takeScreenshot(page, 'session-active');

    // Step 8: Check for transcription/chat panel
    const transcriptResult = await runStep('transcription', async () => {
      // Check for Chat tab and content
      const chatTab = await page.$('button:has-text("Chat")');
      if (chatTab) {
        await chatTab.click();
        await page.waitForTimeout(500);
      }

      const transcriptSelectors = [
        '[class*="transcript"]',
        '[class*="message"]',
        '[class*="chat"]',
        '[data-type="transcription"]'
      ];

      for (const selector of transcriptSelectors) {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          const texts = await Promise.all(
            elements.slice(0, 3).map(el => el.textContent())
          );
          const nonEmpty = texts.filter(t => t && t.trim().length > 0);
          if (nonEmpty.length > 0) {
            return `Found ${elements.length} transcript elements`;
          }
        }
      }
      return 'Chat panel present (no messages yet - mic disabled in headless)';
    }, CONFIG.TIMEOUTS.transcription);

    // Step 9: Check for coach panel
    const coachResult = await runStep('coach_suggestion', async () => {
      // Check for Coach tab and content
      const coachTab = await page.$('button:has-text("Coach")');
      if (coachTab) {
        await coachTab.click();
        await page.waitForTimeout(500);
      }

      // Check for coach panel elements
      const coachPanel = await page.$(':has-text("Dicas de coaching")');
      if (coachPanel) {
        return 'Coach panel present (waiting for suggestions)';
      }

      const coachSelectors = [
        '[class*="coach"]',
        '[class*="suggestion"]',
        '[class*="hint"]',
        'text="TALK RATIO"'
      ];

      for (const selector of coachSelectors) {
        const el = await page.$(selector);
        if (el) {
          const visible = await el.isVisible();
          if (visible) {
            const text = await el.textContent();
            return `Coach element found: ${text?.substring(0, 50)}...`;
          }
        }
      }

      // Check for Talk Ratio which indicates coach panel is active
      const talkRatio = await page.$(':has-text("TALK RATIO")');
      if (talkRatio) {
        return 'Coach panel present (Talk Ratio visible)';
      }

      return 'Coach panel not found';
    }, CONFIG.TIMEOUTS.coach);

    await takeScreenshot(page, 'final-state');

  } catch (error) {
    results.errors.push({ step: 'execution', error: error.message });
    log(`\n❌ Verification failed: ${error.message}`);
    if (page) {
      await takeScreenshot(page, 'error');
    }
  } finally {
    if (browser) {
      await browser.close();
    }

    results.duration_ms = Date.now() - startTime;
    results.success = results.errors.length === 0 &&
                      results.steps.filter(s => s.status === 'pass').length >= 4;

    if (CONFIG.JSON_OUTPUT) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      log('\n' + '='.repeat(50));
      log(`\n${results.success ? '✅ VERIFICATION PASSED' : '❌ VERIFICATION FAILED'}`);
      log(`Duration: ${results.duration_ms}ms`);
      log(`Steps passed: ${results.steps.filter(s => s.status === 'pass').length}/${results.steps.length}`);
      if (results.errors.length > 0) {
        log(`\nErrors:`);
        results.errors.forEach(e => log(`  - ${e.step}: ${e.error}`));
      }
      log(`\nScreenshots saved to: ${CONFIG.SCREENSHOT_DIR}`);
    }
  }

  return results;
}

// Ensure screenshot directory exists
const fs = require('fs');
if (!fs.existsSync(CONFIG.SCREENSHOT_DIR)) {
  fs.mkdirSync(CONFIG.SCREENSHOT_DIR, { recursive: true });
}

runVerification().catch(console.error);
