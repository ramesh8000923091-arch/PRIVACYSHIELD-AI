import type { DetectedEntity } from '@/types';
import { isValidLuhn, stripCardSeparators } from './luhnValidator';

/**
 * Detects 13–19 digit payment card candidates (contiguous, space-, or hyphen-delimited)
 * and accepts ONLY candidates that pass strict Luhn mod-10 validation.
 * Handles cards followed by space + CVV/expiry digits by validating prefix groups cleanly.
 * Never logs or persists detected card numbers.
 */
const CREDIT_CARD_CANDIDATE_REGEX = /(?<![\dA-Za-z])([1-9](?:[\d][ -]?){12,18})(?![\dA-Za-z])/g;

function hasConsistentCardSeparators(rawValue: string): boolean {
  const trimmed = rawValue.trim();
  if (trimmed !== rawValue) {
    return false;
  }
  if (/[ -]{2,}/.test(trimmed) || /^[ -]|[ -]$/.test(trimmed)) {
    return false;
  }
  const hasSpaces = trimmed.includes(' ');
  const hasHyphens = trimmed.includes('-');
  if (hasSpaces && hasHyphens) {
    return false;
  }
  // Delimited cards use short digit groups (e.g. 4-4-4-4 or 4-6-5), never a 13+ digit card + space + CVV
  if (hasSpaces || hasHyphens) {
    const groups = trimmed.split(hasSpaces ? ' ' : '-');
    if (groups.some((group) => group.length > 6)) {
      return false;
    }
  }
  return true;
}

/**
 * If a space-separated candidate greedily absorbed trailing CVV or expiry digits
 * (e.g. "4111 1111 1111 1111 123" or "3782 822463 10005 123"), trims trailing
 * short space-separated groups to recover the valid Luhn card span.
 */
function resolveValidCardSpan(rawMatch: string): string | null {
  let candidate = rawMatch.replace(/[ -]+$/, '');

  if (hasConsistentCardSeparators(candidate)) {
    const digits = stripCardSeparators(candidate);
    if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
      return candidate;
    }
  }

  // Only attempt trailing group trim on space-delimited spans (CVV / expiry after space)
  if (!candidate.includes(' ')) {
    return null;
  }

  const parts = candidate.split(' ');
  while (parts.length > 1) {
    const popped = parts.pop();
    // Only strip plausible trailing short numeric tokens (2–4 digits like CVV / month / year)
    if (!popped || popped.length > 4) {
      break;
    }
    candidate = parts.join(' ');
    if (!hasConsistentCardSeparators(candidate)) {
      continue;
    }
    const digits = stripCardSeparators(candidate);
    if (digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits)) {
      return candidate;
    }
  }

  return null;
}

export function detectCreditCards(text: string): DetectedEntity[] {
  if (!text || text.length < 13) {
    return [];
  }

  const results: DetectedEntity[] = [];
  CREDIT_CARD_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CREDIT_CARD_CANDIDATE_REGEX.exec(text)) !== null) {
    const resolved = resolveValidCardSpan(match[1]);
    if (!resolved) {
      continue;
    }

    const start = match.index;
    const end = start + resolved.length;

    results.push({
      id: `CREDIT_CARD-${start}-${end}`,
      type: 'CREDIT_CARD',
      value: resolved,
      start,
      end,
      confidence: 0.98,
      validationMethod: 'LUHN_CHECKSUM',
    });
  }

  return results;
}
