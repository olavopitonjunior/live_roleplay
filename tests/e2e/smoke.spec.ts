import { test, expect } from './fixtures/auth.fixture';

test.describe('Smoke tests — no agent required', () => {
  test('login with valid access code', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#access-code', { timeout: 15_000 });
    await page.locator('#access-code').fill(process.env.ACCESS_CODE || 'ADMIN001');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/home', { timeout: 15_000 });
    expect(page.url()).toContain('/home');
  });

  test('home page shows scenarios', async ({ authenticatedPage: page }) => {
    // Should see the hero title
    await expect(page.locator('text=Escolha')).toBeVisible({ timeout: 10_000 });

    // Should see at least one scenario card
    const cards = page.locator('button.group.w-full');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('scenario card opens mode selection modal', async ({ authenticatedPage: page }) => {
    // Wait for scenarios (w-full distinguishes ScenarioCard from category headers)
    await page.waitForSelector('button.group.w-full', { timeout: 15_000 });

    // Click first scenario
    await page.locator('button.group.w-full').first().click();

    // Modal should appear
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should have mode options
    await expect(modal.locator('text=Modo Treino')).toBeVisible();
    await expect(modal.locator('text=Iniciar Sessao')).toBeVisible();
  });

  test('mode modal shows training and evaluation options', async ({
    authenticatedPage: page,
  }) => {
    await page.waitForSelector('button.group.w-full', { timeout: 15_000 });
    await page.locator('button.group.w-full').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Training mode
    await expect(modal.locator('text=Modo Treino')).toBeVisible();
    // Evaluation mode
    await expect(modal.locator('text=Modo Avaliacao')).toBeVisible();
    // Difficulty level section
    await expect(modal.locator('text=Nivel de Dificuldade')).toBeVisible();
    // Cancel and start buttons
    await expect(modal.locator('text=Cancelar')).toBeVisible();
    await expect(modal.locator('text=Iniciar Sessao')).toBeVisible();
  });

  test('cancel button closes modal', async ({ authenticatedPage: page }) => {
    await page.waitForSelector('button.group.w-full', { timeout: 15_000 });
    await page.locator('button.group.w-full').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Click cancel
    await modal.locator('button:has-text("Cancelar")').click();

    // Modal should disappear
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });

  test('session page loads after clicking start', async ({ authenticatedPage: page }) => {
    await page.waitForSelector('button.group.w-full', { timeout: 15_000 });
    await page.locator('button.group.w-full').first().click();

    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Start session
    await modal.locator('button:has-text("Iniciar Sessao")').click();

    // Should navigate to session page
    await page.waitForURL(/\/session\//, { timeout: 30_000 });
    expect(page.url()).toContain('/session/');
  });

  test('navigation buttons on home work', async ({ authenticatedPage: page }) => {
    // Check logout button exists
    const logoutBtn = page.locator('button:has-text("Sair")');
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
  });
});
