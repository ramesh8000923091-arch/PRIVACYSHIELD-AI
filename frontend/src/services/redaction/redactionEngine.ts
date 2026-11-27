import type {
  AppliedRedaction,
  DetectedEntity,
  DiffSegment,
  RedactionConfig,
  RedactionOutput,
} from '@/types';
import { applyFullMask } from './fullMasker';
import { applyPartialMask } from './partialMasker';
import { PseudonymMapper } from './pseudonymizer';

function computeReplacement(
  entity: DetectedEntity,
  config: RedactionConfig,
  mapper: PseudonymMapper
): string {
  switch (config.mode) {
    case 'FULL_MASK':
      return applyFullMask(entity.type, config.fullMaskVariant);
    case 'PARTIAL_MASK':
      return applyPartialMask(entity.type, entity.value);
    case 'PSEUDONYMIZE':
      return mapper.getOrCreateToken(entity.type, entity.value);
  }
}

/**
 * Deterministic single-pass O(n) redaction and side-by-side diff generator.
 * Preserves exact line breaks, whitespace, and non-sensitive text.
 */
export function applyRedaction(
  originalText: string,
  entities: readonly DetectedEntity[],
  config: RedactionConfig,
  sharedMapper?: PseudonymMapper
): RedactionOutput {
  if (!originalText || entities.length === 0) {
    return {
      sanitizedText: originalText,
      appliedRedactions: [],
      diffSegments: originalText
        ? [
            {
              id: 'seg-0',
              kind: 'unchanged',
              originalText,
              sanitizedText: originalText,
            },
          ]
        : [],
      redactedCount: 0,
      excludedCount: 0,
    };
  }

  const mapper = sharedMapper ?? new PseudonymMapper();
  const sorted = [...entities].sort((a, b) => a.start - b.start);

  const outputParts: string[] = [];
  const appliedRedactions: AppliedRedaction[] = [];
  const diffSegments: DiffSegment[] = [];

  let cursor = 0;
  let sanitizedCursor = 0;
  let redactedCount = 0;
  let excludedCount = 0;
  let segmentIndex = 0;

  for (const entity of sorted) {
    if (entity.start < cursor || entity.end > originalText.length) {
      continue;
    }

    if (entity.start > cursor) {
      const plainChunk = originalText.slice(cursor, entity.start);
      outputParts.push(plainChunk);
      diffSegments.push({
        id: `seg-${segmentIndex++}`,
        kind: 'unchanged',
        originalText: plainChunk,
        sanitizedText: plainChunk,
      });
      sanitizedCursor += plainChunk.length;
    }

    const originalSlice = originalText.slice(entity.start, entity.end);
    const isExcluded = config.excludedEntityIds.has(entity.id);
    const replacement = isExcluded ? originalSlice : computeReplacement(entity, config, mapper);

    outputParts.push(replacement);

    const sanitizedStart = sanitizedCursor;
    const sanitizedEnd = sanitizedStart + replacement.length;
    sanitizedCursor = sanitizedEnd;

    appliedRedactions.push({
      entityId: entity.id,
      type: entity.type,
      originalStart: entity.start,
      originalEnd: entity.end,
      sanitizedStart,
      sanitizedEnd,
      replacement,
      wasExcluded: isExcluded,
    });

    diffSegments.push({
      id: `seg-${segmentIndex++}`,
      kind: isExcluded ? 'excluded' : 'redacted',
      originalText: originalSlice,
      sanitizedText: replacement,
      entityId: entity.id,
      entityType: entity.type,
    });

    if (isExcluded) {
      excludedCount += 1;
    } else {
      redactedCount += 1;
    }

    cursor = entity.end;
  }

  if (cursor < originalText.length) {
    const tail = originalText.slice(cursor);
    outputParts.push(tail);
    diffSegments.push({
      id: `seg-${segmentIndex++}`,
      kind: 'unchanged',
      originalText: tail,
      sanitizedText: tail,
    });
  }

  return {
    sanitizedText: outputParts.join(''),
    appliedRedactions,
    diffSegments,
    redactedCount,
    excludedCount,
  };
}
