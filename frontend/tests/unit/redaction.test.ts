import { describe, expect, it } from 'vitest';
import { SYNTHETIC_AADHAAR_1 } from '@/constants';
import { detectPII } from '@/services/detection';
import {
  applyFullMask,
  applyPartialMask,
  applyRedaction,
  PseudonymMapper,
} from '@/services/redaction';

describe('Phase 6 — Redaction Engine & Consistent Pseudonymization', () => {
  it('applies full mask with category tokens and generic [REDACTED] option', () => {
    expect(applyFullMask('EMAIL', 'CATEGORY_TAG')).toBe('[REDACTED_EMAIL]');
    expect(applyFullMask('CREDIT_CARD', 'CATEGORY_TAG')).toBe('[REDACTED_CREDIT_CARD]');
    expect(applyFullMask('EMAIL', 'GENERIC')).toBe('[REDACTED]');
  });

  it('applies partial masking policies without ever revealing full sensitive values', () => {
    expect(applyPartialMask('EMAIL', 'anuj@example.com')).toBe('an**@example.com');
    expect(applyPartialMask('PHONE', '+91 9876543210')).toBe('XXXXXX3210');
    expect(applyPartialMask('PAN', 'ABCPK1234F')).toBe('XXXXX1234X');
    expect(applyPartialMask('AADHAAR', SYNTHETIC_AADHAAR_1)).toBe(
      `XXXX XXXX ${SYNTHETIC_AADHAAR_1.slice(-4)}`
    );
    expect(applyPartialMask('CREDIT_CARD', '4111-1111-1111-1111')).toBe('XXXX-XXXX-XXXX-1111');
    expect(applyPartialMask('IP_ADDRESS', '192.168.42.19')).toBe('192.168.xxx.xxx');
    expect(applyPartialMask('IP_ADDRESS', '2001:0db8:85a3::7334')).toBe(
      '2001:0db8:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx'
    );
  });

  it('maintains consistent normalized pseudonymization across repeated values and resets cleanly', () => {
    const text =
      'Contact anuj@example.com.\nEmail ANUJ@example.com again.\nCC priya@example.com.\nPhone: +91 9876543210 / 98765-43210.';
    const { entities } = detectPII(text);
    const mapper = new PseudonymMapper();

    const result = applyRedaction(
      text,
      entities,
      {
        mode: 'PSEUDONYMIZE',
        fullMaskVariant: 'CATEGORY_TAG',
        excludedEntityIds: new Set(),
      },
      mapper
    );

    expect(result.sanitizedText).toBe(
      'Contact USER_01.\nEmail USER_01 again.\nCC USER_02.\nPhone: PHONE_01 / PHONE_01.'
    );
    expect(mapper.getTotalMappings()).toBe(3);

    mapper.reset();
    expect(mapper.getTotalMappings()).toBe(0);
    expect(mapper.getOrCreateToken('EMAIL', 'fresh@example.com')).toBe('USER_01');
  });

  it('honors per-entity exclusions and emits accurate DiffSegments', () => {
    const text = 'Primary: a@example.com, Secondary: b@example.com';
    const { entities } = detectPII(text);
    expect(entities).toHaveLength(2);

    const excluded = new Set<string>([entities[0].id]);
    const result = applyRedaction(text, entities, {
      mode: 'FULL_MASK',
      fullMaskVariant: 'CATEGORY_TAG',
      excludedEntityIds: excluded,
    });

    expect(result.sanitizedText).toBe('Primary: a@example.com, Secondary: [REDACTED_EMAIL]');
    expect(result.redactedCount).toBe(1);
    expect(result.excludedCount).toBe(1);
    expect(result.diffSegments.some((seg) => seg.kind === 'excluded')).toBe(true);
    expect(result.diffSegments.some((seg) => seg.kind === 'redacted')).toBe(true);
  });

  it('supports cross-document pseudonym retention when explicitly opted in, and handles empty input', () => {
    const emptyRes = applyRedaction('', [], {
      mode: 'FULL_MASK',
      fullMaskVariant: 'CATEGORY_TAG',
      excludedEntityIds: new Set(),
    });
    expect(emptyRes.sanitizedText).toBe('');
    expect(emptyRes.diffSegments).toEqual([]);

    const sharedMapper = new PseudonymMapper();
    const doc1 = 'Owner: alice@example.com';
    const doc2 = 'New: bob@example.com, Returning: ALICE@example.com';

    const out1 = applyRedaction(
      doc1,
      detectPII(doc1).entities,
      { mode: 'PSEUDONYMIZE', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() },
      sharedMapper
    );
    const out2 = applyRedaction(
      doc2,
      detectPII(doc2).entities,
      { mode: 'PSEUDONYMIZE', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() },
      sharedMapper
    );

    expect(out1.sanitizedText).toBe('Owner: USER_01');
    expect(out2.sanitizedText).toBe('New: USER_02, Returning: USER_01');
  });
});
