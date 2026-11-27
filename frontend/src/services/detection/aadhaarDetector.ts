import type { DetectedEntity } from '@/types';
import { isValidVerhoeff } from './verhoeffValidator';

/**
 * Detects 12-digit Aadhaar-like numbers starting with [2-9], supporting:
 * - 2345 6789 0128
 * - 2345-6789-0128
 * - 234567890128
 *
 * Enforces leading-digit [2-9] rule + Verhoeff checksum + strict numeric boundary checks.
 * Clearly distinguishes mathematical checksum validation from UIDAI verification.
 */
const AADHAAR_CANDIDATE_REGEX =
  /(?<![\dA-Za-z])([2-9]\d{3}[ -]\d{4}[ -]\d{4}|[2-9]\d{11})(?![\dA-Za-z])/g;

const AADHAAR_CONTEXT_REGEX = /\b(aadhaar|aadhar|uid|uidai|kyc|identity)\b/i;

export function isValidAadhaarFormat(rawValue: string): boolean {
  const digits = rawValue.replace(/[\s-]+/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) {
    return false;
  }

  // Reject degenerate all-same-digit sequences
  if (/^(\d)\1{11}$/.test(digits)) {
    return false;
  }

  return isValidVerhoeff(digits);
}

export function detectAadhaar(text: string): DetectedEntity[] {
  if (!text || text.length < 12) {
    return [];
  }

  const results: DetectedEntity[] = [];
  AADHAAR_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = AADHAAR_CANDIDATE_REGEX.exec(text)) !== null) {
    const value = match[1];
    const start = match.index;
    const end = start + value.length;

    // Guard against substrings of 16-digit hyphenated/spaced cards
    const prevContext = text.slice(Math.max(0, start - 5), start);
    const nextContext = text.slice(end, Math.min(text.length, end + 5));
    if (/\d[ -]$/.test(prevContext) || /^[ -]\d/.test(nextContext)) {
      continue;
    }

    if (!isValidAadhaarFormat(value)) {
      continue;
    }

    const isFormatted = /[\s-]/.test(value);
    const nearbyWindow = text.slice(Math.max(0, start - 32), Math.min(text.length, end + 16));
    const hasKeywordContext = AADHAAR_CONTEXT_REGEX.test(nearbyWindow);

    const confidence = isFormatted || hasKeywordContext ? 0.96 : 0.88;

    results.push({
      id: `AADHAAR-${start}-${end}`,
      type: 'AADHAAR',
      value,
      start,
      end,
      confidence,
      validationMethod: 'VERHOEFF_CHECKSUM',
    });
  }

  return results;
}
