import { applyPartialMask } from '@/services/redaction';
import type { PIIType } from '@/types';

/**
 * Generates a safe preview of a detected entity for inspector panels
 * so complete sensitive values are never unnecessarily exposed in sidebars.
 */
export function formatSafeEntityPreview(type: PIIType, value: string): string {
  return applyPartialMask(type, value);
}
