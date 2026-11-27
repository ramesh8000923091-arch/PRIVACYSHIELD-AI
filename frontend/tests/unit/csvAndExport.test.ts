import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_CATEGORIES, LIMITS, SAMPLE_CSV_TEXT } from '@/constants';
import { parseCsvContent, sanitizeCsvDocument } from '@/services/csv';
import {
  buildSanitizedFileName,
  createSafePrivacyReport,
  downloadSanitizedFile,
} from '@/services/export';
import { verifyNoSensitiveDataInPayload } from '@/services/privacy';
import { PseudonymMapper } from '@/services/redaction';
import { containsBinaryNullBytes, validateUploadedFile } from '@/utils/fileValidation';

describe('Phase 8 — CSV Cell Sanitization, File Validation & Safe Export', () => {
  it('preserves CSV rows, columns, headers, and commas inside quoted fields during sanitization', () => {
    const { document: csvDoc } = parseCsvContent(
      SAMPLE_CSV_TEXT,
      'customers.csv',
      SAMPLE_CSV_TEXT.length
    );
    expect(csvDoc.rows).toHaveLength(3);
    expect(csvDoc.headers).toEqual([
      'record_id',
      'full_name',
      'email',
      'phone',
      'pan',
      'aadhaar_ref',
      'notes',
    ]);

    const mapper = new PseudonymMapper();
    const result = sanitizeCsvDocument(
      csvDoc,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      {
        mode: 'PSEUDONYMIZE',
        fullMaskVariant: 'CATEGORY_TAG',
        excludedEntityIds: new Set(),
      },
      mapper
    );

    // Re-parse the sanitized CSV to verify structural integrity
    const reparsed = parseCsvContent(
      result.sanitizedCsvText,
      'customers-sanitized.csv',
      result.sanitizedCsvText.length
    );
    expect(reparsed.document.rows).toHaveLength(3);
    expect(reparsed.document.rows[1][1]).toBe('Sharma, Priya');
    // Repeated email across row 1 column 2 and row 2 column 6 maps to identical USER_01
    expect(reparsed.document.rows[1][2]).toBe('USER_01');
    expect(reparsed.document.rows[2][6]).toContain('USER_01');
    // Raw sensitive data completely removed
    expect(result.sanitizedCsvText).not.toContain('priya.sharma@example.com');
    expect(result.sanitizedCsvText).not.toContain('4111-1111-1111-1111');
    expect(result.sanitizedCsvText).not.toContain('ABCPK1234F');
  });

  it('validates uploaded file extensions, sizes, and MIME types safely', () => {
    const validTxt = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(validateUploadedFile(validTxt)).toEqual({ valid: true, extension: '.txt' });

    const validCsv = new File(['a,b\n1,2'], 'data.csv', { type: 'text/csv' });
    expect(validateUploadedFile(validCsv)).toEqual({ valid: true, extension: '.csv' });

    const invalidExe = new File(['MZ'], 'malware.exe', { type: 'application/octet-stream' });
    expect(validateUploadedFile(invalidExe).valid).toBe(false);

    const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
    expect(validateUploadedFile(emptyFile).valid).toBe(false);

    // File exceeding 10 MB limit must be rejected
    const oversized = new File(['x'], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(oversized, 'size', { value: LIMITS.MAX_FILE_SIZE_BYTES + 1 });
    expect(validateUploadedFile(oversized).valid).toBe(false);
    expect(containsBinaryNullBytes('clean text')).toBe(false);
    expect(containsBinaryNullBytes('bad\u0000binary')).toBe(true);
  });

  it('handles quoted newlines, empty cells, and Unicode inside CSV without corrupting structure', () => {
    const complexCsv =
      'id,label,notes,empty_col\n1,"नमस्ते, User","Line 1\nReach anuj@example.com",\n2,"Plain","IP 10.0.0.5",';
    const { document: csvDoc } = parseCsvContent(complexCsv, 'unicode.csv', complexCsv.length);
    expect(csvDoc.rows).toHaveLength(3);

    const sanitized = sanitizeCsvDocument(
      csvDoc,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );

    const reparsed = parseCsvContent(
      sanitized.sanitizedCsvText,
      'unicode-sanitized.csv',
      sanitized.sanitizedCsvText.length
    );
    expect(reparsed.document.rows).toHaveLength(3);
    expect(reparsed.document.rows[1][1]).toBe('नमस्ते, User');
    expect(reparsed.document.rows[1][2]).toBe('Line 1\nReach [REDACTED_EMAIL]');
    expect(reparsed.document.rows[1][3]).toBe('');
    expect(reparsed.document.rows[2][2]).toBe('IP [REDACTED_IP_ADDRESS]');
  });

  it('releases temporary Blob object URLs immediately after download (regression)', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const fileName = downloadSanitizedFile('clean content', 'txt', 'report.txt');
    expect(fileName).toBe('report-sanitized.txt');
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('builds non-overwriting sanitized filenames and zero-PII privacy reports', () => {
    expect(buildSanitizedFileName('csv', 'customers.csv')).toBe('customers-sanitized.csv');
    expect(buildSanitizedFileName('txt', 'support log.txt')).toBe('support_log-sanitized.txt');

    const report = createSafePrivacyReport(
      {
        totalDetected: 5,
        totalRedacted: 5,
        totalExcluded: 0,
        countsByCategory: {
          EMAIL: 2,
          PHONE: 1,
          IP_ADDRESS: 1,
          PAN: 1,
          AADHAAR: 0,
          CREDIT_CARD: 0,
        },
        originalCharCount: 250,
        sanitizedCharCount: 210,
        originalWordCount: 30,
        sanitizedWordCount: 30,
        processingTimeMs: 1.4,
        usedWorker: false,
        isSanitized: true,
      },
      'FULL_MASK'
    );

    expect(verifyNoSensitiveDataInPayload(report, ['priya.sharma@example.com', 'ABCPK1234F'])).toBe(
      true
    );
  });
});
