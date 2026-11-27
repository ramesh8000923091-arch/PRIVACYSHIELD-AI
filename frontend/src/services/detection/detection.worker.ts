/// <reference lib="webworker" />

import type { DetectionOptions } from '@/types';
import { detectCsvCells, detectPII } from './detectionEngine';

type WorkerRequest =
  | { type?: 'DETECT_TEXT'; text: string; options: DetectionOptions }
  | { type: 'DETECT_CSV'; rows: string[][]; headers: string[]; options: DetectionOptions };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const payload = event.data;

    if (payload.type === 'DETECT_CSV') {
      const summary = detectCsvCells(payload.rows, payload.headers, payload.options, (percent) => {
        self.postMessage({ type: 'PROGRESS', percent });
      });
      self.postMessage({
        type: 'RESULT',
        summary: { ...summary, usedWorker: true },
      });
      return;
    }

    const { text, options } = payload;
    self.postMessage({ type: 'PROGRESS', percent: 35 });
    const summary = detectPII(text, options);
    self.postMessage({ type: 'PROGRESS', percent: 90 });
    self.postMessage({
      type: 'RESULT',
      summary: { ...summary, usedWorker: true },
    });
  } catch {
    self.postMessage({
      type: 'ERROR',
      message: 'Failed to process document inside background worker.',
    });
  }
};
