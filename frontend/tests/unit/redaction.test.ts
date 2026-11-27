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

  it('canonicalizes compressed, expanded, and uppercase IPv6 addresses to identical pseudonyms', () => {
    const mapper = new PseudonymMapper();
    const t1 = mapper.getOrCreateToken('IP_ADDRESS', '2001:db8::1');
    const t2 = mapper.getOrCreateToken('IP_ADDRESS', '2001:0DB8:0000:0000:0000:0000:0000:0001');
    const t3 = mapper.getOrCreateToken('IP_ADDRESS', '2001:db8::2');
    expect(t1).toBe('IP_01');
    expect(t2).toBe('IP_01');
    expect(t3).toBe('IP_02');
    expect(mapper.getTotalMappings()).toBe(2);
  });

  it('handles leading-compressed IPv6 partial masking, invalid IP fallback, and short emails safely', () => {
    expect(applyPartialMask('IP_ADDRESS', '::a:b:c:d:e:f:1')).toBe(
      '0000:000a:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx'
    );
    expect(applyPartialMask('IP_ADDRESS', 'not-an-ip')).toBe('[REDACTED_IP_ADDRESS]');
    expect(applyPartialMask('EMAIL', 'a@b.com')).toBe('*@b.com');
    expect(applyPartialMask('EMAIL', 'ab@b.com')).toBe('a*@b.com');
  });

  it('restores pseudonymized AI replies locally in RAM without altering unknown tokens', () => {
    const mapper = new PseudonymMapper();
    const u1 = mapper.getOrCreateToken('EMAIL', 'priya.sharma@example.com');
    const p1 = mapper.getOrCreateToken('PHONE', '+91 98765 43210');

    const restored = mapper.restoreText(
      `Hi ${u1}, we called ${p1}. Unknown token USER_99 stays intact.`
    );
    expect(restored.restoredCount).toBe(2);
    expect(restored.restoredText).toBe(
      'Hi priya.sharma@example.com, we called +91 98765 43210. Unknown token USER_99 stays intact.'
    );

    mapper.reset();
    const afterReset = mapper.restoreText(`Hi ${u1}`);
    expect(afterReset.restoredCount).toBe(0);
    expect(afterReset.restoredText).toBe(`Hi ${u1}`);
  });

  it('guards against out-of-bounds or zero-length entities without corrupting output', () => {
    const out = applyRedaction(
      'Hello world',
      [
        {
          id: 'bad-1',
          type: 'EMAIL',
          value: '',
          start: 3,
          end: 3,
          confidence: 0.9,
          validationMethod: 'RFC_PATTERN',
        },
        {
          id: 'bad-2',
          type: 'EMAIL',
          value: 'overflow',
          start: 5,
          end: 99,
          confidence: 0.9,
          validationMethod: 'RFC_PATTERN',
        },
      ],
      { mode: 'FULL_MASK', fullMaskVariant: 'CATEGORY_TAG', excludedEntityIds: new Set() }
    );
    expect(out.sanitizedText).toBe('Hello world');
    expect(out.redactedCount).toBe(0);
  });
});
