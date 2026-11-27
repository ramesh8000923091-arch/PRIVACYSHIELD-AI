import { expect, test } from '@playwright/test';

test.describe('Phase 11 — Complete Interactive Controls & Sidebar Audit', () => {
  test('verifies every interactive workspace button, sidebar tab, settings toggle, and history control', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    // Load Sample Data -> Detect Now -> Undo/Redo -> Generic Full Mask -> Reset Mappings
    await page.getByRole('button', { name: /Load Sample Data/i }).click();
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

    await page.getByRole('button', { name: /Detect Now/i }).click();
    await expect(page.getByText(/Re-scanned document locally/i)).toBeVisible();

    // Toggle Generic [REDACTED] under Full Mask
    await page.getByRole('switch', { name: /Use generic \[REDACTED\] placeholder/i }).click();
    await expect(page.getByTestId('diff-sanitized-pane')).toContainText('[REDACTED]');

    // Switch to Pseudonymize and test Reset Mappings
    await page.getByRole('tab', { name: /Pseudonymize/i }).click();
    await expect(page.getByText(/RAM Mappings:/i)).toBeVisible();
    await page.getByRole('button', { name: /Reset Mappings/i }).click();
    await expect(page.getByText(/RAM pseudonymization mappings cleared/i)).toBeVisible();

    // Test Copy Output button
    await page.getByRole('button', { name: /Copy Output/i }).click();
    await expect(page.getByRole('button', { name: /Copied/i })).toBeVisible();

    // Test Sample CSV button
    await page.getByRole('button', { name: /Sample CSV/i }).click();
    await expect(page.getByRole('button', { name: /Download \.CSV/i })).toBeVisible();

    // Sidebar: Dashboard
    await page.getByRole('button', { name: /^Dashboard$/i }).click();
    await expect(page.getByText(/Category Distribution/i)).toBeVisible();

    // Sidebar: Detection Results + category filter + exclude switch
    await page.getByRole('button', { name: /Detection Results/i }).click();
    await expect(page.getByText(/Detection Results & Exclusion Manager/i)).toBeVisible();
    await page.getByRole('button', { name: /^Email \(/i }).click();
    const firstSwitch = page.locator('tbody button[role="switch"]').first();
    await expect(firstSwitch).toBeVisible();
    await firstSwitch.click();

    // Sidebar: Activity Log
    await page.getByRole('button', { name: /^Activity Log/i }).click();
    await expect(page.getByText(/Safe Local Activity Log/i)).toBeVisible();

    // Sidebar: Settings (Default Redaction Mode + Cross-document retention)
    await page.getByRole('button', { name: /^Settings$/i }).click();
    await expect(page.getByText(/Default Redaction Mode/i)).toBeVisible();
    await page
      .getByRole('switch', { name: /Retain pseudonym mappings across documents in RAM/i })
      .click();

    // Sidebar: Privacy Information + Re-run check
    await page.getByRole('button', { name: /Privacy Information/i }).click();
    await page.getByRole('button', { name: /Re-run Privacy Check/i }).click();
    await expect(page.getByText('VERIFIED')).toBeVisible();

    // Sidebar back to Workspace -> Clear button
    await page.getByRole('button', { name: /Sanitization Workspace/i }).click();
    await page.getByRole('button', { name: /Clear workspace/i }).click();
    await expect(page.getByText(/Side-by-Side Comparison Ready/i)).toBeVisible();

    // Footer links -> History -> Clear History
    await page
      .locator('footer')
      .getByRole('link', { name: /Local Activity Log/i })
      .click();
    await expect(page).toHaveURL('/history');
    await page.getByRole('button', { name: /Clear History/i }).click();
    await expect(page.getByText(/No local activity events recorded yet/i)).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
