import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_CATEGORIES, LIMITS, SAMPLE_CSV_TEXT } from '@/constants';
import { parseCsvContent, redactCsvDocument, sanitizeCsvDocument } from '@/services/csv';
import { detectCsvCells } from '@/services/detection';
import {
  buildSanitizedFileName,
  createSafePrivacyReport,
  downloadJsonReport,
  downloadSanitizedFile,
  exportSafeAuditLogSummary,
} from '@/services/export';
import { verifyNoSensitiveDataInPayload } from '@/services/privacy';
import { PseudonymMapper } from '@/services/redaction';
import {
  containsBinaryNullBytes,
  validateUploadedFile,
  validateUtf8TextBytes,
} from '@/utils/fileValidation';

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

  it('detects semicolon and tab delimiters reliably even on 2-row CSVs with trailing newline and quoted commas', () => {
    const semiCsv =
      'id;name;email;formula;balance\n1;"Sharma, Priya";priya@example.com;"=HYPERLINK(""https://evil.example"",""Click"")";-42.5\n';
    const semiParsed = parseCsvContent(semiCsv, 'semi.csv', semiCsv.length);
    expect(semiParsed.document.delimiter).toBe(';');
    expect(semiParsed.warnings).toEqual([]);
    expect(semiParsed.document.headers).toEqual(['id', 'name', 'email', 'formula', 'balance']);
    expect(semiParsed.document.rows[1]).toEqual([
      '1',
      'Sharma, Priya',
      'priya@example.com',
      '=HYPERLINK("https://evil.example","Click")',
      '-42.5',
    ]);

    const tabCsv = 'id\temail\n1\tpriya@example.com\n';
    const tabParsed = parseCsvContent(tabCsv, 'tab.csv', tabCsv.length);
    expect(tabParsed.document.delimiter).toBe('\t');
    expect(tabParsed.document.headers).toEqual(['id', 'email']);
  });

  it('neutralizes CSV/DDE spreadsheet formula injection while preserving legitimate negative numbers', () => {
    const formulaCsv =
      'id,formula,balance,email\n1,"=HYPERLINK(""https://evil.example"",""Click"")",-42.5,priya@example.com\n2,+cmd|calc,-100,ok@example.org\n';
    const { document: csvDoc } = parseCsvContent(formulaCsv, 'formula.csv', formulaCsv.length);
    const out = sanitizeCsvDocument(
      csvDoc,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );
    const reparsed = parseCsvContent(out.sanitizedCsvText, 'safe.csv', out.sanitizedCsvText.length);
    expect(reparsed.document.rows[1][1].startsWith("'=HYPERLINK")).toBe(true);
    expect(reparsed.document.rows[1][2]).toBe('-42.5');
    expect(reparsed.document.rows[2][1]).toBe("'+cmd|calc");
    expect(reparsed.document.rows[2][2]).toBe('-100');
  });

  it('handles 550-row CSV single-pass redaction with per-entity exclusion, cell highlights, and diffSegments', () => {
    const lines = ['id,email'];
    for (let i = 1; i <= 550; i += 1) {
      lines.push(`${i},user${i}@example.com`);
    }
    const largeCsv = lines.join('\n');
    const { document: csvDoc } = parseCsvContent(largeCsv, 'large.csv', largeCsv.length);
    const detection = detectCsvCells(csvDoc.rows, csvDoc.headers, {
      enabledCategories: DEFAULT_ENABLED_CATEGORIES,
    });
    expect(detection.totalDetected).toBe(550);

    const excludedId = detection.entities[0].id;
    const redacted = redactCsvDocument(csvDoc, detection.entities, {
      mode: 'FULL_MASK',
      fullMaskVariant: 'CATEGORY_TAG',
      excludedEntityIds: new Set([excludedId]),
    });

    expect(redacted.redactedCount).toBe(549);
    expect(redacted.excludedCount).toBe(1);
    expect(redacted.excludedCellKeys.has('1:1')).toBe(true);
    expect(redacted.redactedCellKeys.has('2:1')).toBe(true);
    // Large CSVs (>150 rows) skip DOM diffSegments generation to keep UI snappy
    expect(redacted.diffSegments).toHaveLength(0);
    expect(redacted.sanitizedRows[1][1]).toBe('user1@example.com');
    expect(redacted.sanitizedRows[2][1]).toBe('[REDACTED_EMAIL]');

    // Small CSVs emit full CSV-aware diffSegments for highlighted Text Diff
    const { document: smallDoc } = parseCsvContent(
      SAMPLE_CSV_TEXT,
      'small.csv',
      SAMPLE_CSV_TEXT.length
    );
    const smallOut = sanitizeCsvDocument(
      smallDoc,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );
    expect(smallOut.diffSegments.some((seg) => seg.kind === 'redacted')).toBe(true);
  });

  it('rejects disguised binary files (PDF/PNG/invalid UTF-8) via byte inspection', async () => {
    const fakePdf = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])],
      'fake.txt',
      {
        type: 'text/plain',
      }
    );
    const fakePng = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      'img.csv',
      {
        type: 'text/csv',
      }
    );
    const validText = new File(['Hello, priya@example.com\n'], 'clean.txt', {
      type: 'text/plain',
    });
    // >8 KB multi-byte Devanagari UTF-8 text crossing the 8192-byte sample boundary + legitimate "MZ" header CSV
    const largeUnicode = new File(['नमस्ते privacyshield परीक्षण '.repeat(350)], 'hindi.txt', {
      type: 'text/plain',
    });
    const mzHeaderCsv = new File(['MZ_ID,email\n1,priya@example.com\n'], 'mz-codes.csv', {
      type: 'text/csv',
    });

    expect((await validateUtf8TextBytes(fakePdf)).valid).toBe(false);
    expect((await validateUtf8TextBytes(fakePng)).valid).toBe(false);
    expect((await validateUtf8TextBytes(validText)).valid).toBe(true);
    expect((await validateUtf8TextBytes(largeUnicode)).valid).toBe(true);
    expect((await validateUtf8TextBytes(mzHeaderCsv)).valid).toBe(true);
  });

  it('revokes Blob URLs for JSON report and audit summary downloads', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:json-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const reportName = downloadJsonReport({ safe: true }, 'test-report');
    const auditName = exportSafeAuditLogSummary([]);

    expect(reportName).toMatch(/^test-report-.*\.json$/);
    expect(auditName).toMatch(/^privacyshield-audit-summary-.*\.json$/);
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenCalledTimes(2);

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('handles malformed CSV quotes cleanly with warnings and detects pipe-delimited CSV', () => {
    const malformed = 'id,email,notes\n1,priya@example.com,"unclosed quote\n2,ok@example.org,fine';
    const parsed = parseCsvContent(malformed, 'broken.csv', malformed.length);
    expect(parsed.warnings.length).toBeGreaterThan(0);

    const pipeCsv = 'id|email\n1|priya@example.com\n2|arjun@example.org\n';
    const pipeParsed = parseCsvContent(pipeCsv, 'pipe.csv', pipeCsv.length);
    expect(pipeParsed.document.delimiter).toBe('|');
    const pipeOut = sanitizeCsvDocument(
      pipeParsed.document,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );
    expect(pipeOut.sanitizedCsvText).toContain('1|[REDACTED_EMAIL]');
  });

  it('neutralizes all spreadsheet formula triggers (=, +, -, @, TAB, CR) while keeping negative numbers', () => {
    const triggers = [
      'id,formula,neg',
      '1,=1+1,-99.95',
      '2,+SUM(A1:A2),-0.5',
      '3,-cmd|calc,-42',
      '4,@SUM(1;2),10',
      '5,"\t=1+1",20',
    ].join('\n');
    const { document: csvDoc } = parseCsvContent(triggers, 'triggers.csv', triggers.length);
    const out = sanitizeCsvDocument(
      csvDoc,
      { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );
    const reparsed = parseCsvContent(out.sanitizedCsvText, 'safe.csv', out.sanitizedCsvText.length);
    expect(reparsed.document.rows[1][1]).toBe("'=1+1");
    expect(reparsed.document.rows[1][2]).toBe('-99.95');
    expect(reparsed.document.rows[2][1]).toBe("'+SUM(A1:A2)");
    expect(reparsed.document.rows[3][1]).toBe("'-cmd|calc");
    expect(reparsed.document.rows[4][1]).toBe("'@SUM(1;2)");
    expect(reparsed.document.rows[5][1]).toBe("'\t=1+1");
  });

  it('rejects ZIP/ELF/JPEG disguised binaries, control bytes, invalid UTF-8, and bad MIME types', async () => {
    const fakeZip = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14])], 'archive.csv', {
      type: 'text/csv',
    });
    const fakeElf = new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02])], 'bin.txt', {
      type: 'text/plain',
    });
    const fakeJpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'photo.txt', {
      type: 'text/plain',
    });
    const controlChars = new File([new Uint8Array([0x41, 0x07, 0x42])], 'bell.txt', {
      type: 'text/plain',
    });
    const badUtf8 = new File([new Uint8Array([0x80, 0xff, 0xfe])], 'badutf8.txt', {
      type: 'text/plain',
    });
    const badMime = new File(['hello'], 'notes.txt', { type: 'application/pdf' });

    expect((await validateUtf8TextBytes(fakeZip)).valid).toBe(false);
    expect((await validateUtf8TextBytes(fakeElf)).valid).toBe(false);
    expect((await validateUtf8TextBytes(fakeJpg)).valid).toBe(false);
    expect((await validateUtf8TextBytes(controlChars)).valid).toBe(false);
    expect((await validateUtf8TextBytes(badUtf8)).valid).toBe(false);
    expect(validateUploadedFile(badMime).valid).toBe(false);
    expect(buildSanitizedFileName('txt', '../../etc/passwd.txt')).toBe(
      '.._.._etc_passwd-sanitized.txt'
    );
  });
});
