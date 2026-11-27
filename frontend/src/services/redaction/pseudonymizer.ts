import { PII_CATEGORIES } from '@/constants';
import { normalizeIndianPhone, stripCardSeparators } from '@/services/detection';
import type { PIIType } from '@/types';

export function normalizeEntityValue(type: PIIType, rawValue: string): string {
  switch (type) {
    case 'EMAIL':
      return rawValue.trim().toLowerCase();
    case 'PHONE':
      return normalizeIndianPhone(rawValue);
    case 'IP_ADDRESS':
      return rawValue.trim().toLowerCase();
    case 'PAN':
      return rawValue.trim().toUpperCase();
    case 'AADHAAR':
      return rawValue.replace(/[\s-]+/g, '');
    case 'CREDIT_CARD':
      return stripCardSeparators(rawValue);
  }
}

/**
 * Volatile RAM-only Consistent Pseudonymizer.
 *
 * - Maps normalized entities deterministically to category-prefixed tokens (e.g. USER_01, PHONE_01).
 * - Never persists mappings to browser storage or external servers.
 * - Exposes explicit reset() lifecycle control.
 */
export class PseudonymMapper {
  private readonly valueToToken = new Map<string, string>();
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
    return token;
  }

  getTotalMappings(): number {
    return this.valueToToken.size;
  }

  getCountsByCategory(): Record<PIIType, number> {
    return { ...this.counters };
  }

  reset(): void {
    this.valueToToken.clear();
    this.counters.EMAIL = 0;
    this.counters.PHONE = 0;
    this.counters.IP_ADDRESS = 0;
    this.counters.PAN = 0;
    this.counters.AADHAAR = 0;
    this.counters.CREDIT_CARD = 0;
  }
}
