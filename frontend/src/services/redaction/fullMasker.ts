import { PII_CATEGORIES } from '@/constants';
import type { FullMaskVariant, PIIType } from '@/types';

export function applyFullMask(type: PIIType, variant: FullMaskVariant = 'CATEGORY_TAG'): string {
  if (variant === 'GENERIC') {
    return '[REDACTED]';
  }
  return PII_CATEGORIES[type].fullMaskToken;
}
