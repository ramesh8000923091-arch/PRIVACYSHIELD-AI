import type { AuditLogEntry, DetectionAnalytics, RedactionMode } from '@/types';
import { triggerBlobDownload } from './fileExporter';

export interface SafePrivacyReport {
  reportType: 'PRIVACYSHIELD_LOCAL_PRIVACY_REPORT';
  generatedAt: string;
  processingEnvironment: '100% Client-Side Browser RAM';
  redactionMode: RedactionMode;
  summary: {
    totalDetected: number;
    totalRedacted: number;
    totalExcluded: number;
    countsByCategory: DetectionAnalytics['countsByCategory'];
    originalCharCount: number;
    sanitizedCharCount: number;
    processingTimeMs: number;
    usedWorker: boolean;
  };
  privacyGuarantee: string;
}

/**
 * Builds a strictly non-sensitive privacy summary report (zero raw text, zero PII values).
 */
export function createSafePrivacyReport(
  analytics: DetectionAnalytics,
  redactionMode: RedactionMode
): SafePrivacyReport {
  return {
    reportType: 'PRIVACYSHIELD_LOCAL_PRIVACY_REPORT',
    generatedAt: new Date().toISOString(),
    processingEnvironment: '100% Client-Side Browser RAM',
    redactionMode,
    summary: {
      totalDetected: analytics.totalDetected,
      totalRedacted: analytics.totalRedacted,
      totalExcluded: analytics.totalExcluded,
      countsByCategory: { ...analytics.countsByCategory },
      originalCharCount: analytics.originalCharCount,
      sanitizedCharCount: analytics.sanitizedCharCount,
      processingTimeMs: analytics.processingTimeMs,
      usedWorker: analytics.usedWorker,
    },
    privacyGuarantee:
      'Contains aggregate metadata counts only. Zero raw input text, sensitive values, or pseudonymization mappings are included.',
  };
}

export function downloadJsonReport(payload: unknown, fileNamePrefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${fileNamePrefix}-${stamp}.json`;
  return triggerBlobDownload(
    JSON.stringify(payload, null, 2),
    fileName,
    'application/json;charset=utf-8'
  );
}

export function exportSafeAuditLogSummary(entries: readonly AuditLogEntry[]): string {
  return downloadJsonReport(
    {
      reportType: 'PRIVACYSHIELD_SAFE_AUDIT_SUMMARY',
      exportedAt: new Date().toISOString(),
      entryCount: entries.length,
      entries,
    },
    'privacyshield-audit-summary'
  );
}
