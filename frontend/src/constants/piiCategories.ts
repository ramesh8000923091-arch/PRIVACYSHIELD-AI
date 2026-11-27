import type { PIIType } from '@/types';

export interface PIICategoryMeta {
  type: PIIType;
  label: string;
  shortLabel: string;
  description: string;
  validationLabel: string;
  fullMaskToken: string;
  pseudonymPrefix: string;
  priority: number;
  colorVar: {
    fg: string;
    bg: string;
    border: string;
  };
  chartHex: string;
}

export const PII_CATEGORIES: Record<PIIType, PIICategoryMeta> = {
  CREDIT_CARD: {
    type: 'CREDIT_CARD',
    label: 'Credit Card',
    shortLabel: 'Card',
    description: '13–19 digit payment card numbers validated with the Luhn mod-10 checksum.',
    validationLabel: 'Luhn Checksum Verified',
    fullMaskToken: '[REDACTED_CREDIT_CARD]',
    pseudonymPrefix: 'CARD',
    priority: 6,
    colorVar: {
      fg: 'var(--pii-card-fg)',
      bg: 'var(--pii-card-bg)',
      border: 'var(--pii-card-border)',
    },
    chartHex: '#ef4444',
  },
  AADHAAR: {
    type: 'AADHAAR',
    label: 'Aadhaar',
    shortLabel: 'Aadhaar',
    description:
      '12-digit Aadhaar-like numbers starting with 2–9 validated using the Verhoeff checksum (not UIDAI verified).',
    validationLabel: 'Format & Verhoeff Checksum (Not UIDAI Verified)',
    fullMaskToken: '[REDACTED_AADHAAR]',
    pseudonymPrefix: 'AADHAAR',
    priority: 5,
    colorVar: {
      fg: 'var(--pii-aadhaar-fg)',
      bg: 'var(--pii-aadhaar-bg)',
      border: 'var(--pii-aadhaar-border)',
    },
    chartHex: '#ec4899',
  },
  EMAIL: {
    type: 'EMAIL',
    label: 'Email Address',
    shortLabel: 'Email',
    description: 'Standard email address patterns across text, logs, and structured tables.',
    validationLabel: 'Email Pattern Match',
    fullMaskToken: '[REDACTED_EMAIL]',
    pseudonymPrefix: 'USER',
    priority: 4,
    colorVar: {
      fg: 'var(--pii-email-fg)',
      bg: 'var(--pii-email-bg)',
      border: 'var(--pii-email-border)',
    },
    chartHex: '#3b82f6',
  },
  IP_ADDRESS: {
    type: 'IP_ADDRESS',
    label: 'IP Address',
    shortLabel: 'IP',
    description: 'Structurally validated IPv4 (0–255 octets) and RFC 4291 IPv6 network addresses.',
    validationLabel: 'IPv4/IPv6 Structure Check',
    fullMaskToken: '[REDACTED_IP_ADDRESS]',
    pseudonymPrefix: 'IP',
    priority: 3,
    colorVar: {
      fg: 'var(--pii-ip-fg)',
      bg: 'var(--pii-ip-bg)',
      border: 'var(--pii-ip-border)',
    },
    chartHex: '#06b6d4',
  },
  PAN: {
    type: 'PAN',
    label: 'Indian PAN',
    shortLabel: 'PAN',
    description:
      '10-character PAN format validating entity code and name initial (structural check only, not government verified).',
    validationLabel: 'PAN Structure Check (Not Govt. Verified)',
    fullMaskToken: '[REDACTED_PAN]',
    pseudonymPrefix: 'PAN',
    priority: 2,
    colorVar: {
      fg: 'var(--pii-pan-fg)',
      bg: 'var(--pii-pan-bg)',
      border: 'var(--pii-pan-border)',
    },
    chartHex: '#f97316',
  },
  PHONE: {
    type: 'PHONE',
    label: 'Phone Number',
    shortLabel: 'Phone',
    description:
      'Indian mobile number formats (+91, 0, or 10-digit [6–9] spaced/hyphenated variants).',
    validationLabel: 'Indian Mobile Format Check',
    fullMaskToken: '[REDACTED_PHONE]',
    pseudonymPrefix: 'PHONE',
    priority: 1,
    colorVar: {
      fg: 'var(--pii-phone-fg)',
      bg: 'var(--pii-phone-bg)',
      border: 'var(--pii-phone-border)',
    },
    chartHex: '#a855f7',
  },
};

export const PII_CATEGORY_LIST: readonly PIICategoryMeta[] = [
  PII_CATEGORIES.EMAIL,
  PII_CATEGORIES.PHONE,
  PII_CATEGORIES.IP_ADDRESS,
  PII_CATEGORIES.PAN,
  PII_CATEGORIES.AADHAAR,
  PII_CATEGORIES.CREDIT_CARD,
];

export const DEFAULT_ENABLED_CATEGORIES: Record<PIIType, boolean> = {
  EMAIL: true,
  PHONE: true,
  IP_ADDRESS: true,
  PAN: true,
  AADHAAR: true,
  CREDIT_CARD: true,
};
