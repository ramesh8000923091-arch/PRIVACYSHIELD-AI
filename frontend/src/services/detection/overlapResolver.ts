import { PII_CATEGORIES } from '@/constants';
import type { DetectedEntity } from '@/types';

/**
 * Resolves overlapping or duplicate entity detections deterministically.
 *
 * Ranking order:
 * 1. Category specificity priority (CREDIT_CARD > AADHAAR > EMAIL > IP_ADDRESS > PAN > PHONE)
 * 2. Longer span length
 * 3. Higher confidence score
 * 4. Earlier start offset
 *
 * Output is guaranteed strictly non-overlapping and sorted ascending by start offset.
 */
export function resolveOverlaps(candidates: readonly DetectedEntity[]): DetectedEntity[] {
  if (candidates.length <= 1) {
    return candidates.map((entity) => ({
      ...entity,
      id: `ent-${entity.type}-${entity.start}-${entity.end}`,
    }));
  }

  const ranked = [...candidates].sort((a, b) => {
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
    if (candidate.start >= candidate.end) {
      continue;
    }

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
