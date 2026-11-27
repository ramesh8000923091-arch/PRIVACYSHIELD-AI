import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('Workspace Hardening — Web Worker, Large CSV, Formula Safety, Restore AI Reply & Responsive', () => {
  test('offloads >= 50 KB document to a real browser Web Worker and scans without UI freeze', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    await page.getByRole('tab', { name: /Upload File/i }).click();
    const bigLine =
      'Audit entry: contact sec.user@example.com from 192.168.10.22 regarding PAN ABCPK1234F.\n';
    const largeBuffer = Buffer.from(bigLine.repeat(750), 'utf-8');
    expect(largeBuffer.byteLength).toBeGreaterThan(55_000);

    await page.getByTestId('file-upload-input').setInputFiles({
      name: 'large-audit-log.txt',
      mimeType: 'text/plain',
      buffer: largeBuffer,
    });

    await expect(page.getByText('Web Worker Thread')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('2250');
    expect(consoleErrors).toEqual([]);
  });

  test('handles semicolon CSV, formula neutralization, and > 500-row CSV Web Worker export', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    await page.getByRole('tab', { name: /Upload File/i }).click();
    const rows = ['id;email;formula;balance'];
    rows.push('1;priya@example.com;=HYPERLINK("https://evil.example","Open");-42.5');
    for (let i = 2; i <= 510; i += 1) {
      rows.push(`${i};user${i}@example.com;safe_note;${i}`);
    }
    const csvBuffer = Buffer.from(rows.join('\n') + '\n', 'utf-8');

    await page.getByTestId('file-upload-input').setInputFiles({
      name: 'enterprise-semicolon.csv',
      mimeType: 'text/csv',
      buffer: csvBuffer,
    });

    await expect(page.getByText('Web Worker Thread')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('510');
    await expect(page.getByText(/rows × 4 cols \(;\)/)).toBeVisible();
    // Auto-selects CSV Table view and caps initial preview at 100 rows
    await expect(page.getByText(/Showing first 100 of 51\d data rows/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download \.CSV/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('enterprise-semicolon-sanitized.csv');
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    if (filePath) {
      const text = await fs.readFile(filePath, 'utf-8');
      expect(text).toContain("'=HYPERLINK");
      expect(text).toContain(';-42.5');
      expect(text).not.toContain('priya@example.com');
      expect(text).not.toContain('user510@example.com');
    }
  });

  test('blocks disguised binary upload, verifies Undo/Redo value rollback, and tests Restore AI Reply', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/workspace');

    // 1. Disguised binary file error alert
    await page.getByRole('tab', { name: /Upload File/i }).click();
    await page.getByTestId('file-upload-input').setInputFiles({
      name: 'fake-pdf.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
    });
    await expect(page.getByRole('alert')).toContainText(/binary/i);

    // 2. Paste tab -> Load Sample -> Undo/Redo value check
    await page.getByRole('tab', { name: /Paste Text/i }).click();
    await page.getByRole('button', { name: /Load Sample Data/i }).click();
    await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

    const editor = page.getByLabel(/Raw document text input/i);
    await editor.fill('Contact priya@example.com now.');
    await editor.fill('Contact priya@example.com now. UPDATED');
    await page.getByRole('button', { name: /Undo edit/i }).click();
    await expect(editor).toHaveValue('Contact priya@example.com now.');
    await page.getByRole('button', { name: /Redo edit/i }).click();
    await expect(editor).toHaveValue('Contact priya@example.com now. UPDATED');

    // 3. Pseudonymize -> Restore AI Reply
    await page.getByRole('tab', { name: /Pseudonymize/i }).click();
    await expect(page.getByTestId('diff-sanitized-pane')).toContainText('USER_01');
    await page.getByRole('button', { name: /Restore AI Reply/i }).click();
    await page.getByLabel(/Pseudonymized AI Response/i).fill('Reply to USER_01 confirmed.');
    await expect(page.getByTestId('restored-ai-reply-output')).toContainText(
      'Reply to priya@example.com confirmed.'
    );
  });

  test('renders Workspace cleanly in Light theme on Tablet (768x1024) and Mobile (390x844)', async ({
    page,
  }) => {
    for (const vp of [
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto('/workspace');
      const lightBtn = page.getByRole('button', { name: /Switch to light theme/i });
      if (await lightBtn.isVisible()) {
        await lightBtn.click();
      }
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      await page.getByRole('button', { name: /Load Sample Data/i }).click();
      await expect(page.getByTestId('analytics-total-detected')).toHaveText('13');

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflow).toBe(false);
    }
  });
});
