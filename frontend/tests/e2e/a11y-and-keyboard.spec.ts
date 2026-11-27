import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/workspace', '/history', '/about'] as const;

test.describe('WCAG 2.2 AA Accessibility, Keyboard Navigation & Responsive Audit', () => {
  for (const route of ROUTES) {
    test(`verifies semantic landmarks, heading hierarchy, form labels, and image alt on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);

      if (route === '/workspace') {
        await page.getByRole('button', { name: /Load Sample Data/i }).click();
        await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');
      }

      const a11yReport = await page.evaluate(() => {
        const h1Count = document.querySelectorAll('h1').length;
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) =>
          Number(h.tagName.slice(1))
        );
        const skippedHeadingLevels: string[] = [];
        for (let i = 1; i < headings.length; i += 1) {
          if (headings[i] - headings[i - 1] > 1) {
            skippedHeadingLevels.push(`h${headings[i - 1]} -> h${headings[i]}`);
          }
        }

        const missingAltImages = Array.from(document.querySelectorAll('img')).filter(
          (img) => !img.hasAttribute('alt')
        ).length;

        const unnamedButtons = Array.from(document.querySelectorAll('button'))
          .filter((btn) => {
            const style = window.getComputedStyle(btn);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const id = btn.getAttribute('id');
            const hasForLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
            const wrappedByLabel = Boolean(btn.closest('label'));
            const label =
              btn.getAttribute('aria-label') ||
              btn.getAttribute('aria-labelledby') ||
              btn.textContent?.trim();
            return !label && !hasForLabel && !wrappedByLabel;
          })
          .map((b) => b.outerHTML.slice(0, 80));

        const unlabeledControls = Array.from(
          document.querySelectorAll('input:not([type="hidden"]), textarea, select')
        )
          .filter((el) => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const id = el.getAttribute('id');
            const hasForLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
            const hasAria = Boolean(
              el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
            );
            const wrappedByLabel = Boolean(el.closest('label'));
            return !hasForLabel && !hasAria && !wrappedByLabel;
          })
          .map((el) => el.outerHTML.slice(0, 80));

        const hasMain = Boolean(document.querySelector('main#main-content'));
        const hasNav = Boolean(document.querySelector('nav'));
        const hasBanner = Boolean(document.querySelector('header'));
        const hasFooter = Boolean(document.querySelector('footer'));

        return {
          h1Count,
          skippedHeadingLevels,
          missingAltImages,
          unnamedButtons,
          unlabeledControls,
          hasMain,
          hasNav,
          hasBanner,
          hasFooter,
        };
      });

      expect(a11yReport.h1Count).toBe(1);
      expect(a11yReport.skippedHeadingLevels).toEqual([]);
      expect(a11yReport.missingAltImages).toBe(0);
      expect(a11yReport.unnamedButtons).toEqual([]);
      expect(a11yReport.unlabeledControls).toEqual([]);
      expect(a11yReport.hasMain).toBe(true);
      expect(a11yReport.hasNav).toBe(true);
      expect(a11yReport.hasBanner).toBe(true);
      expect(a11yReport.hasFooter).toBe(true);
    });
  }

  test('supports keyboard-only navigation, skip link, keyboard shortcuts, and Escape focus restoration', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    // 1. Tab to Skip to main content link and activate it
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    // 2. Keyboard shortcut Ctrl+Shift+L loads synthetic sample data
    await page.keyboard.press('Control+Shift+L');
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

    // 3. Keyboard arrow navigation on Radix Redaction Mode tabs
    const fullMaskTab = page.getByRole('tab', { name: /Full Mask/i });
    await fullMaskTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Partial Mask/i })).toBeFocused();
    await expect(page.getByTestId('diff-sanitized-pane')).toContainText('pr****@example.com');

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Pseudonymize/i })).toBeFocused();
    await expect(page.getByTestId('diff-sanitized-pane')).toContainText('USER_01');

    // 4. Open Restore AI Reply via keyboard Enter -> Escape closes and restores focus
    const restoreBtn = page.getByRole('button', { name: /Restore AI Reply/i });
    await restoreBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('restore-ai-reply-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('restore-ai-reply-panel')).not.toBeVisible();
    await expect(restoreBtn).toBeFocused();

    // 5. Inspect highlighted entity via keyboard -> Escape closes and restores focus
    const entityBtn = page
      .getByLabel('Live highlighted sensitive text')
      .getByRole('button', { name: 'priya.sharma@example.com' })
      .first();
    await entityBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: /Selected entity inspector/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('region', { name: /Selected entity inspector/i })
    ).not.toBeVisible();
    await expect(entityBtn).toBeFocused();
  });

  test('closes mobile navigation drawer on Escape and restores focus to menu toggle button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: /Open navigation menu/i });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#mobile-navigation-drawer')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-navigation-drawer')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Open navigation menu/i })).toBeFocused();
  });
});
