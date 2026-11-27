import type { DetectedEntity } from '@/types';

/**
 * Detects Indian mobile number formats:
 * - +91 9876543210, +91-98765-43210, +91 98765 43210, +919876543210
 * - 91 9876543210, 91-9876543210
 * - 09876543210, 0 98765 43210
 * - 9876543210, 98765 43210, 98765-43210, 987-654-3210
 *
 * Avoids matching substrings inside longer numeric sequences, credit cards, Aadhaar, or IP addresses.
 */
const INDIAN_PHONE_REGEX =
  /(?<![\d.+A-Za-z])((?:\+91[ -]?|91[ -]|0[ -]?)?(?:[6-9]\d{9}|[6-9]\d{4}[ -]\d{5}|[6-9]\d{2}[ -]\d{3}[ -]\d{4}|[6-9]\d{3}[ -]\d{3}[ -]\d{3}))(?![\dA-Za-z])/g;

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

function isValidIndianMobile(raw: string): boolean {
  const canonical = normalizeIndianPhone(raw);
  if (!/^[6-9]\d{9}$/.test(canonical)) {
    return false;
  }
  // Reject 10 identical digits (e.g. 9999999999)
  if (/^(\d)\1{9}$/.test(canonical)) {
    return false;
  }
  return true;
}

export function detectPhones(text: string): DetectedEntity[] {
  if (!text) {
    return [];
  }

  const results: DetectedEntity[] = [];
  INDIAN_PHONE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INDIAN_PHONE_REGEX.exec(text)) !== null) {
    const value = match[1];
    const start = match.index;
    const end = start + value.length;

    // Avoid matching a 10-digit substring preceded/followed by hyphen+digit (e.g., part of card/ID)
    const prevTwo = text.slice(Math.max(0, start - 2), start);
    const nextTwo = text.slice(end, end + 2);
    if (/\d-$/.test(prevTwo) || /^-\d/.test(nextTwo)) {
      continue;
    }

    if (!isValidIndianMobile(value)) {
      continue;
    }

    const hasPrefix = value.startsWith('+91') || value.startsWith('91') || value.startsWith('0');

    results.push({
      id: `PHONE-${start}-${end}`,
      type: 'PHONE',
      value,
      start,
      end,
      confidence: hasPrefix ? 0.96 : 0.9,
      validationMethod: 'INDIAN_MOBILE_RULE',
    });
  }

  return results;
}
