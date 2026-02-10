/**
 * Automated Full Session Verification for Live Roleplay
 *
 * Runs a COMPLETE session from login to feedback with real data.
 * Stays in the session until timeout (~3 min) and verifies all features.
 *
 * Usage: node tests/automated-verify.js [--json] [--headed] [--production]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const isProduction = process.argv.includes('--production');

const CONFIG = {
  APP_URL: process.env.APP_URL || (isProduction ? 'https://liveroleplay.vercel.app' : 'http://localhost:5173'),
  ACCESS_CODE: process.env.ACCESS_CODE || 'ADMIN001',
  HEADLESS: !process.argv.includes('--headed'),
  JSON_OUTPUT: process.argv.includes('--json'),
  SCREENSHOT_DIR: path.join(__dirname, 'screenshots'),
  TIMEOUTS: {
    page_load: 15000,
    login: 8000,
    scenarios: 8000,
    session_connect: 30000,
    agent_ready: 45000,
    avatar_video: 15000,
    session_full: 240000,    // 4 min max for full session (3 min timeout + buffer)
    feedback_load: 90000,    // 1.5 min for feedback generation
    observation_interval: 15000  // Check features every 15s
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
  observations: [],
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

function addObservation(time_s, observation) {
  results.observations.push({ time_s, observation, timestamp: new Date().toISOString() });
  log(`   🔍 [${time_s}s] ${observation}`);
}

async function takeScreenshot(page, name) {
  try {
    const filename = `verify-${name}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filepath);
    log(`   📸 Screenshot: ${filename}`);
    return filepath;
  } catch (e) {
    log(`   ⚠️ Screenshot failed: ${e.message}`);
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
  log('\n🚀 LIVE ROLEPLAY - Full Session Verification\n');
  log(`📍 App URL: ${CONFIG.APP_URL}`);
  log(`🖥️  Headless: ${CONFIG.HEADLESS}`);
  log(`⏱️  Session timeout: ~3 min (will stay until end)\n`);

  let browser, context, page;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: CONFIG.HEADLESS,
      slowMo: CONFIG.HEADLESS ? 0 : 50
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
          text.includes('transcript') ||
          text.includes('coach') ||
          text.includes('emotion') ||
          text.includes('feedback')) {
        results.console_logs.push({
          type: msg.type(),
          text: text.substring(0, 300)
        });
      }
    });

    // ═══════════════════════════════════════════════
    // STEP 1: Load app
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 1: Loading app\n');

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

    // ═══════════════════════════════════════════════
    // STEP 2: Login
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 2: Login\n');

    const loginResult = await runStep('login', async () => {
      const input = await page.waitForSelector(
        'input[placeholder*="codigo" i], input[placeholder*="code" i], input[type="text"]',
        { timeout: CONFIG.TIMEOUTS.login }
      );
      await input.fill(CONFIG.ACCESS_CODE);

      const submitBtn = await page.waitForSelector(
        'button[type="submit"], button:has-text("Entrar"), button:has-text("Enter")',
        { timeout: 3000 }
      );
      await submitBtn.click();

      await page.waitForTimeout(2000);
      return `Logged in with ${CONFIG.ACCESS_CODE}`;
    }, CONFIG.TIMEOUTS.login);

    await takeScreenshot(page, 'after-login');
    if (!loginResult.success) throw new Error('Login failed');

    // ═══════════════════════════════════════════════
    // STEP 3: Select scenario
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 3: Select scenario\n');

    const scenarioResult = await runStep('scenario_select', async () => {
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
            return `Selected: ${text?.substring(0, 50)}`;
          }
        } catch {
          continue;
        }
      }
      throw new Error('No scenario button found');
    }, CONFIG.TIMEOUTS.scenarios);

    await takeScreenshot(page, 'scenario-selected');
    if (!scenarioResult.success) throw new Error('Scenario selection failed');

    // ═══════════════════════════════════════════════
    // STEP 3b: Mode selection modal
    // ═══════════════════════════════════════════════
    const modeResult = await runStep('mode_select', async () => {
      const modal = await page.waitForSelector(
        'button:has-text("Iniciar Sessao"), button:has-text("Iniciar Sessão")',
        { timeout: 5000 }
      );
      if (modal) {
        await takeScreenshot(page, 'mode-modal');
        await modal.click();
        return 'Training mode selected';
      }
      throw new Error('Mode modal not found');
    }, CONFIG.TIMEOUTS.scenarios);

    if (!modeResult.success) {
      log('   ℹ️ No mode modal, continuing...');
    }

    await page.waitForTimeout(3000);

    // ═══════════════════════════════════════════════
    // STEP 4: Session connection
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 4: Session connection\n');

    const connectResult = await runStep('session_connect', async () => {
      const currentUrl = page.url();
      if (!currentUrl.includes('session')) {
        throw new Error(`Not on session page: ${currentUrl}`);
      }
      await page.waitForSelector(
        'video, [class*="loading"], [class*="connecting"], [class*="session"]',
        { timeout: CONFIG.TIMEOUTS.session_connect }
      );
      return `Session page: ${currentUrl}`;
    }, CONFIG.TIMEOUTS.session_connect);

    await takeScreenshot(page, 'session-loading');

    // ═══════════════════════════════════════════════
    // STEP 5: Wait for agent
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 5: Waiting for agent\n');

    const agentResult = await runStep('agent_ready', async () => {
      for (let i = 0; i < 45; i++) {
        const encerrarBtn = await page.$('button:has-text("Encerrar")');
        if (encerrarBtn) {
          return 'Agent ready (Encerrar button found)';
        }

        const video = await page.$('video');
        if (video) {
          const readyState = await video.evaluate(v => v.readyState);
          if (readyState >= 2) {
            return `Video ready (readyState: ${readyState})`;
          }
        }

        await page.waitForTimeout(1000);
      }
      throw new Error('Agent not detected within timeout');
    }, CONFIG.TIMEOUTS.agent_ready);

    await takeScreenshot(page, 'agent-ready');

    // ═══════════════════════════════════════════════
    // STEP 6: Avatar video check
    // ═══════════════════════════════════════════════
    const avatarResult = await runStep('avatar_video', async () => {
      const video = await page.$('video');
      if (video) {
        const readyState = await video.evaluate(v => v.readyState);
        return `Video element present (readyState: ${readyState})`;
      }
      return 'No video element (audio-only mode)';
    }, CONFIG.TIMEOUTS.avatar_video);

    // ═══════════════════════════════════════════════
    // STEP 7: FULL SESSION OBSERVATION (~3 min)
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 7: Full session observation (staying until end)\n');

    const sessionStartTime = Date.now();
    let sessionEnded = false;
    let greetingDetected = false;
    let emotionDetected = false;
    let timerDetected = false;
    let coachDetected = false;
    let warningDetected = false;
    let observationCount = 0;

    const sessionResult = await runStep('full_session', async () => {
      while (!sessionEnded && (Date.now() - sessionStartTime) < CONFIG.TIMEOUTS.session_full) {
        observationCount++;
        const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);

        // Check if we left the session page (redirect to feedback)
        const currentUrl = page.url();
        if (currentUrl.includes('/feedback/')) {
          sessionEnded = true;
          addObservation(elapsed, 'Session ended - redirected to feedback page');
          break;
        }

        // Check if session page shows "ended" state or loading state
        const loadingEl = await page.$('div:has-text("Carregando feedback"), div:has-text("Salvando transcricao")');
        if (loadingEl) {
          sessionEnded = true;
          addObservation(elapsed, 'Session ended - feedback loading detected');
          break;
        }

        // Check for agent greeting in transcript
        if (!greetingDetected) {
          const messages = await page.$$('[class*="message"], [class*="transcript"] p, [class*="chat"] div');
          for (const msg of messages) {
            const text = await msg.textContent();
            if (text && text.trim().length > 10) {
              greetingDetected = true;
              addObservation(elapsed, `Agent greeting detected: "${text.substring(0, 80)}..."`);
              break;
            }
          }

          // Also check Chat tab if not found
          if (!greetingDetected) {
            const chatTab = await page.$('button:has-text("Chat")');
            if (chatTab) {
              await chatTab.click();
              await page.waitForTimeout(500);
              const msgs = await page.$$('[class*="message"], [class*="transcript"] p');
              for (const msg of msgs) {
                const text = await msg.textContent();
                if (text && text.trim().length > 10) {
                  greetingDetected = true;
                  addObservation(elapsed, `Agent greeting (Chat tab): "${text.substring(0, 80)}..."`);
                  break;
                }
              }
            }
          }
        }

        // Check for EmotionMeter
        if (!emotionDetected) {
          const emotionEl = await page.$('[class*="emotion"], [class*="Emotion"]');
          if (emotionEl) {
            const text = await emotionEl.textContent();
            emotionDetected = true;
            addObservation(elapsed, `EmotionMeter detected: ${text?.substring(0, 50)}`);
          }
        }

        // Check for timer
        if (!timerDetected) {
          const timerEl = await page.$('[class*="timer"], [class*="Timer"]');
          if (timerEl) {
            const text = await timerEl.textContent();
            timerDetected = true;
            addObservation(elapsed, `Timer detected: ${text}`);
          }
        }

        // Check for coaching hints
        if (!coachDetected) {
          const coachTab = await page.$('button:has-text("Coach")');
          if (coachTab) {
            await coachTab.click();
            await page.waitForTimeout(500);
          }
          const hints = await page.$$('[class*="hint"], [class*="suggestion"], [class*="coach"]');
          for (const hint of hints) {
            const text = await hint.textContent();
            if (text && text.trim().length > 5) {
              coachDetected = true;
              addObservation(elapsed, `Coach hint detected: "${text.substring(0, 80)}..."`);
              break;
            }
          }
        }

        // Check for 30s warning (appears near end of session ~2:30)
        if (!warningDetected && elapsed > 120) {
          const warningEl = await page.$(':has-text("30 segundos"), :has-text("encerrar em breve")');
          if (warningEl) {
            warningDetected = true;
            addObservation(elapsed, '30s timeout warning detected');
          }
        }

        // Periodic screenshot
        if (observationCount % 4 === 0) {  // Every ~60s
          await takeScreenshot(page, `session-${elapsed}s`);
        }

        log(`   ⏱️  Session: ${elapsed}s elapsed | greeting:${greetingDetected ? '✓' : '...'} emotion:${emotionDetected ? '✓' : '...'} timer:${timerDetected ? '✓' : '...'} coach:${coachDetected ? '✓' : '...'}`);

        await page.waitForTimeout(CONFIG.TIMEOUTS.observation_interval);
      }

      // If session didn't end naturally, check if Encerrar button exists
      if (!sessionEnded) {
        const encerrarBtn = await page.$('button:has-text("Encerrar")');
        if (encerrarBtn) {
          addObservation(Math.round((Date.now() - sessionStartTime) / 1000), 'Session still active after timeout - clicking Encerrar');
          await encerrarBtn.click();
          await page.waitForTimeout(3000);
          sessionEnded = true;
        }
      }

      const totalTime = Math.round((Date.now() - sessionStartTime) / 1000);
      const features = [
        greetingDetected ? 'greeting' : null,
        emotionDetected ? 'emotion' : null,
        timerDetected ? 'timer' : null,
        coachDetected ? 'coach' : null,
        warningDetected ? '30s-warning' : null
      ].filter(Boolean);

      return `Session lasted ${totalTime}s. Features detected: [${features.join(', ')}]`;
    }, CONFIG.TIMEOUTS.session_full + 10000);

    await takeScreenshot(page, 'session-ended');

    // ═══════════════════════════════════════════════
    // STEP 8: Feedback page
    // ═══════════════════════════════════════════════
    log('\n📍 STEP 8: Feedback verification\n');

    // Wait for redirect to feedback if not already there
    const feedbackResult = await runStep('feedback_page', async () => {
      // Wait for feedback URL
      await page.waitForURL('**/feedback/**', { timeout: 30000 });
      return `On feedback page: ${page.url()}`;
    }, 30000);

    if (feedbackResult.success) {
      await takeScreenshot(page, 'feedback-loading');

      // Check for progressive loading steps
      const loadingResult = await runStep('feedback_progressive_loading', async () => {
        const loadingMessages = [];
        for (let i = 0; i < 10; i++) {
          const loadingText = await page.$('h2');
          if (loadingText) {
            const text = await loadingText.textContent();
            if (text && !loadingMessages.includes(text) && !text.includes('Resultado')) {
              loadingMessages.push(text);
            }
            // If we see "Resultado" header, feedback loaded
            if (text && text.includes('Resultado')) {
              return `Feedback loaded! Progressive steps seen: [${loadingMessages.join(' → ')}]`;
            }
          }
          await page.waitForTimeout(5000);
        }
        // Check if feedback loaded even if we missed the transition
        const resultHeader = await page.$('h1:has-text("Resultado"), h2:has-text("Resultado")');
        if (resultHeader) {
          return `Feedback loaded. Steps: [${loadingMessages.join(' → ')}]`;
        }
        throw new Error(`Feedback still loading after 50s. Steps seen: [${loadingMessages.join(' → ')}]`);
      }, CONFIG.TIMEOUTS.feedback_load);

      await takeScreenshot(page, 'feedback-loaded');

      // Verify feedback content
      const contentResult = await runStep('feedback_content', async () => {
        const checks = [];

        // Check for score
        const scoreEl = await page.$('[class*="score"], [class*="Score"], :has-text("Score"), :has-text("Pontuação")');
        if (scoreEl) {
          const text = await scoreEl.textContent();
          checks.push(`score: ${text?.substring(0, 30)}`);
        }

        // Check for criteria/rubric
        const criteriaEls = await page.$$('[class*="criteria"], [class*="rubric"], [class*="Criteria"]');
        if (criteriaEls.length > 0) {
          checks.push(`criteria: ${criteriaEls.length} elements`);
        }

        // Check for summary text
        const summaryEl = await page.$('[class*="summary"], p');
        if (summaryEl) {
          const text = await summaryEl.textContent();
          if (text && text.length > 30) {
            checks.push(`summary: "${text.substring(0, 60)}..."`);
          }
        }

        // Check for action buttons
        const novoTreino = await page.$('button:has-text("Novo Treino")');
        const verHistorico = await page.$('button:has-text("Ver Historico"), button:has-text("Ver Histórico")');
        if (novoTreino) checks.push('btn:Novo Treino');
        if (verHistorico) checks.push('btn:Ver Historico');

        if (checks.length === 0) {
          throw new Error('No feedback content found');
        }

        return `Feedback content: [${checks.join(', ')}]`;
      }, 15000);

      await takeScreenshot(page, 'feedback-final');
    }

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
                      results.steps.filter(s => s.status === 'pass').length >= 6;

    if (CONFIG.JSON_OUTPUT) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      log('\n' + '='.repeat(60));
      log('📊 VERIFICATION REPORT');
      log('='.repeat(60));

      const passed = results.steps.filter(s => s.status === 'pass').length;
      const failed = results.steps.filter(s => s.status === 'fail').length;

      log(`\n${results.success ? '✅ VERIFICATION PASSED' : '❌ VERIFICATION FAILED'}`);
      log(`Duration: ${Math.round(results.duration_ms / 1000)}s`);
      log(`Steps: ${passed} passed, ${failed} failed (${results.steps.length} total)`);

      if (results.observations.length > 0) {
        log(`\nSession observations:`);
        results.observations.forEach(o => log(`  [${o.time_s}s] ${o.observation}`));
      }

      if (results.errors.length > 0) {
        log(`\nErrors:`);
        results.errors.forEach(e => log(`  - ${e.step}: ${e.error}`));
      }

      if (results.console_logs.length > 0) {
        log(`\nRelevant console logs (${results.console_logs.length}):`);
        results.console_logs.slice(0, 10).forEach(l =>
          log(`  [${l.type}] ${l.text.substring(0, 100)}`)
        );
      }

      log(`\nScreenshots (${results.screenshots.length}): ${CONFIG.SCREENSHOT_DIR}`);
      log('='.repeat(60));
    }
  }

  return results;
}

// Ensure screenshot directory exists
if (!fs.existsSync(CONFIG.SCREENSHOT_DIR)) {
  fs.mkdirSync(CONFIG.SCREENSHOT_DIR, { recursive: true });
}

runVerification().catch(console.error);
