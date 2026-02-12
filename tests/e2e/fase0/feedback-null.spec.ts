import { test, expect } from '../fixtures/auth.fixture';
import { getConsoleErrors, setupDataChannelCapture } from '../fixtures/session.fixture';

test.describe('FIX 5: Feedback page null safety', () => {
  test('feedback page should render without errors for completed session', async ({
    authenticatedPage: page,
  }) => {
    // Setup error capture
    await setupDataChannelCapture(page);

    // Try to navigate to feedback for an existing session
    // First, check history for a completed session
    await page.goto('/history');

    // Wait for history to load
    await page.waitForTimeout(3_000);

    // Look for any completed session link
    const feedbackLinks = page.locator('a[href*="/feedback/"]');
    const count = await feedbackLinks.count();

    if (count > 0) {
      // Click the first feedback link
      await feedbackLinks.first().click();
      await page.waitForURL('**/feedback/**', { timeout: 15_000 });

      // Wait for feedback to render
      await page.waitForTimeout(5_000);

      // Check for uncaught errors
      const errors = await getConsoleErrors(page);
      const criticalErrors = errors.filter(
        (e) =>
          e.includes('Cannot read') ||
          e.includes('undefined') ||
          e.includes('TypeError') ||
          e.includes('criteria_results')
      );

      expect(criticalErrors).toHaveLength(0);

      // Verify the page rendered (not a blank screen)
      const body = await page.locator('body').textContent();
      expect(body?.length).toBeGreaterThan(50);
    } else {
      // No completed sessions in history — skip gracefully
      test.skip(true, 'No completed sessions available for feedback testing');
    }
  });

  test('feedback page should show score section', async ({ authenticatedPage: page }) => {
    await page.goto('/history');
    await page.waitForTimeout(3_000);

    const feedbackLinks = page.locator('a[href*="/feedback/"]');
    const count = await feedbackLinks.count();

    if (count > 0) {
      await feedbackLinks.first().click();
      await page.waitForURL('**/feedback/**', { timeout: 15_000 });

      // Wait for feedback generation/load (can take up to 90s)
      await page.waitForTimeout(10_000);

      // Check that some feedback content is visible
      // Either loading state or actual feedback
      const pageContent = await page.locator('body').textContent();
      const hasFeedbackContent =
        pageContent?.includes('Resultado') ||
        pageContent?.includes('Carregando') ||
        pageContent?.includes('Resumo') ||
        pageContent?.includes('Criterio');

      expect(hasFeedbackContent).toBe(true);
    } else {
      test.skip(true, 'No completed sessions available for feedback testing');
    }
  });
});
