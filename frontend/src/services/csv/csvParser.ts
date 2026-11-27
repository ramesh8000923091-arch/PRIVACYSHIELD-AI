import Papa from 'papaparse';
import type { ParsedCsvDocument } from '@/types';

export interface CsvParseResult {
  document: ParsedCsvDocument;
  warnings: string[];
}

/**
 * Safely parses CSV text in-browser using PapaParse while preserving exact
 * delimiters, line endings, quoted fields, and embedded commas/newlines.
 */
export function parseCsvContent(
  rawText: string,
  fileName: string,
  fileSizeBytes: number
): CsvParseResult {
  const parsed = Papa.parse<string[]>(rawText, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  });

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

  const warnings = parsed.errors.map((err) => `Row ${(err.row ?? 0) + 1}: ${err.message}`);

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
  linebreak = '\n'
): string {
  return Papa.unparse(rows as string[][], {
    delimiter,
    newline: linebreak,
    quotes: false,
  });
}
