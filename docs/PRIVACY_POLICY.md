# PrivacyShield AI — Privacy Policy

**Effective Date:** November 2026  
**Operating Principle:** 100% Client-Side PII Processing by Design

---

## 1. Core Commitment

PrivacyShield AI processes all pasted text, uploaded `.txt` files, and uploaded `.csv` datasets **strictly inside your browser's volatile memory (RAM)**. We do not operate a backend document-processing API, and we never transmit raw inputs, detected PII values, sanitized documents, or pseudonymization mappings to any external server.

## 2. Data Processed Locally (Volatile RAM Only)

The following items exist exclusively in memory while the active browser tab is open and are purged on workspace clear, mapping reset, or tab closure:

- Pasted text content and uploaded `.txt` / `.csv` contents
- Detected entity substrings (emails, phone numbers, IP addresses, PANs, Aadhaar-like numbers, credit card numbers)
- Consistent Pseudonymization lookup tables (`PseudonymMapper`)
- Generated sanitized output and side-by-side diff segments

## 3. Local Browser Storage (`localStorage`)

`localStorage` is used solely for non-sensitive application state:

- UI theme preference (`dark` or `light`)
- Default redaction mode and enabled PII category toggles
- Opt-in toggles (`retainMappingsAcrossDocuments` and `telemetryConsent`, both disabled by default)
- Local Activity Log metadata (ISO timestamps, action enum, entity counts, redaction mode, status) — validated with a strict Zod schema that forbids document content or PII values

## 4. Optional Supabase Integration

PrivacyShield AI operates in **Local-Only Mode** by default without any Supabase credentials. If an administrator configures optional Supabase credentials and a user explicitly opts in:

- `user_preferences` stores only theme, default redaction mode, and consent flags for authenticated users.
- `sanitization_statistics` stores only non-negative integer counts and redaction mode enums.
- No text, file, filename, or sensitive value column exists in the database schema.

## 5. Clearing Your Local Activity

Users can clear local activity logs and preferences at any time from **Activity Log → Clear History**, **Workspace → Settings**, or **Privacy & Security → Clear Local Activity & Reset Preferences**.
