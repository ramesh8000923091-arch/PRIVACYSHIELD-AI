import type { DetectedEntity } from '@/types';

/**
 * Detects Indian mobile number formats:
 * - +91 9876543210, (+91) 9876543210, +91-98765-43210, +91 98765 43210, +919876543210
 * - 91 9876543210, 91-9876543210, 919876543210
 * - 09876543210, 0 98765 43210
 * - 9876543210, 98765 43210, 98765-43210, 9876-543210, 987-654-3210 (including NBSP & en-dash)
 *
 * Avoids matching substrings inside longer numeric sequences, decimals, underscore IDs, or IP addresses.
 */
const INDIAN_PHONE_REGEX =
  /(?<![\d+A-Za-z_])((?:\(\+91\)[ \u00A0\u2013-]?|\+91[ \u00A0\u2013-]?|91[ \u00A0\u2013-]|91(?=[6-9]\d{9}(?![\dA-Za-z_]))|0[ \u00A0\u2013-]?)?(?:[6-9]\d{9}|[6-9]\d{4}[ \u00A0\u2013-]\d{5}|[6-9]\d{3}[ \u00A0\u2013-]\d{6}|[6-9]\d{2}[ \u00A0\u2013-]\d{3}[ \u00A0\u2013-]\d{4}|[6-9]\d{3}[ \u00A0\u2013-]\d{3}[ \u00A0\u2013-]\d{3}))(?![\dA-Za-z_]|\.\d)/g;

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

    // Avoid matching decimals like 12.9876543210, while permitting "Ph.+91 9876543210" & "No.9876543210"
    const prevTwo = text.slice(Math.max(0, start - 2), start);
    const nextTwo = text.slice(end, end + 2);
    if (/\d\.$/.test(prevTwo)) {
      continue;
    }

    // Avoid matching a bare 10-digit substring adjacent to hyphen/space + digit (e.g., card or long numeric ID)
    const hasExplicitPrefix =
      value.startsWith('+91') ||
      value.startsWith('(+91)') ||
      value.startsWith('0') ||
      /^91[ \u00A0\u2013-]/.test(value) ||
      /^91\d{10}$/.test(value);

    if (/\d-$/.test(prevTwo) || /^-\d/.test(nextTwo)) {
      continue;
    }
    if (!hasExplicitPrefix && (/\d $/.test(prevTwo) || /^ \d/.test(nextTwo))) {
      // Allow single digit label before phone only when preceded by word (e.g. "Line 1 9876543210"),
      // reject 4+ digit numeric chunks (e.g. "1234 9876543210")
      const prevSix = text.slice(Math.max(0, start - 6), start);
      if (/\d{2,}[ \u00A0]$/.test(prevSix)) {
        continue;
      }
    }

    if (!isValidIndianMobile(value)) {
      continue;
    }

    results.push({
      id: `PHONE-${start}-${end}`,
      type: 'PHONE',
      value,
      start,
      end,
      confidence: hasExplicitPrefix ? 0.96 : 0.9,
      validationMethod: 'INDIAN_MOBILE_RULE',
    });
  }

  return results;
}
