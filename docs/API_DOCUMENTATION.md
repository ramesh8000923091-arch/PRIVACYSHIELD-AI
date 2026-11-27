# PrivacyShield AI — Internal Service & Metadata API Documentation

> **Important:** PrivacyShield AI intentionally has **NO backend API that accepts raw text, uploaded files, or PII**. All detection, redaction, CSV processing, and export interfaces execute locally inside the browser.

---

## 1. Client-Side Detection Engine (`src/services/detection`)

- `detectPII(text: string, options?: DetectionOptions): DetectionSummary` — Synchronous deterministic detection across enabled categories with overlap resolution.
- `detectPIIAsync({ text, options, signal, onProgress }): Promise<DetectionSummary>` — Automatically runs synchronously under `50 KB` or offloads to `detection.worker.ts` for inputs `>= 50 KB` with `AbortSignal` cancellation.
- Individual testable modules: `detectEmails`, `detectPhones`, `detectIpAddresses`, `detectPans`, `detectAadhaar`, `detectCreditCards`, `isValidLuhn`, `isValidVerhoeff`, `resolveOverlaps`.

## 2. Client-Side Redaction Engine (`src/services/redaction`)

- `applyRedaction(originalText, entities, config, sharedMapper?): RedactionOutput` — Single-pass $O(n)$ redaction returning `sanitizedText`, `appliedRedactions`, `diffSegments`, `redactedCount`, and `excludedCount`.
- `applyFullMask(type, variant)` — Produces `[REDACTED_<TYPE>]` or `[REDACTED]`.
- `applyPartialMask(type, value)` — Applies bounded partial masking policies (including IPv4 `/16` and IPv6 2-hextet masking).
- `PseudonymMapper` — RAM-only consistent mapping class with `.getOrCreateToken(type, value)`, `.getTotalMappings()`, and `.reset()`.

## 3. CSV & Export Services (`src/services/csv`, `src/services/export`)

- `parseCsvContent(rawText, fileName, fileSizeBytes)` — Safe `PapaParse` parsing preserving delimiters, linebreaks, headers, and quoted fields.
- `sanitizeCsvDocument(csvDoc, detectionOptions, redactionConfig, sharedMapper)` — Cell-by-cell detection and redaction preserving CSV matrix integrity.
- `downloadSanitizedFile(content, format, originalFileName)` — Browser `Blob` export with guaranteed `URL.revokeObjectURL`.
- `createSafePrivacyReport(analytics, redactionMode)` — Generates zero-PII JSON privacy summary.

## 4. Privacy Verification Module (`src/services/privacy`)

- `runPrivacyVerification(input?)` — Audits `LOCAL_STORAGE`, `SESSION_STORAGE`, `ANALYTICS`, `CONSOLE`, `NETWORK`, and `SUPABASE` surfaces and returns `PrivacyVerificationReport`.
- `SafeSupabaseStatisticsPayloadSchema` — Strict Zod schema rejecting extra keys or mismatched totals.

## 5. Optional Supabase Metadata Service (`src/services/supabase`)

- `isSupabaseConfigured: boolean` — `false` in Local-Only Mode.
- `submitConsentedAggregateStats(analytics, redactionMode, userConsented)` — No-op unless configured AND explicitly consented; inserts strictly validated integer counts into `public.sanitization_statistics`.
