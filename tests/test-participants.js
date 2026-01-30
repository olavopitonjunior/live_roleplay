/**
 * Test: Check participants in LiveKit room
 *
 * Verifies that the agent participant is being detected correctly
 */

const { chromium } = require('playwright');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const ACCESS_CODE = process.env.ACCESS_CODE || 'ADMIN001';

async function runTest() {
  console.log('Starting Participant Detection Test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200
  });

  const context = await browser.newContext({
    permissions: ['microphone']
  });

  const page = await context.newPage();

  // Expose function to collect participant info from browser
  const participants = [];
  await page.exposeFunction('logParticipant', (info) => {
    participants.push(info);
    console.log(`[Participant] ${JSON.stringify(info)}`);
  });

  // Inject script to monitor participants
  page.on('console', msg => {
    const text = msg.text();
    // Log all relevant messages
    if (text.includes('Participant') || text.includes('participant') ||
        text.includes('Agent') || text.includes('agent') ||
        text.includes('identity') || text.includes('Identity') ||
        text.includes('connecting') || text.includes('connected')) {
      console.log(`[Browser] ${text}`);
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

    // Step 3: Wait for session and inject monitoring code
    console.log('3. Waiting for session to start and monitoring participants...');
    await page.waitForURL('**/session/**', { timeout: 15000 });
    console.log(`   URL: ${page.url()}\n`);

    // Wait and monitor for 45 seconds
    console.log('4. Monitoring participants for 45 seconds...\n');

    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(5000);

      // Try to get participant info from page
      const pageInfo = await page.evaluate(() => {
        // Check for LiveKit room in window object
        const info = {
          time: new Date().toISOString(),
          url: window.location.href,
          hasLiveKit: typeof window.LiveKit !== 'undefined',
        };

        // Try to find any room or connection info
        try {
          // Check React dev tools for state
          const rootEl = document.getElementById('root');
          if (rootEl && rootEl._reactRootContainer) {
            info.hasReact = true;
          }
        } catch (e) {}

        // Check page content for clues
        const bodyText = document.body.innerText;
        info.hasAgentMention = bodyText.includes('agent') || bodyText.includes('Agent');
        info.hasErrorMention = bodyText.includes('Erro') || bodyText.includes('encerrada');
        info.hasLoading = bodyText.includes('Aguardando') || bodyText.includes('Conectando');

        return info;
      });

      console.log(`[${i*5}s] Page state:`, JSON.stringify(pageInfo));

      // Take screenshot
      if (i === 4) { // At 20 seconds
        await page.screenshot({ path: 'tests/participants-20s.png' });
        console.log('   Screenshot at 20s: tests/participants-20s.png');
      }
    }

    // Final screenshot
    await page.screenshot({ path: 'tests/participants-final.png' });
    console.log('\n   Final screenshot: tests/participants-final.png');

    console.log('\nTest completed!');
    console.log(`Total participants detected: ${participants.length}`);

  } catch (error) {
    console.error(`\nTest failed: ${error.message}`);
    await page.screenshot({ path: 'tests/participants-error.png' });
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

runTest().catch(console.error);
