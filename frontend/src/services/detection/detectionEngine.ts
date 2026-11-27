import { DEFAULT_ENABLED_CATEGORIES, LIMITS } from '@/constants';
import type { DetectedEntity, DetectionOptions, DetectionSummary, PIIType } from '@/types';
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
 * Synchronous deterministic client-side PII detection engine.
 * Preserves exact original string indices and never mutates input text.
 */
export function detectPII(
  text: string,
  options: DetectionOptions = { enabledCategories: DEFAULT_ENABLED_CATEGORIES }
): DetectionSummary {
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

  const enabled = options.enabledCategories;
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

export interface AsyncDetectionParams {
  text: string;
  options?: DetectionOptions;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
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

  const byteSize = new TextEncoder().encode(text).byteLength;
  const canUseWorker =
    typeof Worker !== 'undefined' && byteSize >= LIMITS.WORKER_TEXT_THRESHOLD_BYTES;

  if (!canUseWorker) {
    onProgress?.(40);
    const summary = detectPII(text, options);
    onProgress?.(100);
    return summary;
  }

  return new Promise<DetectionSummary>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./detection.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      // Safe fallback to synchronous execution if worker creation is unavailable
      onProgress?.(50);
      const summary = detectPII(text, options);
      onProgress?.(100);
      resolve(summary);
      return;
    }

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
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
      const payload = event.data;
      if (payload.type === 'PROGRESS') {
        onProgress?.(payload.percent);
      } else if (payload.type === 'RESULT') {
        cleanup();
        onProgress?.(100);
        resolve({ ...payload.summary, usedWorker: true });
      } else if (payload.type === 'ERROR') {
        cleanup();
        reject(new Error(payload.message));
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('Background detection worker encountered an unexpected error.'));
    };

    onProgress?.(15);
    worker.postMessage({ text, options });
  });
}
