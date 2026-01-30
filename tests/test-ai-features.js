/**
 * E2E Test: AI Coach and Emotion Analysis
 *
 * Tests the AI features:
 * 1. Login and start session
 * 2. Verify AI coach suggestions appear
 * 3. Verify emotion meter updates
 */

const { chromium } = require('playwright');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const ACCESS_CODE = process.env.ACCESS_CODE || 'ADMIN001';

async function runTest() {
  console.log('Starting AI Features Test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });

  const context = await browser.newContext({
    permissions: ['microphone']
  });

  const page = await context.newPage();

  // Track data messages from agent
  const dataMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('emotion') || text.includes('coach') || text.includes('suggestion')) {
      console.log(`[Console] ${text}`);
      dataMessages.push(text);
    }
    if (msg.type() === 'error') {
      console.log(`[Error] ${text}`);
    }
  });

  try {
    // Step 1: Login
    console.log('1. Logging in...');
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    const codeInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await codeInput.fill(ACCESS_CODE);

    const loginBtn = await page.waitForSelector('button[type="submit"], button:has-text("Entrar")', { timeout: 5000 });
    await loginBtn.click();
    await page.waitForTimeout(2000);
    console.log('   Logged in\n');

    // Step 2: Select scenario
    console.log('2. Selecting scenario...');
    const scenario = await page.waitForSelector('button:has-text("B2B"), button:has-text("Proposta")', { timeout: 5000 });
    await scenario.click();
    console.log('   Scenario selected\n');

    // Step 3: Wait for session to start
    console.log('3. Waiting for session to connect...');

    // Wait for the session page to load (URL should contain /session/)
    await page.waitForURL('**/session/**', { timeout: 15000 });
    console.log(`   URL: ${page.url()}`);

    // Wait for loading to complete
    await page.waitForTimeout(5000);

    // Take screenshot to see current state
    await page.screenshot({ path: 'tests/ai-test-session.png' });
    console.log('   Screenshot: tests/ai-test-session.png\n');

    // Step 4: Check for session UI elements
    console.log('4. Checking session UI elements...');

    // Look for common session elements
    const elements = {
      transcription: await page.$('[class*="transcript"], [class*="Transcript"]'),
      emotion: await page.$('[class*="emotion"], [class*="Emotion"], [class*="meter"]'),
      coaching: await page.$('[class*="coach"], [class*="Coach"], [class*="hint"]'),
      status: await page.$('[class*="status"], [class*="Status"]')
    };

    for (const [name, el] of Object.entries(elements)) {
      if (el) {
        const text = await el.textContent().catch(() => '');
        console.log(`   Found ${name}: ${text.substring(0, 50)}...`);
      } else {
        console.log(`   ${name}: not found`);
      }
    }
    console.log('');

    // Step 5: Wait for agent response and AI analysis
    console.log('5. Waiting for AI analysis (60 seconds)...');
    console.log('   (Agent should greet and trigger emotion/coach analysis)');

    // Poll for updates
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000);

      // Check for emotion updates
      const emotionEl = await page.$('[class*="emotion"], [class*="Emotion"]');
      if (emotionEl) {
        const emotionText = await emotionEl.textContent().catch(() => '');
        console.log(`   [${i*5}s] Emotion: ${emotionText.substring(0, 30)}`);
      }

      // Check for coaching hints
      const coachEl = await page.$('[class*="coach"], [class*="Coach"], [class*="hint"]');
      if (coachEl) {
        const coachText = await coachEl.textContent().catch(() => '');
        if (coachText.length > 10) {
          console.log(`   [${i*5}s] Coach: ${coachText.substring(0, 50)}...`);
        }
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'tests/ai-test-final.png' });
    console.log('\n   Final screenshot: tests/ai-test-final.png');

    console.log('\nTest completed!');
    console.log(`Total data messages received: ${dataMessages.length}`);

  } catch (error) {
    console.error(`\nTest failed: ${error.message}`);
    await page.screenshot({ path: 'tests/ai-test-error.png' });
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

runTest().catch(console.error);
