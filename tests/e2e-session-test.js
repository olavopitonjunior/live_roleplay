/**
 * E2E Test: Session Creation and Agent Dispatch
 *
 * Tests the full flow:
 * 1. Login with access code
 * 2. Select scenario
 * 3. Start session
 * 4. Verify agent connects
 */

const { chromium } = require('playwright');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const ACCESS_CODE = process.env.ACCESS_CODE || 'ADMIN001'; // Valid access code from database

async function runTest() {
  console.log('🚀 Starting E2E test...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    slowMo: 500 // Slow down for visibility
  });

  const context = await browser.newContext({
    permissions: ['microphone'], // Allow microphone for WebRTC
    storageState: undefined // Ensure clean state
  });

  const page = await context.newPage();

  // Clear any existing storage
  await page.goto(APP_URL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
    } else if (msg.text().includes('Agent') || msg.text().includes('LiveKit')) {
      console.log(`📡 ${msg.text()}`);
    }
  });

  try {
    // Step 1: Navigate to app
    console.log('1️⃣ Navigating to app...');
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
    console.log('   ✅ App loaded\n');

    // Step 2: Enter access code
    console.log('2️⃣ Entering access code...');
    const codeInput = await page.waitForSelector('input[placeholder*="codigo" i], input[placeholder*="code" i], input[type="text"]', { timeout: 10000 });
    await codeInput.fill(ACCESS_CODE);

    // Find and click login/enter button
    const loginBtn = await page.waitForSelector('button[type="submit"], button:has-text("Entrar"), button:has-text("Enter")', { timeout: 5000 });
    await loginBtn.click();
    console.log('   ✅ Access code submitted\n');

    // Wait for scenarios to load and take screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/after-login.png' });
    console.log('   📸 Screenshot saved: tests/after-login.png\n');

    // Log the current URL and page content
    console.log(`   Current URL: ${page.url()}`);
    const pageContent = await page.content();
    console.log(`   Page has ${pageContent.length} chars\n`);

    // Step 3: Select scenario - click on "Comecar treino" link
    console.log('3️⃣ Selecting scenario...');

    // Find all "Comecar treino" links and click the first one (Venda de Seguro de Vida)
    const allLinks = await page.$$('a');
    console.log(`   Found ${allLinks.length} links on page`);

    for (let i = 0; i < Math.min(allLinks.length, 10); i++) {
      const text = await allLinks[i].textContent();
      console.log(`   Link ${i}: "${text?.trim()}"`);
    }

    // Try different selectors for starting training
    let scenarioCard = null;
    const selectors = [
      'a:has-text("Comecar treino")',
      'a:has-text("Começar treino")',
      'button:has-text("Comecar treino")',
      '[href*="session"]',
      'div:has-text("Seguro de Vida") a',
      'div:has-text("Proposta") a'
    ];

    for (const selector of selectors) {
      try {
        scenarioCard = await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`   Found element with: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (!scenarioCard) {
      // Take screenshot of current state
      await page.screenshot({ path: 'tests/scenario-not-found.png' });
      throw new Error('Could not find scenario card');
    }

    await scenarioCard.click();
    console.log('   ✅ Scenario selected\n');

    // Wait and take screenshot after scenario selection
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/after-scenario-select.png' });
    console.log('   📸 Screenshot: tests/after-scenario-select.png\n');
    console.log(`   Current URL: ${page.url()}\n`);

    // Check if we're on a session page already or need to click start
    const currentUrl = page.url();

    // Step 4: Start session (if not already started)
    console.log('4️⃣ Starting session...');

    // List all buttons to see what's available
    const allButtonsAfter = await page.$$('button');
    console.log(`   Found ${allButtonsAfter.length} buttons after scenario selection`);
    for (let i = 0; i < Math.min(allButtonsAfter.length, 10); i++) {
      const text = await allButtonsAfter[i].textContent();
      console.log(`   Button ${i}: "${text?.trim().substring(0, 50)}..."`);
    }

    // Try to find start button with various selectors
    let startBtn = null;
    const startSelectors = [
      'button:has-text("Iniciar")',
      'button:has-text("Start")',
      'button:has-text("Começar")',
      'button:has-text("Comecar")',
      'button:has-text("treino")',
      'a:has-text("treino")',
      '[href*="session"]'
    ];

    for (const selector of startSelectors) {
      try {
        startBtn = await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`   Found start with: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (startBtn) {
      await startBtn.click();
      console.log('   ✅ Session start requested\n');
    } else {
      // Maybe session already started (direct navigation)
      console.log('   ℹ️ No start button found, checking if session already started...\n');
    }

    // Step 5: Wait for session to connect
    console.log('5️⃣ Waiting for session connection...');

    // Wait for either the avatar video or an error message
    const result = await Promise.race([
      page.waitForSelector('video, [data-testid="avatar-video"]', { timeout: 30000 })
        .then(() => ({ success: true, message: 'Video element found' })),
      page.waitForSelector('[data-testid="error"], .error-message, :has-text("Erro")', { timeout: 30000 })
        .then(el => el.textContent())
        .then(text => ({ success: false, message: text })),
      new Promise(resolve => setTimeout(() => resolve({ success: false, message: 'Timeout waiting for connection' }), 30000))
    ]);

    if (result.success) {
      console.log('   ✅ Session connected successfully!\n');

      // Wait a bit to see if avatar loads
      await page.waitForTimeout(5000);

      // Check for status messages
      const statusEl = await page.$('[data-testid="status"], .status-message');
      if (statusEl) {
        const status = await statusEl.textContent();
        console.log(`   📊 Status: ${status}\n`);
      }

      // Take screenshot
      await page.screenshot({ path: 'tests/session-connected.png' });
      console.log('   📸 Screenshot saved to tests/session-connected.png\n');

    } else {
      console.log(`   ❌ Session failed: ${result.message}\n`);
      await page.screenshot({ path: 'tests/session-error.png' });
    }

    // Keep browser open for manual inspection
    console.log('🔍 Browser will remain open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    await page.screenshot({ path: 'tests/test-error.png' });
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
}

runTest().catch(console.error);
