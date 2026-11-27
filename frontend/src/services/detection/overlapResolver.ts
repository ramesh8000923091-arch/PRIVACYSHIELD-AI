import { PII_CATEGORIES } from '@/constants';
import type { DetectedEntity } from '@/types';

/**
 * Resolves overlapping or duplicate entity detections deterministically.
 *
 * Ranking rules:
 * 1. Strictly enclosing EMAIL wins over any numeric span contained inside its local-part
 *    (prevents `234567890124@example.com` from leaving `@example.com` unredacted).
 * 2. Category specificity priority (CREDIT_CARD > AADHAAR > EMAIL > IP_ADDRESS > PAN > PHONE)
 * 3. Longer span length
 * 4. Higher confidence score
 * 5. Earlier start offset
 *
 * Output is guaranteed strictly non-overlapping and sorted ascending by start offset.
 */
export function resolveOverlaps(candidates: readonly DetectedEntity[]): DetectedEntity[] {
  const valid = candidates.filter((entity) => entity.start >= 0 && entity.end > entity.start);

  if (valid.length <= 1) {
    return valid.map((entity) => ({
      ...entity,
      id: `ent-${entity.type}-${entity.start}-${entity.end}`,
    }));
  }

  // Filter out non-email spans strictly enclosed by a detected EMAIL span
  const emails = valid.filter((e) => e.type === 'EMAIL');
  const filtered = valid.filter((candidate) => {
    if (candidate.type === 'EMAIL') return true;
    return !emails.some(
      (email) =>
        email.start <= candidate.start &&
        email.end >= candidate.end &&
        email.end - email.start > candidate.end - candidate.start
    );
  });

  const ranked = [...filtered].sort((a, b) => {
    const priorityDiff = PII_CATEGORIES[b.type].priority - PII_CATEGORIES[a.type].priority;
    if (priorityDiff !== 0) return priorityDiff;

    const lengthDiff = b.end - b.start - (a.end - a.start);
    if (lengthDiff !== 0) return lengthDiff;

    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;

    return a.start - b.start;
  });

  const accepted: DetectedEntity[] = [];

  for (const candidate of ranked) {
    const overlaps = accepted.some(
      (existing) => candidate.start < existing.end && candidate.end > existing.start
    );

    if (!overlaps) {
      accepted.push({
        ...candidate,
        id: `ent-${candidate.type}-${candidate.start}-${candidate.end}`,
      });
    }
  }

  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}
