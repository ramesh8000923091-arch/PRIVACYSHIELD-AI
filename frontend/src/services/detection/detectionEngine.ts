import { DEFAULT_ENABLED_CATEGORIES, LIMITS } from '@/constants';
import type {
  DetectedEntity,
  DetectionOptions,
  DetectionSummary,
  ParsedCsvDocument,
  PIIType,
} from '@/types';
import { detectAadhaar } from './aadhaarDetector';
import { detectCreditCards } from './creditCardDetector';
import { detectEmails } from './emailDetector';
import { detectIpAddresses } from './ipDetector';
import { resolveOverlaps } from './overlapResolver';
import { detectPans } from './panDetector';
import { detectPhones } from './phoneDetector';

export function createEmptyCategoryCounts(): Record<PIIType, number> {
  return {
    EMAIL: 0,
    PHONE: 0,
    IP_ADDRESS: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };
}

export function countEntitiesByCategory(
  entities: readonly DetectedEntity[]
): Record<PIIType, number> {
  const counts = createEmptyCategoryCounts();
  for (const entity of entities) {
    counts[entity.type] += 1;
  }
  return counts;
}

/**
 * Fast byte-length check avoiding full 10 MB UTF-8 buffer allocation on the main thread.
 */
function exceedsWorkerByteThreshold(text: string): boolean {
  const threshold = LIMITS.WORKER_TEXT_THRESHOLD_BYTES;
  if (text.length >= threshold) return true;
  if (text.length * 3 < threshold) return false;
  return new TextEncoder().encode(text).byteLength >= threshold;
}

/**
 * Synchronous deterministic client-side PII detection engine.
 * Preserves exact original string indices and never mutates input text.
 */
export function detectPII(text: string, options?: DetectionOptions): DetectionSummary {
  const startedAt = performance.now();

  if (!text) {
    return {
      entities: [],
      countsByCategory: createEmptyCategoryCounts(),
      totalDetected: 0,
      durationMs: 0,
      usedWorker: false,
    };
  }

  const enabled = options?.enabledCategories ?? DEFAULT_ENABLED_CATEGORIES;
  const rawCandidates: DetectedEntity[] = [];

  if (enabled.CREDIT_CARD) rawCandidates.push(...detectCreditCards(text));
  if (enabled.AADHAAR) rawCandidates.push(...detectAadhaar(text));
  if (enabled.EMAIL) rawCandidates.push(...detectEmails(text));
  if (enabled.IP_ADDRESS) rawCandidates.push(...detectIpAddresses(text));
  if (enabled.PAN) rawCandidates.push(...detectPans(text));
  if (enabled.PHONE) rawCandidates.push(...detectPhones(text));

  const entities = resolveOverlaps(rawCandidates);
  const countsByCategory = countEntitiesByCategory(entities);
  const durationMs = Math.max(0, Number((performance.now() - startedAt).toFixed(2)));

  return {
    entities,
    countsByCategory,
    totalDetected: entities.length,
    durationMs,
    usedWorker: false,
  };
}

/**
 * Synchronous cell-by-cell CSV PII detection with optional progress callback
 * (shared between the main thread and the isolated detection Web Worker).
 */
export function detectCsvCells(
  rows: readonly (readonly string[])[],
  headers: readonly string[],
  options?: DetectionOptions,
  onProgress?: (percent: number) => void
): DetectionSummary {
  const startedAt = performance.now();
  const allEntities: DetectedEntity[] = [];
  const totalRows = Math.max(1, rows.length);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cellValue = row[colIndex];
      if (!cellValue) continue;
      const cellDetection = detectPII(cellValue, options);
      for (const entity of cellDetection.entities) {
        allEntities.push({
          ...entity,
          id: `csv-r${rowIndex}-c${colIndex}-${entity.id}`,
          cellLocation: {
            row: rowIndex,
            col: colIndex,
            columnName: headers[colIndex],
          },
        });
      }
    }

    if (onProgress && rowIndex > 0 && rowIndex % 100 === 0) {
      const pct = Math.min(92, Math.round(20 + (rowIndex / totalRows) * 72));
      onProgress(pct);
    }
  }

  const durationMs = Math.max(0, Number((performance.now() - startedAt).toFixed(2)));
  return {
    entities: allEntities,
    countsByCategory: countEntitiesByCategory(allEntities),
    totalDetected: allEntities.length,
    durationMs,
    usedWorker: false,
  };
}

