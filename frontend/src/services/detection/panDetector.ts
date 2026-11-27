import type { DetectedEntity } from '@/types';

/**
 * Indian Permanent Account Number (PAN) structural validator.
 *
 * Structure: [A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]
 * - Chars 1–3: Alphabetic series (AAA–ZZZ)
 * - Char 4: Holder/entity status code (A, B, C, F, G, H, J, L, P, T)
 * - Char 5: Holder name/surname initial (A–Z)
 * - Chars 6–9: 4 sequential digits (0001–9999)
 * - Char 10: Alphabetic check character (A–Z)
 *
 * Note: Performs structural format validation only — NEVER government database verification.
 */
const VALID_PAN_ENTITY_CODES = new Set(['A', 'B', 'C', 'F', 'G', 'H', 'J', 'L', 'P', 'T']);
const PAN_CANDIDATE_REGEX = /(?<![A-Za-z0-9])([A-Z]{3}[A-Z][A-Z][0-9]{4}[A-Z])(?![A-Za-z0-9])/g;

export function isValidPanStructure(candidate: string): boolean {
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(candidate)) {
    return false;
  }

  const entityCode = candidate.charAt(3);
  if (!VALID_PAN_ENTITY_CODES.has(entityCode)) {
    return false;
  }

  const nameInitial = candidate.charAt(4);
  if (nameInitial < 'A' || nameInitial > 'Z') {
    return false;
  }

  const numericCore = candidate.slice(5, 9);
  if (numericCore === '0000') {
    return false;
  }

  return true;
}

export function detectPans(text: string): DetectedEntity[] {
  if (!text || text.length < 10) {
    return [];
  }

  const results: DetectedEntity[] = [];
  PAN_CANDIDATE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PAN_CANDIDATE_REGEX.exec(text)) !== null) {
    const value = match[1];
    if (!isValidPanStructure(value)) {
      continue;
    }

    const start = match.index;
    const end = start + value.length;

    results.push({
      id: `PAN-${start}-${end}`,
      type: 'PAN',
      value,
      start,
      end,
      confidence: 0.94,
      validationMethod: 'PAN_STRUCTURE_CHECK',
    });
  }

  return results;
}
