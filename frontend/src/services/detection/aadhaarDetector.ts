import type { DetectedEntity } from '@/types';
import { isValidVerhoeff } from './verhoeffValidator';

/**
 * Detects 12-digit Aadhaar-like numbers starting with [2-9], supporting:
 * - 2345 6789 0124 (spaces, tabs, NBSP, or en-dash/hyphen)
 * - 2345-6789-0124
 * - 234567890124
 *
 * Enforces leading-digit [2-9] rule + Verhoeff checksum + strict numeric boundary checks.
 * Clearly distinguishes mathematical checksum validation from UIDAI verification.
 */
const AADHAAR_CANDIDATE_REGEX =
  /(?<![\dA-Za-z_])([2-9]\d{3}(?:[ \t\u00A0]+|[\u2013-])\d{4}(?:[ \t\u00A0]+|[\u2013-])\d{4}|[2-9]\d{11})(?![\dA-Za-z_])/g;

const AADHAAR_CONTEXT_REGEX = /\b(aadhaar|aadhar|uid|uidai|kyc|identity)\b/i;

export function isValidAadhaarFormat(rawValue: string): boolean {
  const digits = rawValue.replace(/[\s\u00A0\u2013-]+/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) {
    return false;
  }

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

    const isFormatted = /[ \t\u00A0\u2013-]/.test(value);

    // Narrowly guard against 4-digit card blocks (e.g. 4111-XXXX-XXXX-XXXX) without blocking "User 1 2345..."
    if (isFormatted) {
      const prevContext = text.slice(Math.max(0, start - 6), start);
      const nextContext = text.slice(end, Math.min(text.length, end + 6));
      if (/(?:^|[^\d])\d{4}[ \u00A0\u2013-]$/.test(prevContext)) {
        continue;
      }
      if (/^[ \u00A0\u2013-]\d{4}(?:[^\d]|$)/.test(nextContext) && value.includes('-')) {
        continue;
      }
    }

    if (!isValidAadhaarFormat(value)) {
      continue;
    }

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
