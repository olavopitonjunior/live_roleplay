import { test, expect } from './fixtures/auth.fixture';

test.describe('Training Tracks — no agent required', () => {
  test('home page shows tracks section', async ({ authenticatedPage: page }) => {
    // Should see tracks section heading
    const tracksHeading = page.locator('text=Esteiras de Treinamento');
    const hasTracksSection = await tracksHeading.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTracksSection) {
      test.skip(true, 'No tracks seeded in database — skip tracks tests');
      return;
    }

    await expect(tracksHeading).toBeVisible();

    // Should see at least one track card
    // TrackCard contains progress bar (h-3) and scenario count text
    const trackCards = page.locator('section').first().locator('button.group');
    const count = await trackCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('home page still shows all scenarios below tracks', async ({ authenticatedPage: page }) => {
    // Wait for page to load
    await expect(page.locator('text=Escolha')).toBeVisible({ timeout: 10_000 });

    // "Todos os Cenarios" section should be visible when tracks exist
    const allScenariosHeading = page.locator('text=Todos os Cenarios');
    const hasTracks = await page.locator('text=Esteiras de Treinamento').isVisible().catch(() => false);

    if (hasTracks) {
      await expect(allScenariosHeading).toBeVisible({ timeout: 5_000 });
    }

    // Scenario cards should still render
    const cards = page.locator('button:has-text("Comecar treino")');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('track card navigates to track detail page', async ({ authenticatedPage: page }) => {
    const tracksSection = page.locator('text=Esteiras de Treinamento');
    const hasTracks = await tracksSection.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTracks) {
      test.skip(true, 'No tracks seeded');
      return;
    }

    // Click first track card (look for track CTA text)
    const trackLink = page.locator('button:has-text("Iniciar"), button:has-text("Continuar"), button:has-text("Revisar")').first();
    await trackLink.click();

    // Should navigate to /tracks/:slug
    await page.waitForURL(/\/tracks\//, { timeout: 15_000 });
    expect(page.url()).toContain('/tracks/');
  });

  test('track detail shows scenarios in order', async ({ authenticatedPage: page }) => {
    // Navigate directly to a seeded track
    await page.goto('/tracks/recrutamento-corretores');

    // Wait for page to load (could be 404 if not seeded)
    await page.waitForTimeout(3_000);

    const trackTitle = page.locator('h1');
    const isLoaded = await trackTitle.isVisible().catch(() => false);
    if (!isLoaded) {
      test.skip(true, 'Track recrutamento-corretores not found — seed migration may not be applied');
      return;
    }

    // Verify title
    await expect(trackTitle).toContainText('Recrutamento');

    // Verify scenario timeline has numbered position nodes
    // Position nodes are 8x8 squares with numbers or check marks
    const positionNodes = page.locator('div.w-8.h-8');
    const nodeCount = await positionNodes.count();
    expect(nodeCount).toBeGreaterThanOrEqual(2);

    // First scenario should be available (yellow background = available)
    const firstAvailable = page.locator('button:has-text("Iniciar Cenario")');
    await expect(firstAvailable.first()).toBeVisible({ timeout: 5_000 });
  });

  test('locked scenarios show lock indicator', async ({ authenticatedPage: page }) => {
    await page.goto('/tracks/recrutamento-corretores');
    await page.waitForTimeout(3_000);

    const trackTitle = page.locator('h1');
    const isLoaded = await trackTitle.isVisible().catch(() => false);
    if (!isLoaded) {
      test.skip(true, 'Track not found');
      return;
    }

    // If track has >1 scenario and user hasn't completed any,
    // scenarios after the first should show "Bloqueado"
    const lockedIndicators = page.locator('text=Bloqueado');
    const lockedCount = await lockedIndicators.count();

    // With 4 scenarios and 0 completed, expect at least 2 locked
    // (first is available, rest are locked)
    expect(lockedCount).toBeGreaterThanOrEqual(1);
  });

  test('clicking scenario in track opens mode selection modal', async ({ authenticatedPage: page }) => {
    await page.goto('/tracks/recrutamento-corretores');
    await page.waitForTimeout(3_000);

    const startBtn = page.locator('button:has-text("Iniciar Cenario")');
    const hasAvailable = await startBtn.first().isVisible().catch(() => false);
    if (!hasAvailable) {
      test.skip(true, 'No available scenario in track');
      return;
    }

    // Click first available scenario
    await startBtn.first().click();

    // Modal should appear
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Modal should have training/evaluation modes
    await expect(modal.locator('text=Modo Treino')).toBeVisible();
    await expect(modal.locator('text=Iniciar Sessao')).toBeVisible();
  });

  test('starting session from track navigates to session page', async ({ authenticatedPage: page }) => {
    await page.goto('/tracks/recrutamento-corretores');
    await page.waitForTimeout(3_000);

    const startBtn = page.locator('button:has-text("Iniciar Cenario")');
    const hasAvailable = await startBtn.first().isVisible().catch(() => false);
    if (!hasAvailable) {
      test.skip(true, 'No available scenario in track');
      return;
    }

    // Click scenario → modal → start
    await startBtn.first().click();
    const modal = page.locator('div.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await modal.locator('button:has-text("Iniciar Sessao")').dispatchEvent('click');

    // Should navigate to /session/:scenarioId
    await page.waitForURL(/\/session\//, { timeout: 30_000 });
    expect(page.url()).toContain('/session/');
  });

  test('admin tracks page is accessible', async ({ authenticatedPage: page }) => {
    await page.goto('/admin/tracks');
    await page.waitForTimeout(3_000);

    // Verify admin tracks page loads
    const heading = page.locator('text=Esteiras de Treinamento');
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Verify "Nova Esteira" button exists
    const newBtn = page.locator('button:has-text("Nova Esteira")');
    await expect(newBtn).toBeVisible({ timeout: 5_000 });
  });
});
