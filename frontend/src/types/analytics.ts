import type { PIIType } from './detection';

export interface DetectionAnalytics {
  totalDetected: number;
  totalRedacted: number;
  totalExcluded: number;
  countsByCategory: Record<PIIType, number>;
  originalCharCount: number;
  sanitizedCharCount: number;
  originalWordCount: number;
  sanitizedWordCount: number;
  processingTimeMs: number;
  usedWorker: boolean;
  isSanitized: boolean;
}
