import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_CATEGORIES, LIMITS } from '@/constants';
import { detectCsvAsync, detectPIIAsync } from '@/services/detection';
import type { DetectionSummary, ParsedCsvDocument } from '@/types';

describe('Async Detection & Web Worker Offloading', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    globalThis.Worker = originalWorker;
    vi.restoreAllMocks();
  });

  it('falls back cleanly to synchronous detection when Worker is unavailable on >= 50 KB input', async () => {
    // @ts-expect-error simulating environment without Web Workers
    globalThis.Worker = undefined;

    const largeText = 'Contact priya@example.com for details.\n'.repeat(1600);
    expect(largeText.length).toBeGreaterThanOrEqual(LIMITS.WORKER_TEXT_THRESHOLD_BYTES);

    const progressValues: number[] = [];
    const result = await detectPIIAsync({
      text: largeText,
      options: { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      onProgress: (pct) => progressValues.push(pct),
    });

    expect(result.usedWorker).toBe(false);
    expect(result.countsByCategory.EMAIL).toBe(1600);
    expect(progressValues).toContain(100);
  });

  it('offloads >= 50 KB text to Web Worker, streams progress, and resolves with usedWorker=true', async () => {
    const terminateSpy = vi.fn();

    class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: (() => void) | null = null;

      postMessage() {
        queueMicrotask(() => {
          this.onmessage?.({
            data: { type: 'PROGRESS', percent: 55 },
          } as MessageEvent);
          const summary: DetectionSummary = {
            entities: [],
            countsByCategory: {
              EMAIL: 0,
              PHONE: 0,
              IP_ADDRESS: 0,
              PAN: 0,
              AADHAAR: 0,
              CREDIT_CARD: 0,
            },
            totalDetected: 0,
            durationMs: 4.2,
            usedWorker: true,
          };
          this.onmessage?.({
            data: { type: 'RESULT', summary },
          } as MessageEvent);
        });
      }

      terminate = terminateSpy;
    }

    globalThis.Worker = MockWorker as unknown as typeof Worker;

    const largeText = 'a'.repeat(LIMITS.WORKER_TEXT_THRESHOLD_BYTES + 128);
    const progressValues: number[] = [];
    const result = await detectPIIAsync({
      text: largeText,
      options: { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      onProgress: (pct) => progressValues.push(pct),
    });

    expect(result.usedWorker).toBe(true);
    expect(progressValues).toContain(55);
    expect(progressValues).toContain(100);
    expect(terminateSpy).toHaveBeenCalledTimes(1);
  });

  it('terminates Web Worker immediately on AbortSignal cancellation', async () => {
    const terminateSpy = vi.fn();

    class HangingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: (() => void) | null = null;
      postMessage() {}
      terminate = terminateSpy;
    }

    globalThis.Worker = HangingWorker as unknown as typeof Worker;

    const controller = new AbortController();
    const largeText = 'b'.repeat(LIMITS.WORKER_TEXT_THRESHOLD_BYTES + 64);

    const promise = detectPIIAsync({
      text: largeText,
      options: { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toThrow(/cancelled/i);
    expect(terminateSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects cleanly when Worker fires onmessageerror', async () => {
    class ErrorWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: (() => void) | null = null;
      postMessage() {
        queueMicrotask(() => {
          this.onmessageerror?.();
        });
      }
      terminate = vi.fn();
    }

    globalThis.Worker = ErrorWorker as unknown as typeof Worker;
    const largeText = 'c'.repeat(LIMITS.WORKER_TEXT_THRESHOLD_BYTES + 64);

    await expect(
      detectPIIAsync({
        text: largeText,
        options: { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
      })
    ).rejects.toThrow(/deserialization/i);
  });

  it('offloads > 500-row CSV cell detection to Web Worker', async () => {
    const postedTypes: string[] = [];
    const terminateSpy = vi.fn();

    class CsvMockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessageerror: (() => void) | null = null;
      postMessage(payload: { type: string }) {
        postedTypes.push(payload.type);
        queueMicrotask(() => {
          const summary: DetectionSummary = {
            entities: [],
            countsByCategory: {
              EMAIL: 0,
              PHONE: 0,
              IP_ADDRESS: 0,
              PAN: 0,
              AADHAAR: 0,
              CREDIT_CARD: 0,
            },
            totalDetected: 0,
            durationMs: 6.1,
            usedWorker: true,
          };
          this.onmessage?.({
            data: { type: 'RESULT', summary },
          } as MessageEvent);
        });
      }
      terminate = terminateSpy;
    }

    globalThis.Worker = CsvMockWorker as unknown as typeof Worker;

    const rows: string[][] = [['id', 'email']];
    for (let i = 1; i <= LIMITS.WORKER_CSV_ROW_THRESHOLD + 10; i += 1) {
      rows.push([String(i), `user${i}@example.com`]);
    }

    const csvDoc: ParsedCsvDocument = {
      fileName: 'large.csv',
      fileSizeBytes: 1024,
      delimiter: ',',
      linebreak: '\n',
      hasHeader: true,
      headers: ['id', 'email'],
      rows,
    };

    const result = await detectCsvAsync({
      csvDoc,
      options: { enabledCategories: DEFAULT_ENABLED_CATEGORIES },
    });

    expect(postedTypes).toEqual(['DETECT_CSV']);
    expect(result.usedWorker).toBe(true);
    expect(terminateSpy).toHaveBeenCalledTimes(1);
  });
});
