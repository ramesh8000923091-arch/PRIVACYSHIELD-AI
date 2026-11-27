import {
  expandIPv6,
  isValidIPv4,
  normalizeIndianPhone,
  stripCardSeparators,
} from '@/services/detection';
import type { PIIType } from '@/types';

function maskEmailPartial(value: string): string {
  const atIndex = value.indexOf('@');
  if (atIndex <= 0) {
    return '[REDACTED_EMAIL]';
  }
  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  if (local.length === 1) {
    return `*@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  }

  const visiblePrefix = local.slice(0, 2);
  const maskedStars = '*'.repeat(Math.min(Math.max(2, local.length - 2), 4));
  return `${visiblePrefix}${maskedStars}@${domain}`;
}

function maskPhonePartial(value: string): string {
  const canonical = normalizeIndianPhone(value);
  if (canonical.length < 4) {
    return 'XXXXXXXXXX';
  }
  const last4 = canonical.slice(-4);
  return `XXXXXX${last4}`;
}

function maskPanPartial(value: string): string {
  const upper = value.trim().toUpperCase();
  if (upper.length !== 10) {
    return 'XXXXXXXXXX';
  }
  return `XXXXX${upper.slice(5, 9)}X`;
}

function maskAadhaarPartial(value: string): string {
  const digits = value.replace(/[\s\u00A0\u2013-]+/g, '');
  if (digits.length !== 12) {
    return 'XXXX XXXX XXXX';
  }
  const last4 = digits.slice(-4);
  const separator = value.includes('-') ? '-' : ' ';
  return `XXXX${separator}XXXX${separator}${last4}`;
}

function maskCreditCardPartial(value: string): string {
  const digits = stripCardSeparators(value);
  if (digits.length < 4) {
    return 'XXXX-XXXX-XXXX-XXXX';
  }
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-XXXX-${last4}`;
}

/**
 * Partial IP masking policy:
 * - IPv4: preserves /16 prefix (first 2 octets) and masks host octets -> A.B.xxx.xxx
 * - IPv6: expands all 8 RFC 4291 hextets, preserves first 2 hextets, masks host/interface bits
 */
function maskIpPartial(value: string): string {
  const trimmed = value.trim();
  if (isValidIPv4(trimmed)) {
    const octets = trimmed.split('.');
    return `${octets[0]}.${octets[1]}.xxx.xxx`;
  }
  const expanded = expandIPv6(trimmed);
  if (!expanded) {
    return '[REDACTED_IP_ADDRESS]';
  }
  return `${expanded[0]}:${expanded[1]}:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`;
}

export function applyPartialMask(type: PIIType, value: string): string {
  switch (type) {
    case 'EMAIL':
      return maskEmailPartial(value);
    case 'PHONE':
      return maskPhonePartial(value);
    case 'IP_ADDRESS':
      return maskIpPartial(value);
    case 'PAN':
      return maskPanPartial(value);
    case 'AADHAAR':
      return maskAadhaarPartial(value);
    case 'CREDIT_CARD':
      return maskCreditCardPartial(value);
  }
}
