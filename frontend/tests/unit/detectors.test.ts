import { describe, expect, it } from 'vitest';
import { SAMPLE_DOCUMENT_TEXT, SYNTHETIC_AADHAAR_1, SYNTHETIC_AADHAAR_2 } from '@/constants';
import {
  computeVerhoeffCheckDigit,
  detectAadhaar,
  detectCreditCards,
  detectEmails,
  detectIpAddresses,
  detectPans,
  detectPhones,
  detectPII,
  isValidIPv4,
  isValidIPv6,
  isValidLuhn,
  isValidPanStructure,
  isValidVerhoeff,
  resolveOverlaps,
} from '@/services/detection';

describe('Phase 5 — Modular PII Detection Engine', () => {
  describe('Email Detector', () => {
    it('detects standard and subdomain email addresses accurately', () => {
      const text = 'Reach anuj@example.com or sec.ops+alerts@sub.domain.co.in today.';
      const found = detectEmails(text);
      expect(found.map((e) => e.value)).toEqual([
        'anuj@example.com',
        'sec.ops+alerts@sub.domain.co.in',
      ]);
      expect(text.slice(found[0].start, found[0].end)).toBe('anuj@example.com');
    });

    it('rejects malformed email-like strings', () => {
      const found = detectEmails(
        'bad..email@example.com @missing.com user@-bad.com user@localhost'
      );
      expect(found).toHaveLength(0);
    });
  });

  describe('Indian Phone Detector', () => {
    it('detects +91, 0-prefixed, bare, spaced, and hyphenated Indian mobile numbers', () => {
      const text = 'Call +91 9876543210, 09876543210, 98765-43210, or 70123 45678.';
      const found = detectPhones(text);
      expect(found.map((e) => e.value)).toEqual([
        '+91 9876543210',
        '09876543210',
        '98765-43210',
        '70123 45678',
      ]);
    });

    it('avoids matching random non-mobile numbers, invalid prefixes, or repeated digits', () => {
      const found = detectPhones(
        'Order 1234567890, code 5123456789, fake 9999999999, id 987654321099'
      );
      expect(found).toHaveLength(0);
    });
  });

  describe('IPv4 & IPv6 Detector', () => {
    it('validates IPv4 octets strictly and rejects out-of-range values', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('256.10.1.1')).toBe(false);
      expect(isValidIPv4('192.168.01.1')).toBe(false);
    });

    it('validates full, compressed, and IPv4-mapped IPv6 addresses while rejecting timestamps', () => {
      expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
      expect(isValidIPv6('2001:db8::1')).toBe(true);
      expect(isValidIPv6('::ffff:192.0.2.128')).toBe(true);
      expect(isValidIPv6('12:34:56')).toBe(false);
      expect(isValidIPv6('2001::db8::1')).toBe(false);
    });

    it('detects IPv4 and IPv6 in logs without false positives on timestamps or versions', () => {
      const log = '[12:34:56] v1.2.3.4 src=10.0.0.5 edge=2001:db8::8a2e bad=999.1.2.3';
      const found = detectIpAddresses(log);
      expect(found.map((e) => e.value)).toEqual(['10.0.0.5', '2001:db8::8a2e']);
    });

    it('detects sentence-ending IPv4 with trailing period while rejecting 5-octet strings (regression)', () => {
      const text = 'Primary host is 192.168.1.42. Invalid five-octet 192.168.1.42.5 ignored.';
      const found = detectIpAddresses(text);
      expect(found.map((e) => e.value)).toEqual(['192.168.1.42']);
    });
  });

  describe('Indian PAN Detector', () => {
    it('validates full 10-char PAN structure including 4th entity code and 5th name initial', () => {
      expect(isValidPanStructure('ABCPK1234F')).toBe(true);
      expect(isValidPanStructure('AAACA5678K')).toBe(true);
      // 4th char 'D' is not a valid PAN entity type code
      expect(isValidPanStructure('ABCDE1234F')).toBe(false);
      expect(isValidPanStructure('ABCPK0000F')).toBe(false);
    });

    it('extracts valid PANs with word boundary enforcement', () => {
      const found = detectPans('PAN: ABCPK1234F, invalid ABCDE1234F, token XABCPK1234FY');
      expect(found.map((e) => e.value)).toEqual(['ABCPK1234F']);
    });
  });

  describe('Aadhaar Detector & Verhoeff Checksum', () => {
    it('validates Verhoeff checksum accurately', () => {
      const valid12 = `23456789012${computeVerhoeffCheckDigit('23456789012')}`;
      expect(isValidVerhoeff(valid12)).toBe(true);
      const tampered = `${valid12.slice(0, 11)}${(Number(valid12[11]) + 1) % 10}`;
      expect(isValidVerhoeff(tampered)).toBe(false);
    });

    it('detects valid Aadhaar formats and rejects leading 0/1 or bad Verhoeff checksums', () => {
      const badChecksum = `${SYNTHETIC_AADHAAR_1.slice(0, -1)}${(Number(SYNTHETIC_AADHAAR_1.slice(-1)) + 1) % 10}`;
      const text = `Valid1: ${SYNTHETIC_AADHAAR_1}, Valid2: ${SYNTHETIC_AADHAAR_2}, BadPrefix: 1234 5678 9012, BadSum: ${badChecksum}`;
      const found = detectAadhaar(text);
      expect(found.map((e) => e.value)).toEqual([SYNTHETIC_AADHAAR_1, SYNTHETIC_AADHAAR_2]);
    });
  });

  describe('Credit Card Detector & Luhn Validation', () => {
    it('validates Luhn checksums and rejects invalid card numbers', () => {
      expect(isValidLuhn('4111-1111-1111-1111')).toBe(true);
      expect(isValidLuhn('5500 0000 0000 0004')).toBe(true);
      expect(isValidLuhn('378282246310005')).toBe(true);
      expect(isValidLuhn('1234-5678-9012-3456')).toBe(false);
      expect(isValidLuhn('0000000000000000')).toBe(false);
    });

    it('extracts only Luhn-valid cards from text including adjacent multiline entries (regression)', () => {
      const text = '4111-1111-1111-1111\n5500 0000 0000 0004\ninvalid 1234-5678-9012-3456';
      const found = detectCreditCards(text);
      expect(found.map((e) => e.value)).toEqual(['4111-1111-1111-1111', '5500 0000 0000 0004']);
    });

    it('handles empty input and never mutates original strings across adjacent multiline entities', () => {
      expect(detectPII('').totalDetected).toBe(0);
      const original = `a@example.com\n+91 9876543210\n${SYNTHETIC_AADHAAR_1}\nABCPK1234F`;
      const copy = String(original);
      const summary = detectPII(original);
      expect(original).toBe(copy);
      expect(summary.totalDetected).toBe(4);
      for (const ent of summary.entities) {
        expect(original.slice(ent.start, ent.end)).toBe(ent.value);
      }
    });
  });

  describe('Overlap Resolution & Integrated Sample Scan', () => {
    it('prevents overlapping detections by prioritizing CREDIT_CARD over shorter numeric spans', () => {
      const resolved = resolveOverlaps([
        {
          id: 'p1',
          type: 'PHONE',
          value: '9111111111',
          start: 6,
          end: 16,
          confidence: 0.9,
          validationMethod: 'INDIAN_MOBILE_RULE',
        },
        {
          id: 'c1',
          type: 'CREDIT_CARD',
          value: '4111119111111111',
          start: 0,
          end: 16,
          confidence: 0.98,
          validationMethod: 'LUHN_CHECKSUM',
        },
      ]);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].type).toBe('CREDIT_CARD');
    });

    it('detects all 6 PII categories accurately on SAMPLE_DOCUMENT_TEXT without false card matches', () => {
      const summary = detectPII(SAMPLE_DOCUMENT_TEXT);
      expect(summary.countsByCategory.EMAIL).toBe(3);
      expect(summary.countsByCategory.PHONE).toBe(2);
      expect(summary.countsByCategory.IP_ADDRESS).toBe(2);
      expect(summary.countsByCategory.PAN).toBe(2);
      expect(summary.countsByCategory.AADHAAR).toBe(2);
      expect(summary.countsByCategory.CREDIT_CARD).toBe(2);
      expect(summary.totalDetected).toBe(13);
      // Confirm non-Luhn test number was rejected
      expect(summary.entities.some((e) => e.value.includes('1234-5678-9012-3456'))).toBe(false);
    });
  });
});
