import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const SENSITIVE_CANARIES = [
  'priya.sharma@example.com',
  'arjun.mehta@example.org',
  '4111-1111-1111-1111',
  'ABCPK1234F',
  'AAACA5678K',
];

test.describe('Phase 10 — Complete Workspace E2E, File Export & Privacy Security Audit', () => {
  test('verifies sample scan, all 3 redaction modes, entity exclusion, TXT download, CSV upload & download, and zero PII leaks', async ({
    page,
  }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const externalNetworkPayloads: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('request', (req) => {
      const url = req.url();
      const postData = req.postData() ?? '';
      const isLocal =
        url.startsWith('http://localhost:5173') ||
        url.startsWith('http://127.0.0.1:5173') ||
        url.startsWith('https://fonts.googleapis.com') ||
        url.startsWith('https://fonts.gstatic.com') ||
        url.startsWith('data:') ||
        url.startsWith('blob:');

      if (!isLocal || postData.length > 0) {
        externalNetworkPayloads.push(`${req.method()} ${url} ${postData}`);
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    // 1. Load Sample Data
    await page.getByRole('button', { name: /Load Sample Data/i }).click();
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

    const sanitizedPane = page.getByTestId('diff-sanitized-pane');
    await expect(sanitizedPane).toContainText('[REDACTED_EMAIL]');
    await expect(sanitizedPane).toContainText('[REDACTED_CREDIT_CARD]');
    await expect(sanitizedPane).not.toContainText('priya.sharma@example.com');

    // 2. Switch to Partial Mask
    await page.getByRole('tab', { name: /Partial Mask/i }).click();
    await expect(sanitizedPane).toContainText('pr****@example.com');
    await expect(sanitizedPane).toContainText('192.168.xxx.xxx');
    await expect(sanitizedPane).toContainText('XXXX-XXXX-XXXX-1111');

    // 3. Switch to Consistent Pseudonymization
    await page.getByRole('tab', { name: /Pseudonymize/i }).click();
    await expect(sanitizedPane).toContainText('USER_01');
    await expect(sanitizedPane).toContainText('PHONE_01');
    await expect(sanitizedPane).toContainText('CARD_01');

    // Capture full desktop workspace screenshot
    await page.screenshot({
      path: 'test-results/phase10-workspace-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // 4. Exclude one entity interactively by clicking a highlighted value
    const highlightedEmail = page
      .getByLabel('Live highlighted sensitive text')
      .getByRole('button', { name: 'priya.sharma@example.com' })
      .first();
    await highlightedEmail.click();
    await page.getByRole('button', { name: /Exclude from Redaction/i }).click();
    await expect(page.getByText('1 excluded', { exact: true })).toBeVisible();
    await expect(sanitizedPane).toContainText('priya.sharma@example.com');
    // Re-include it so download is fully sanitized
    await page.getByRole('button', { name: /Include in Redaction/i }).click();
    await expect(sanitizedPane).not.toContainText('priya.sharma@example.com');

    // 5. One-click TXT download verification
    const txtDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download \.TXT/i }).click();
    const txtDownload = await txtDownloadPromise;
    expect(txtDownload.suggestedFilename()).toMatch(/\.txt$/);
    const txtPath = await txtDownload.path();
    expect(txtPath).toBeTruthy();
    if (txtPath) {
      const txtContent = await fs.readFile(txtPath, 'utf-8');
      expect(txtContent).toContain('USER_01');
      expect(txtContent).not.toContain('priya.sharma@example.com');
      expect(txtContent).not.toContain('4111-1111-1111-1111');
    }

    // 6. CSV Upload -> Sanitized CSV Table -> Download .CSV preserving quoted fields
    await page.getByRole('tab', { name: /Upload File/i }).click();
    const syntheticCsvBuffer = Buffer.from(
      'id,name,email,notes\n1,"Sharma, Priya",priya.sharma@example.com,"Card 4111-1111-1111-1111, PAN ABCPK1234F"\n2,"Mehta, Arjun",priya.sharma@example.com,"Repeat email test"\n',
      'utf-8'
    );
    await page.getByTestId('file-upload-input').setInputFiles({
      name: 'customers-test.csv',
      mimeType: 'text/csv',
      buffer: syntheticCsvBuffer,
    });

    await expect(page.getByText('customers-test.csv', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Sanitized CSV Table/i }).click();
    await expect(page.getByRole('cell', { name: 'Sharma, Priya' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'USER_01' }).first()).toBeVisible();

    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download \.CSV/i }).click();
    const csvDownload = await csvDownloadPromise;
    expect(csvDownload.suggestedFilename()).toBe('customers-test-sanitized.csv');
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();
    if (csvPath) {
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      expect(csvContent).toContain('"Sharma, Priya"');
      expect(csvContent).toContain('USER_01');
      expect(csvContent).not.toContain('priya.sharma@example.com');
      expect(csvContent).not.toContain('4111-1111-1111-1111');
      expect(csvContent).not.toContain('ABCPK1234F');
    }

    // 7. Navigate to Activity Log page and verify safe metadata only
    await page.goto('/history');
    await expect(page.getByText('Local Activity & Audit Log')).toBeVisible();
    await expect(page.getByText('FILE_DOWNLOADED').first()).toBeVisible();

    // 8. PRIVACY & SECURITY AUDIT: Zero sensitive values in storage, console, or network!
    const storageDump = await page.evaluate(() => {
      const ls = Object.entries(window.localStorage)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      const ss = Object.entries(window.sessionStorage)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      return { ls, ss };
    });

    const combinedConsole = consoleLogs.join('\n');
    const combinedNetwork = externalNetworkPayloads.join('\n');

    for (const canary of SENSITIVE_CANARIES) {
      expect(storageDump.ls).not.toContain(canary);
      expect(storageDump.ss).not.toContain(canary);
      expect(combinedConsole).not.toContain(canary);
      expect(combinedNetwork).not.toContain(canary);
    }

    expect(externalNetworkPayloads).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('renders Workspace cleanly without horizontal overflow on mobile (390x844)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/workspace');
    await page.getByRole('button', { name: /Load Sample Data/i }).click();
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);

    await page.screenshot({
      path: 'test-results/phase10-workspace-mobile.png',
      fullPage: false,
      animations: 'disabled',
    });
  });
});
