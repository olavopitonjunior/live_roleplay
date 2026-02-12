import { test, expect } from './fixtures/auth.fixture';
import { startSession, getDataMessages, setupDataChannelCapture } from './fixtures/session.fixture';

test('diagnostic: verify session stability and data capture', async ({
  authenticatedPage: page,
}) => {
  test.setTimeout(120_000);

  const logs: string[] = [];
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await setupDataChannelCapture(page);

  // Start session
  await startSession(page, { mode: 'training' });

  // Wait 30 seconds for agent to greet and send data
  await page.waitForTimeout(30_000);

  // Check data messages
  const dataMessages = await getDataMessages(page);
  console.log('\n===== DATA MESSAGES =====');
  console.log(`Total messages: ${dataMessages.length}`);
  for (const msg of dataMessages.slice(0, 20)) {
    console.log(JSON.stringify(msg));
  }
  console.log('===== END DATA MESSAGES =====');

  console.log(`\nCurrent URL: ${page.url()}`);
  const url = page.url();
  if (url.includes('/session/')) {
    console.log('RESULT: Session stable (good!)');
  } else {
    console.log('RESULT: Not on session page');
  }

  // Assert session remained stable
  expect(url).toContain('/session/');
  expect(dataMessages.length).toBeGreaterThan(0);
});
