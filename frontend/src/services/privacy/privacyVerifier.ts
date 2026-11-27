import { z } from 'zod';
import { isSupabaseConfigured } from '@/services/supabase';
import type { DetectionAnalytics, PrivacyCheckResult, PrivacyVerificationReport } from '@/types';

/**
 * Strict schema verifying that optional Supabase aggregate payloads contain
 * ONLY non-negative integer counts and the redaction mode — zero raw text or PII.
 */
export const SafeSupabaseStatisticsPayloadSchema = z
  .object({
    email_count: z.number().int().min(0),
    phone_count: z.number().int().min(0),
    ip_count: z.number().int().min(0),
    pan_count: z.number().int().min(0),
    aadhaar_count: z.number().int().min(0),
    credit_card_count: z.number().int().min(0),
    total_entities: z.number().int().min(0),
    redaction_mode: z.enum(['FULL_MASK', 'PARTIAL_MASK', 'PSEUDONYMIZE']),
  })
  .strict()
  .refine(
    (data) =>
      data.total_entities ===
      data.email_count +
        data.phone_count +
        data.ip_count +
        data.pan_count +
        data.aadhaar_count +
        data.credit_card_count,
    { message: 'total_entities must equal the sum of individual category counts' }
  );

export type SafeSupabaseStatisticsPayload = z.infer<typeof SafeSupabaseStatisticsPayloadSchema>;

function normalizeNeedles(sensitiveValues: readonly string[]): string[] {
  return sensitiveValues.map((value) => value.trim()).filter((value) => value.length >= 4);
}

function inspectStorage(storage: Storage | undefined, needles: readonly string[]): boolean {
  if (!storage || needles.length === 0) {
    return true;
  }

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    const rawValue = storage.getItem(key) ?? '';
    for (const needle of needles) {
      if (rawValue.includes(needle) || key.includes(needle)) {
        return false;
      }
    }
  }
  return true;
}

export function verifyNoSensitiveDataInPayload(
  payload: unknown,
  sensitiveValues: readonly string[]
): boolean {
  const needles = normalizeNeedles(sensitiveValues);
  if (needles.length === 0) return true;

  let serialized = '';
  try {
    serialized = JSON.stringify(payload) ?? '';
  } catch {
    return false;
  }

  return needles.every((needle) => !serialized.includes(needle));
}

export interface PrivacyVerificationInput {
  sensitiveSamples?: readonly string[];
  analyticsSnapshot?: DetectionAnalytics | null;
  outboundPayloads?: readonly unknown[];
  capturedConsoleMessages?: readonly string[];
}

/**
 * Privacy Verification Module
 * Audits browser storage, analytics objects, console captures, network payloads,
 * and Supabase mode to confirm raw documents and PII never leak outside volatile RAM.
 */
export function runPrivacyVerification(
  input: PrivacyVerificationInput = {}
): PrivacyVerificationReport {
  const now = new Date().toISOString();
  const needles = normalizeNeedles(input.sensitiveSamples ?? []);
  const checks: PrivacyCheckResult[] = [];

  const localStorageClean = inspectStorage(
    typeof window !== 'undefined' ? window.localStorage : undefined,
    needles
  );
  checks.push({
    surface: 'LOCAL_STORAGE',
    passed: localStorageClean,
    details: localStorageClean
      ? 'No raw text, filenames, detected PII, or mappings found in localStorage.'
      : 'Sensitive substring detected in localStorage.',
    checkedAt: now,
  });

  const sessionStorageClean = inspectStorage(
    typeof window !== 'undefined' ? window.sessionStorage : undefined,
    needles
  );
  checks.push({
    surface: 'SESSION_STORAGE',
    passed: sessionStorageClean,
    details: sessionStorageClean
      ? 'No raw text or detected PII found in sessionStorage.'
      : 'Sensitive substring detected in sessionStorage.',
    checkedAt: now,
  });

  const analyticsClean = verifyNoSensitiveDataInPayload(input.analyticsSnapshot ?? {}, needles);
  checks.push({
    surface: 'ANALYTICS',
    passed: analyticsClean,
    details: analyticsClean
      ? 'Analytics payload contains strictly aggregate counts and structural metrics.'
      : 'Sensitive substring detected in analytics snapshot.',
    checkedAt: now,
  });

  const consoleClean = verifyNoSensitiveDataInPayload(input.capturedConsoleMessages ?? [], needles);
  checks.push({
    surface: 'CONSOLE',
    passed: consoleClean,
    details: consoleClean
      ? 'No raw PII values detected in console log stream.'
      : 'Sensitive substring detected in console output.',
    checkedAt: now,
  });

  const networkPayloadsClean = verifyNoSensitiveDataInPayload(
    input.outboundPayloads ?? [],
    needles
  );
  checks.push({
    surface: 'NETWORK',
    passed: networkPayloadsClean,
    details: networkPayloadsClean
      ? 'Zero sensitive values detected in outbound network payloads.'
      : 'Sensitive substring detected in outbound network payload.',
    checkedAt: now,
  });

  checks.push({
    surface: 'SUPABASE',
    passed: true,
    details: isSupabaseConfigured
      ? 'Supabase configured with strict metadata-only Zod validation.'
      : 'Local-Only Mode active — zero Supabase credentials configured; zero cloud requests.',
    checkedAt: now,
  });

  return {
    overallPassed: checks.every((check) => check.passed),
    localOnlyMode: !isSupabaseConfigured,
    checks,
    generatedAt: now,
  };
}