export interface AsyncDetectionParams {
  text: string;
  options?: DetectionOptions;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface AsyncCsvDetectionParams {
  csvDoc: ParsedCsvDocument;
  options?: DetectionOptions;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

function runInWorker(
  message:
    | { type: 'DETECT_TEXT'; text: string; options: DetectionOptions }
    | { type: 'DETECT_CSV'; rows: string[][]; headers: string[]; options: DetectionOptions },
  fallback: () => DetectionSummary,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<DetectionSummary> {
  return new Promise<DetectionSummary>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./detection.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      onProgress?.(50);
      const summary = fallback();
      onProgress?.(100);
      resolve(summary);
      return;
    }

    let settled = false;

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Detection cancelled.', 'AbortError'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (
      event: MessageEvent<
        | { type: 'PROGRESS'; percent: number }
        | { type: 'RESULT'; summary: DetectionSummary }
        | { type: 'ERROR'; message: string }
      >
    ) => {
      if (settled) return;
      const payload = event.data;
      if (payload.type === 'PROGRESS') {
        onProgress?.(payload.percent);
      } else if (payload.type === 'RESULT') {
        settled = true;
        cleanup();
        onProgress?.(100);
        resolve({ ...payload.summary, usedWorker: true });
      } else if (payload.type === 'ERROR') {
        settled = true;
        cleanup();
        reject(new Error(payload.message));
      }
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Background detection worker encountered an unexpected error.'));
    };

    worker.onmessageerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Background detection worker message deserialization failed.'));
    };

    onProgress?.(15);
    if (settled || signal?.aborted) {
      handleAbort();
      return;
    }

    try {
      worker.postMessage(message);
    } catch {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Unable to dispatch document to background worker.'));
      }
    }
  });
}

/**
 * Runs detection synchronously for inputs < 50 KB, or automatically offloads
 * to an isolated browser Web Worker for >= 50 KB with cancellation and error handling.
 */
export async function detectPIIAsync({
  text,
  options = { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
  signal,
  onProgress,
}: AsyncDetectionParams): Promise<DetectionSummary> {
  if (signal?.aborted) {
    throw new DOMException('Detection cancelled.', 'AbortError');
  }

  const canUseWorker = typeof Worker !== 'undefined' && exceedsWorkerByteThreshold(text);

  if (!canUseWorker) {
    onProgress?.(40);
    const summary = detectPII(text, options);
    onProgress?.(100);
    return summary;
  }

  return runInWorker(
    { type: 'DETECT_TEXT', text, options },
    () => detectPII(text, options),
    signal,
    onProgress
  );
}

/**
 * Runs cell-level CSV detection synchronously for small CSVs, or offloads automatically
 * to the browser Web Worker when rows > LIMITS.WORKER_CSV_ROW_THRESHOLD (500) or size >= 50 KB.
 */
export async function detectCsvAsync({
  csvDoc,
  options = { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
  signal,
  onProgress,
}: AsyncCsvDetectionParams): Promise<DetectionSummary> {
  if (signal?.aborted) {
    throw new DOMException('Detection cancelled.', 'AbortError');
  }

  const shouldUseWorker =
    typeof Worker !== 'undefined' &&
    (csvDoc.rows.length > LIMITS.WORKER_CSV_ROW_THRESHOLD ||
      csvDoc.fileSizeBytes >= LIMITS.WORKER_TEXT_THRESHOLD_BYTES);

  if (!shouldUseWorker) {
    onProgress?.(45);
    const summary = detectCsvCells(csvDoc.rows, csvDoc.headers, options);
    onProgress?.(100);
    return summary;
  }

  return runInWorker(
    { type: 'DETECT_CSV', rows: csvDoc.rows, headers: csvDoc.headers, options },
    () => detectCsvCells(csvDoc.rows, csvDoc.headers, options),
    signal,
    onProgress
  );
}
