import { countEntitiesByCategory, detectCsvCells } from '@/services/detection';
import { applyRedaction, PseudonymMapper } from '@/services/redaction';
import type {
  DetectedEntity,
  DetectionOptions,
  DiffSegment,
  ParsedCsvDocument,
  PIIType,
  RedactionConfig,
} from '@/types';
import { serializeCsvRows } from './csvParser';

export interface CsvSanitizationResult {
  sanitizedRows: string[][];
  sanitizedCsvText: string;
  diffSegments: DiffSegment[];
  redactedCellKeys: Set<string>;
  excludedCellKeys: Set<string>;
  entities: DetectedEntity[];
  countsByCategory: Record<PIIType, number>;
  redactedCount: number;
  excludedCount: number;
}

const MAX_DIFF_ROWS_FOR_SEGMENTS = 150;

function needsCsvQuotes(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')
  );
}

function escapeCsvQuotes(value: string): string {
  return value.replace(/"/g, '""');
}

/**
 * Redacts a parsed CSV matrix using pre-detected cell entities (zero duplicate detection!)
 * and emits CSV-aware DiffSegments + cell redaction markers + formula-safe serialized output.
 */
export function redactCsvDocument(
  csvDoc: ParsedCsvDocument,
  entities: readonly DetectedEntity[],
  redactionConfig: RedactionConfig,
  sharedMapper?: PseudonymMapper
): CsvSanitizationResult {
  const mapper = sharedMapper ?? new PseudonymMapper();
  const entitiesByCell = new Map<string, DetectedEntity[]>();

  for (const entity of entities) {
    if (!entity.cellLocation) continue;
    const key = `${entity.cellLocation.row}:${entity.cellLocation.col}`;
    const list = entitiesByCell.get(key);
    if (list) {
      list.push(entity);
    } else {
      entitiesByCell.set(key, [entity]);
    }
  }

  const sanitizedRows: string[][] = [];
  const diffSegments: DiffSegment[] = [];
  const redactedCellKeys = new Set<string>();
  const excludedCellKeys = new Set<string>();
  let totalRedacted = 0;
  let totalExcluded = 0;
  let segIdx = 0;

  const emitDiff = csvDoc.rows.length <= MAX_DIFF_ROWS_FOR_SEGMENTS;

  for (let rowIndex = 0; rowIndex < csvDoc.rows.length; rowIndex += 1) {
    const row = csvDoc.rows[rowIndex];
    const sanitizedRow: string[] = [];

    if (emitDiff && rowIndex > 0) {
      diffSegments.push({
        id: `csv-nl-${segIdx++}`,
        kind: 'unchanged',
        originalText: csvDoc.linebreak,
        sanitizedText: csvDoc.linebreak,
      });
    }

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cellValue = row[colIndex];
      const cellKey = `${rowIndex}:${colIndex}`;
      const cellEntities = entitiesByCell.get(cellKey);

      if (emitDiff && colIndex > 0) {
        diffSegments.push({
          id: `csv-dl-${segIdx++}`,
          kind: 'unchanged',
          originalText: csvDoc.delimiter,
          sanitizedText: csvDoc.delimiter,
        });
      }

      if (!cellValue || !cellEntities || cellEntities.length === 0) {
        sanitizedRow.push(cellValue);
        if (emitDiff) {
          const quoted = needsCsvQuotes(cellValue, csvDoc.delimiter)
            ? `"${escapeCsvQuotes(cellValue)}"`
            : cellValue;
          diffSegments.push({
            id: `csv-cell-${segIdx++}`,
            kind: 'unchanged',
            originalText: quoted,
            sanitizedText: quoted,
          });
        }
        continue;
      }

      const cellRedaction = applyRedaction(cellValue, cellEntities, redactionConfig, mapper);
      sanitizedRow.push(cellRedaction.sanitizedText);
      totalRedacted += cellRedaction.redactedCount;
      totalExcluded += cellRedaction.excludedCount;

      if (cellRedaction.redactedCount > 0) redactedCellKeys.add(cellKey);
      if (cellRedaction.excludedCount > 0) excludedCellKeys.add(cellKey);

      if (emitDiff) {
        const origNeedsQuote = needsCsvQuotes(cellValue, csvDoc.delimiter);
        const sanNeedsQuote = needsCsvQuotes(cellRedaction.sanitizedText, csvDoc.delimiter);
        const wrapQuotes = origNeedsQuote || sanNeedsQuote;

        if (wrapQuotes) {
          diffSegments.push({
            id: `csv-qo-${segIdx++}`,
            kind: 'unchanged',
            originalText: origNeedsQuote ? '"' : '',
            sanitizedText: sanNeedsQuote ? '"' : '',
          });
        }

        for (const seg of cellRedaction.diffSegments) {
          diffSegments.push({
            ...seg,
            id: `csv-seg-${segIdx++}`,
            originalText: origNeedsQuote ? escapeCsvQuotes(seg.originalText) : seg.originalText,
            sanitizedText: sanNeedsQuote ? escapeCsvQuotes(seg.sanitizedText) : seg.sanitizedText,
          });
        }

        if (wrapQuotes) {
          diffSegments.push({
            id: `csv-qc-${segIdx++}`,
            kind: 'unchanged',
            originalText: origNeedsQuote ? '"' : '',
            sanitizedText: sanNeedsQuote ? '"' : '',
          });
        }
      }
    }

    sanitizedRows.push(sanitizedRow);
  }

  const sanitizedCsvText = serializeCsvRows(sanitizedRows, csvDoc.delimiter, csvDoc.linebreak, {
    neutralizeFormulas: true,
  });

  return {
    sanitizedRows,
    sanitizedCsvText,
    diffSegments,
    redactedCellKeys,
    excludedCellKeys,
    entities: [...entities],
    countsByCategory: countEntitiesByCategory(entities),
    redactedCount: totalRedacted,
    excludedCount: totalExcluded,
  };
}

/**
 * Convenience single-call CSV detection + redaction (used in unit tests & direct callers).
 */
export function sanitizeCsvDocument(
  csvDoc: ParsedCsvDocument,
  detectionOptions: DetectionOptions,
  redactionConfig: RedactionConfig,
  sharedMapper?: PseudonymMapper
): CsvSanitizationResult {
  const detected = detectCsvCells(csvDoc.rows, csvDoc.headers, detectionOptions);
  return redactCsvDocument(csvDoc, detected.entities, redactionConfig, sharedMapper);
}
