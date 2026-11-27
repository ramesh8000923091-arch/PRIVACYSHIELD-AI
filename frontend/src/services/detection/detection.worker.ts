/// <reference lib="webworker" />

import type { DetectionOptions } from '@/types';
import { detectPII } from './detectionEngine';

interface WorkerRequest {
  text: string;
  options: DetectionOptions;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const { text, options } = event.data;
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
