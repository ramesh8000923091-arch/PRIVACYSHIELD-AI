import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test.describe('Phase 2 — Browser, Route, Theme, Responsive & Privacy Verification', () => {
  test('verifies all routes, zero console errors, zero external network calls, and privacy module', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('request', (req) => {
      const url = req.url();
      if (
        !url.startsWith('http://localhost:5173') &&
        !url.startsWith('http://127.0.0.1:5173') &&
        !url.startsWith('https://fonts.googleapis.com') &&
        !url.startsWith('https://fonts.gstatic.com') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')
      ) {
        externalRequests.push(url);
      }
    });

    // 1. Home route
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Data. Your Privacy.');
    await expect(page.getByText('100% Client-Side Processing').first()).toBeVisible();
    await expect(page.getByText(/Local-Only Mode/i).first()).toBeVisible();

    // 2. Workspace route
    await page.goto('/workspace');
    await expect(page.getByText('Sanitization Workspace').first()).toBeVisible();

    // 3. History route
    await page.goto('/history');
    await expect(page.getByText('Local Activity & Audit Log').first()).toBeVisible();

    // 4. About / Privacy Verification Module route
    await page.goto('/about');
    await expect(page.getByText('Privacy Architecture & Verification')).toBeVisible();
    await expect(page.getByText('All Checks Passed')).toBeVisible();
    for (const surface of [
      'NETWORK',
      'LOCAL_STORAGE',
      'SESSION_STORAGE',
      'CONSOLE',
      'ANALYTICS',
      'SUPABASE',
    ]) {
      await expect(page.getByText(surface, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/Local-Only Mode active/i)).toBeVisible();

    // 5. Not Found route
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
    await page.getByRole('link', { name: 'Return Home' }).click();
    await expect(page).toHaveURL('/');

    // 6. Verify storage hygiene (zero raw document content stored)
    const storageAudit = await page.evaluate(() => {
      const lsKeys = Object.keys(window.localStorage);
      const lsValues = lsKeys.map((k) => window.localStorage.getItem(k) ?? '').join(' ');
      const ssKeys = Object.keys(window.sessionStorage);
      return {
        hasWorkspaceKey: lsKeys.some((k) => k.includes('workspace')),
        hasRawTextField: lsValues.includes('rawText'),
        sessionStorageCount: ssKeys.length,
      };
    });
    expect(storageAudit.hasWorkspaceKey).toBe(false);
    expect(storageAudit.hasRawTextField).toBe(false);
    expect(storageAudit.sessionStorageCount).toBe(0);

    // 7. Verify zero console/page errors and zero external API/Supabase traffic
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('switches cleanly between dark and light themes', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    const toggleButton = page.getByRole('button', { name: /Switch to light theme/i });
    await toggleButton.click();
    await expect(html).not.toHaveClass(/dark/);

    const switchBackButton = page.getByRole('button', { name: /Switch to dark theme/i });
    await switchBackButton.click();
    await expect(html).toHaveClass(/dark/);
  });

  for (const vp of VIEWPORTS) {
    test(`renders cleanly without horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflow).toBe(false);

      await page.screenshot({
        path: `test-results/phase2-${vp.name}.png`,
        fullPage: true,
      });
    });
  }
});
