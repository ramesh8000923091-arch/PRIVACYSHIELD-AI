import { PII_CATEGORIES } from '@/constants';
import {
  canonicalizeIpAddress,
  normalizeIndianPhone,
  stripCardSeparators,
} from '@/services/detection';
import type { PIIType } from '@/types';

export function normalizeEntityValue(type: PIIType, rawValue: string): string {
  switch (type) {
    case 'EMAIL':
      return rawValue.trim().toLowerCase();
    case 'PHONE':
      return normalizeIndianPhone(rawValue);
    case 'IP_ADDRESS':
      return canonicalizeIpAddress(rawValue);
    case 'PAN':
      return rawValue.trim().toUpperCase();
    case 'AADHAAR':
      return rawValue.replace(/[\s\u00A0\u2013-]+/g, '');
    case 'CREDIT_CARD':
      return stripCardSeparators(rawValue);
  }
}

export interface RestoreResult {
  restoredText: string;
  restoredCount: number;
}

const TOKEN_PATTERN = /\b(?:USER|PHONE|IP|PAN|AADHAAR|CARD)_\d{2,}\b/g;

/**
 * Volatile RAM-only Consistent Pseudonymizer.
 *
 * - Maps normalized entities deterministically to category-prefixed tokens (e.g. USER_01, PHONE_01).
 * - Maintains an in-memory reverse map so users can locally re-hydrate AI responses containing
 *   placeholders (e.g. from ChatGPT/Claude/Gemini) without ever sending raw PII to an LLM.
 * - Never persists mappings to browser storage or external servers.
 */
export class PseudonymMapper {
  private readonly valueToToken = new Map<string, string>();
  private readonly tokenToOriginal = new Map<string, string>();
  private readonly counters: Record<PIIType, number> = {
    EMAIL: 0,
    PHONE: 0,
    IP_ADDRESS: 0,
    PAN: 0,
    AADHAAR: 0,
    CREDIT_CARD: 0,
  };

  getOrCreateToken(type: PIIType, rawValue: string): string {
    const normalized = normalizeEntityValue(type, rawValue);
    const mapKey = `${type}:${normalized}`;

    const existing = this.valueToToken.get(mapKey);
    if (existing) {
      return existing;
    }

    this.counters[type] += 1;
    const prefix = PII_CATEGORIES[type].pseudonymPrefix;
    const suffix = String(this.counters[type]).padStart(2, '0');
    const token = `${prefix}_${suffix}`;

    this.valueToToken.set(mapKey, token);
    this.tokenToOriginal.set(token, rawValue);
    return token;
  }

  /**
   * Locally restores pseudonym tokens (USER_01, PHONE_01, etc.) inside an AI reply or
   * downstream sanitized text using the active volatile RAM mapping table.
   */
  restoreText(pseudonymizedText: string): RestoreResult {
    if (!pseudonymizedText || this.tokenToOriginal.size === 0) {
      return { restoredText: pseudonymizedText, restoredCount: 0 };
    }

    let restoredCount = 0;
    const restoredText = pseudonymizedText.replace(TOKEN_PATTERN, (token) => {
      const original = this.tokenToOriginal.get(token);
      if (original !== undefined) {
        restoredCount += 1;
        return original;
      }
      return token;
    });

    return { restoredText, restoredCount };
  }

  getTotalMappings(): number {
    return this.valueToToken.size;
  }

  getCountsByCategory(): Record<PIIType, number> {
    return { ...this.counters };
  }

  reset(): void {
    this.valueToToken.clear();
    this.tokenToOriginal.clear();
    this.counters.EMAIL = 0;
    this.counters.PHONE = 0;
    this.counters.IP_ADDRESS = 0;
    this.counters.PAN = 0;
    this.counters.AADHAAR = 0;
    this.counters.CREDIT_CARD = 0;
  }
}
