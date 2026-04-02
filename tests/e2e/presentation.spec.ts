import { test, expect } from './fixtures/auth.fixture';

test.describe('Presentation Upload — no agent required', () => {
  test('mode selection modal has presentation section', async ({ authenticatedPage: page }) => {
    // Wait for scenario cards
    await page.waitForSelector('button:has-text("Comecar treino")', { timeout: 15_000 });

    // Open modal for first scenario
    await page.locator('button:has-text("Comecar treino")').first().click();
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Verify presentation section exists (collapsible toggle)
    const presSection = modal.locator('button:has-text("Apresentacao")');
    await expect(presSection).toBeVisible({ timeout: 5_000 });
  });

  test('presentation section expands to show PDF upload zone', async ({ authenticatedPage: page }) => {
    await page.waitForSelector('button:has-text("Comecar treino")', { timeout: 15_000 });
    await page.locator('button:has-text("Comecar treino")').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Click to expand presentation section
    const presToggle = modal.locator('button:has-text("Apresentacao")');
    await presToggle.click();

    // Should show the PDF drop zone
    const dropZone = modal.locator('text=Arraste um PDF');
    await expect(dropZone).toBeVisible({ timeout: 3_000 });
  });

  test('presentation section collapses when toggled again', async ({ authenticatedPage: page }) => {
    await page.waitForSelector('button:has-text("Comecar treino")', { timeout: 15_000 });
    await page.locator('button:has-text("Comecar treino")').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Expand
    const presToggle = modal.locator('button:has-text("Apresentacao")');
    await presToggle.click();
    const dropZone = modal.locator('text=Arraste um PDF');
    await expect(dropZone).toBeVisible({ timeout: 3_000 });

    // Collapse
    await presToggle.click();
    await expect(dropZone).not.toBeVisible({ timeout: 3_000 });
  });

  test('session starts normally without presentation (regression)', async ({ authenticatedPage: page }) => {
    // This test verifies the added presentation section doesn't break the default flow
    await page.waitForSelector('button:has-text("Comecar treino")', { timeout: 15_000 });
    await page.locator('button:has-text("Comecar treino")').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Do NOT upload any PDF — just start session normally
    await modal.locator('button:has-text("Iniciar Sessao")').dispatchEvent('click');

    // Should navigate to session page (session won't fully connect without agent, but URL is correct)
    await page.waitForURL(/\/session\//, { timeout: 30_000 });
    expect(page.url()).toContain('/session/');
  });
});
