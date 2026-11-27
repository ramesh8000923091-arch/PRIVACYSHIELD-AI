/// <reference lib="webworker" />

import type { DetectedEntity, DetectionOptions } from '@/types';
import { countEntitiesByCategory, detectPII } from './detectionEngine';

type WorkerRequest =
  | { type?: 'DETECT_TEXT'; text: string; options: DetectionOptions }
  | { type: 'DETECT_CSV'; rows: string[][]; headers: string[]; options: DetectionOptions };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const payload = event.data;

    if (payload.type === 'DETECT_CSV') {
      const startedAt = performance.now();
      const { rows, headers, options } = payload;
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

        if (rowIndex > 0 && rowIndex % 100 === 0) {
          const pct = Math.min(92, Math.round(20 + (rowIndex / totalRows) * 72));
          self.postMessage({ type: 'PROGRESS', percent: pct });
        }
      }

      const durationMs = Math.max(0, Number((performance.now() - startedAt).toFixed(2)));
      self.postMessage({
        type: 'RESULT',
        summary: {
          entities: allEntities,
          countsByCategory: countEntitiesByCategory(allEntities),
          totalDetected: allEntities.length,
          durationMs,
          usedWorker: true,
        },
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
