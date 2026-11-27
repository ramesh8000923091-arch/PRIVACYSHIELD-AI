/**
 * Pure Verhoeff checksum implementation for 12-digit Aadhaar-like format validation.
 * Note: Performs mathematical checksum validation only — NEVER UIDAI verification.
 */

const MULTIPLICATION_TABLE: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const PERMUTATION_TABLE: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const INVERSE_TABLE: readonly number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function isValidVerhoeff(rawDigits: string): boolean {
  const digits = rawDigits.replace(/[\s-]+/g, '');
  if (!/^\d+$/.test(digits) || digits.length < 2) {
    return false;
  }

  let c = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const digit = digits.charCodeAt(digits.length - 1 - i) - 48;
    c = MULTIPLICATION_TABLE[c][PERMUTATION_TABLE[i % 8][digit]];
  }

  return c === 0;
}

export function computeVerhoeffCheckDigit(partialDigits: string): string {
  const digits = partialDigits.replace(/[\s-]+/g, '');
  if (!/^\d+$/.test(digits)) {
    throw new Error('Verhoeff input must contain digits only.');
  }

  let c = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const digit = digits.charCodeAt(digits.length - 1 - i) - 48;
    c = MULTIPLICATION_TABLE[c][PERMUTATION_TABLE[(i + 1) % 8][digit]];
  }

  return String(INVERSE_TABLE[c]);
}
