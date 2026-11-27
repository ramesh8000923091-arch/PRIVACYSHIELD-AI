import type { PIIType } from './detection';

export type RedactionMode = 'FULL_MASK' | 'PARTIAL_MASK' | 'PSEUDONYMIZE';

export function isRedactionMode(value: string): value is RedactionMode {
  return value === 'FULL_MASK' || value === 'PARTIAL_MASK' || value === 'PSEUDONYMIZE';
}

export type FullMaskVariant = 'CATEGORY_TAG' | 'GENERIC';

export interface RedactionConfig {
  mode: RedactionMode;
  fullMaskVariant: FullMaskVariant;
  excludedEntityIds: ReadonlySet<string>;
}

export interface AppliedRedaction {
  entityId: string;
  type: PIIType;
  originalStart: number;
  originalEnd: number;
  sanitizedStart: number;
  sanitizedEnd: number;
  replacement: string;
  wasExcluded: boolean;
}

export interface DiffSegment {
  id: string;
  kind: 'unchanged' | 'redacted' | 'excluded';
  originalText: string;
  sanitizedText: string;
  entityId?: string;
  entityType?: PIIType;
}

export interface RedactionOutput {
  sanitizedText: string;
  appliedRedactions: AppliedRedaction[];
  diffSegments: DiffSegment[];
  redactedCount: number;
  excludedCount: number;
}
