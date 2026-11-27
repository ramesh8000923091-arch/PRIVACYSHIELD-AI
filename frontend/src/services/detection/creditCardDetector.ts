import type { DetectedEntity } from '@/types';
import { isValidLuhn, stripCardSeparators } from './luhnValidator';

/**
 * Detects 13–19 digit payment card candidates (contiguous, space-, or hyphen-delimited)
 * and accepts ONLY candidates that pass strict Luhn mod-10 validation.
 * Never logs or persists detected card numbers.
 */
const CREDIT_CARD_CANDIDATE_REGEX = /(?<![\dA-Za-z])([1-9](?:[\d][ -]?){12,18})(?![\dA-Za-z])/g;

function hasConsistentCardSeparators(rawValue: string): boolean {
  const trimmed = rawValue.trim();
  if (trimmed !== rawValue) {
    return false;
  }
  // Reject double separators like "4111--1111" or mixed leading/trailing separators
  if (/[ -]{2,}/.test(trimmed) || /^[ -]|[ -]$/.test(trimmed)) {
    return false;
  }
  const hasSpaces = trimmed.includes(' ');
  const hasHyphens = trimmed.includes('-');
  // Do not match noisy numbers mixing spaces and hyphens arbitrarily
  if (hasSpaces && hasHyphens) {
    return false;
  }
  return true;
}

export function detectCreditCards(text: string): DetectedEntity[] {
  if (!text || text.length < 13) {
    return [];
  }

  const results: DetectedEntity[] = [];
  CREDIT_CARD_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CREDIT_CARD_CANDIDATE_REGEX.exec(text)) !== null) {
    const value = match[1].replace(/[\s-]+$/, '');
    const start = match.index;
    const end = start + value.length;

    if (!hasConsistentCardSeparators(value)) {
      continue;
    }

    const digits = stripCardSeparators(value);
    if (digits.length < 13 || digits.length > 19) {
      continue;
    }

    if (!isValidLuhn(digits)) {
      continue;
    }

    results.push({
      id: `CREDIT_CARD-${start}-${end}`,
      type: 'CREDIT_CARD',
      value,
      start,
      end,
      confidence: 0.98,
      validationMethod: 'LUHN_CHECKSUM',
    });
  }

  return results;
}
