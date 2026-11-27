import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test.describe('Phase 3 — Landing Page, Interactivity, Theme & Accessibility', () => {
  test('verifies hero preview interactivity, redaction showcase, privacy self-check, FAQ, and CTAs', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Hero content
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Your Data. Your Privacy. Our Priority.'
    );
    await expect(
      page.getByText(
        'Detect, classify and sanitize sensitive information instantly. Privacy-first processing that keeps your data inside your browser.'
      )
    ).toBeVisible();

    // Interactive Hero Preview mode switching
    const heroSanitized = page.getByTestId('hero-preview-sanitized');
    await expect(heroSanitized).toContainText('USER_01');
    await page.getByRole('tab', { name: 'Full Mask', exact: true }).first().click();
    await expect(heroSanitized).toContainText('[REDACTED_EMAIL]');
    await page.getByRole('tab', { name: 'Partial', exact: true }).click();
    await expect(heroSanitized).toContainText('pr****@example.com');
    await page.getByRole('button', { name: 'Server Log' }).click();
    await expect(heroSanitized).toContainText('2001:0db8:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx');

    // Redaction Modes Showcase section
    const modesSection = page.locator('#modes');
    await modesSection.scrollIntoViewIfNeeded();
    await modesSection.getByRole('tab', { name: /Partial Mask/i }).click();
    await expect(modesSection.getByText('192.168.xxx.xxx')).toBeVisible();
    await modesSection.getByRole('tab', { name: /Pseudonymize/i }).click();
    await expect(
      modesSection.getByText('Contact anuj@example.com → Contact USER_01')
    ).toBeVisible();

    // Live Privacy Verification button
    const archSection = page.locator('#architecture');
    await archSection.scrollIntoViewIfNeeded();
    await archSection.getByRole('button', { name: /Re-run Privacy Check/i }).click();
    await expect(archSection.getByText('VERIFIED', { exact: true })).toBeVisible();

    // FAQ accordion interaction
    const faqSection = page.locator('#faq');
    await faqSection.scrollIntoViewIfNeeded();
    const faqTrigger = faqSection.getByRole('button', {
      name: /Will sanitizing a CSV file break columns/i,
    });
    await faqTrigger.click();
    await expect(faqTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(faqSection.getByText(/PapaParse/i)).toBeVisible();

    // Desktop dark screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: 'test-results/phase3-desktop-dark.png',
      fullPage: true,
    });

    // Switch to light theme & capture settled screenshot
    await page.getByRole('button', { name: /Switch to light theme/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.screenshot({
      path: 'test-results/phase3-desktop-light.png',
      fullPage: false,
      animations: 'disabled',
    });

    // Primary CTA navigates to /workspace
    await page.getByRole('link', { name: /Start Sanitizing/i }).click();
    await expect(page).toHaveURL('/workspace');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('opens mobile navigation drawer and navigates to Workspace', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: /Open navigation menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.locator('#mobile-navigation-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: /Launch Workspace/i }).click();
    await expect(page).toHaveURL('/workspace');
  });

  for (const vp of VIEWPORTS) {
    test(`has zero horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflow).toBe(false);

      if (vp.name !== 'desktop') {
        await page.screenshot({
          path: `test-results/phase3-${vp.name}.png`,
          fullPage: false,
          animations: 'disabled',
        });
      }
    });
  }
});
