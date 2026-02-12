import { test as base, expect, Page } from '@playwright/test';

const ACCESS_CODE = process.env.ACCESS_CODE || 'ADMIN001';

export async function login(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for the login form to be ready (not loading)
  await page.waitForSelector('#access-code', { timeout: 15_000 });
  await page.locator('#access-code').fill(ACCESS_CODE);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/home', { timeout: 15_000 });
}

/**
 * Extended test fixture that provides an authenticated page.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Set E2E mode BEFORE app loads (disables StrictMode + skips mic enablement)
    await page.addInitScript(() => {
      localStorage.setItem('e2e_mode', 'true');
    });
    await login(page);
    await use(page);
  },
});

export { expect };
