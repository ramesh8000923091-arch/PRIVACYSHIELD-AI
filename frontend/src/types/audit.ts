import { z } from 'zod';
import type { RedactionMode } from './redaction';

export const AUDIT_ACTIONS = [
  'SAMPLE_DATA_LOADED',
  'FILE_SELECTED',
  'DETECTION_COMPLETED',
  'REDACTION_MODE_CHANGED',
  'SANITIZATION_COMPLETED',
  'FILE_DOWNLOADED',
  'MAPPINGS_RESET',
  'WORKSPACE_CLEARED',
  'PRIVACY_REPORT_EXPORTED',
  'PRIVACY_CHECK_RUN',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditStatus = 'SUCCESS' | 'WARNING' | 'ERROR';

/**
 * Strict Zod schema for local activity log entries.
 * Explicitly forbids raw text, document content, detected PII values, or mapping tables.
 */
export const AuditLogEntrySchema = z
  .object({
    id: z.string().min(1).max(64),
    timestamp: z.string().datetime(),
    action: z.enum(AUDIT_ACTIONS),
    detectedCount: z.number().int().min(0).optional(),
    redactedCount: z.number().int().min(0).optional(),
    redactionMode: z.enum(['FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYMIZE']).optional(),
    status: z.enum(['SUCCESS', 'WARNING', 'ERROR']),
    note: z.string().max(160).optional(),
  })
  .strict();

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export interface AuditLogInput {
  action: AuditAction;
  detectedCount?: number;
  redactedCount?: number;
  redactionMode?: RedactionMode;
  status: AuditStatus;
  note?: string;
}
