import Papa from 'papaparse';
import type { ParsedCsvDocument } from '@/types';

export interface CsvParseResult {
  document: ParsedCsvDocument;
  warnings: string[];
}

const FORMULA_TRIGGER_REGEX = /^[=+\-@\t\r]/;
const SAFE_NEGATIVE_NUMBER_REGEX = /^-\d+(?:\.\d+)?$/;

/**
 * Neutralizes spreadsheet formula injection (DDE/CSV injection) on export
 * while preserving ordinary negative numbers (e.g. -42.5).
 */
export function neutralizeCsvFormula(cell: string): string {
  if (!cell) return cell;
  if (FORMULA_TRIGGER_REGEX.test(cell) && !SAFE_NEGATIVE_NUMBER_REGEX.test(cell)) {
    return `'${cell}`;
  }
  return cell;
}

/**
 * Guesses common non-comma delimiters (; \t |) when PapaParse hits UndetectableDelimiter
 * (e.g. 2-row CSVs ending with a trailing newline).
 */
function guessDelimiterFromNonEmptyLines(rawText: string): string | undefined {
  const lines = rawText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);

  if (lines.length === 0) return undefined;

  for (const candidate of [';', '\t', '|'] as const) {
    const counts = lines.map((line) => {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === candidate && !inQuotes) {
          count += 1;
        }
      }
      return count;
    });
    if (counts[0] > 0 && counts.every((c) => c === counts[0])) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Safely parses CSV text in-browser using PapaParse while preserving exact
 * delimiters (comma, semicolon, tab, pipe), line endings, quoted fields, and embedded newlines.
 */
export function parseCsvContent(
  rawText: string,
  fileName: string,
  fileSizeBytes: number
): CsvParseResult {
  let parsed = Papa.parse<string[]>(rawText, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  });

  if (parsed.errors.some((e) => e.code === 'UndetectableDelimiter')) {
    const guessed = guessDelimiterFromNonEmptyLines(rawText);
    if (guessed) {
      parsed = Papa.parse<string[]>(rawText, {
        header: false,
        skipEmptyLines: false,
        dynamicTyping: false,
        delimiter: guessed,
      });
    }
  }

  const rows: string[][] = parsed.data.map((row) =>
    Array.isArray(row) ? row.map((cell) => (cell == null ? '' : String(cell))) : []
  );

  // Remove a single trailing blank artifact row caused by a final newline
  if (rows.length > 1) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.length === 1 && lastRow[0] === '') {
      rows.pop();
    }
  }

  const hasHeader = rows.length > 0;
  const headers = hasHeader ? rows[0] : [];

  const warnings = parsed.errors
    .filter((err) => err.code !== 'UndetectableDelimiter')
    .map((err) => `Row ${(err.row ?? 0) + 1}: ${err.message}`);

  return {
    document: {
      fileName,
      fileSizeBytes,
      delimiter: parsed.meta.delimiter || ',',
      linebreak: parsed.meta.linebreak || '\n',
      hasHeader,
      headers,
      rows,
    },
    warnings,
  };
}

export function serializeCsvRows(
  rows: readonly (readonly string[])[],
  delimiter = ',',
  linebreak = '\n',
  options: { neutralizeFormulas?: boolean } = {}
): string {
  const safeRows = options.neutralizeFormulas
    ? rows.map((row) => row.map((cell) => neutralizeCsvFormula(cell)))
    : (rows as string[][]);

  return Papa.unparse(safeRows, {
    delimiter,
    newline: linebreak,
    quotes: false,
  });
}
