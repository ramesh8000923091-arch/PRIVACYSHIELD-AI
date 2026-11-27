import { countEntitiesByCategory, detectPII } from '@/services/detection';
import { applyRedaction, PseudonymMapper } from '@/services/redaction';
import type {
  DetectedEntity,
  DetectionOptions,
  ParsedCsvDocument,
  PIIType,
  RedactionConfig,
} from '@/types';
import { serializeCsvRows } from './csvParser';

export interface CsvSanitizationResult {
  sanitizedRows: string[][];
  sanitizedCsvText: string;
  entities: DetectedEntity[];
  countsByCategory: Record<PIIType, number>;
  redactedCount: number;
  excludedCount: number;
}

/**
 * Performs cell-by-cell PII detection and redaction across a parsed CSV matrix.
 *
 * Guarantees:
 * - Adjacent columns never merge across delimiters into false matches.
 * - Consistent pseudonymization spans the entire CSV document via a shared RAM mapper.
 * - Re-serialized CSV preserves delimiters, headers, rows, columns, and quoted fields.
 */
export function sanitizeCsvDocument(
  csvDoc: ParsedCsvDocument,
  detectionOptions: DetectionOptions,
  redactionConfig: RedactionConfig,
  sharedMapper?: PseudonymMapper
): CsvSanitizationResult {
  const mapper = sharedMapper ?? new PseudonymMapper();
  const sanitizedRows: string[][] = [];
  const allEntities: DetectedEntity[] = [];
  let totalRedacted = 0;
  let totalExcluded = 0;

  for (let rowIndex = 0; rowIndex < csvDoc.rows.length; rowIndex += 1) {
    const row = csvDoc.rows[rowIndex];
    const sanitizedRow: string[] = [];

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cellValue = row[colIndex];
      if (!cellValue) {
        sanitizedRow.push('');
        continue;
      }

      const cellDetection = detectPII(cellValue, detectionOptions);
      if (cellDetection.entities.length === 0) {
        sanitizedRow.push(cellValue);
        continue;
      }

      const cellEntities: DetectedEntity[] = cellDetection.entities.map((entity) => ({
        ...entity,
        id: `csv-r${rowIndex}-c${colIndex}-${entity.id}`,
        cellLocation: {
          row: rowIndex,
          col: colIndex,
          columnName: csvDoc.headers[colIndex],
        },
      }));

      allEntities.push(...cellEntities);

      const cellRedaction = applyRedaction(cellValue, cellEntities, redactionConfig, mapper);
      sanitizedRow.push(cellRedaction.sanitizedText);
      totalRedacted += cellRedaction.redactedCount;
      totalExcluded += cellRedaction.excludedCount;
    }

    sanitizedRows.push(sanitizedRow);
  }

  const sanitizedCsvText = serializeCsvRows(sanitizedRows, csvDoc.delimiter, csvDoc.linebreak);

  return {
    sanitizedRows,
    sanitizedCsvText,
    entities: allEntities,
    countsByCategory: countEntitiesByCategory(allEntities),
    redactedCount: totalRedacted,
    excludedCount: totalExcluded,
  };
}
