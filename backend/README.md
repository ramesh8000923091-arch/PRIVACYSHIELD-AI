# PrivacyShield AI — Backend (Supabase Metadata Only)

This directory contains **only** optional Supabase configuration, SQL database migrations, and TypeScript schema definitions for safe, non-sensitive metadata.

## Strict Privacy Boundary

PrivacyShield AI does **not** run a backend text-processing API.

### What Supabase May Store (Strictly Opt-In)
- `public.user_preferences`: Theme preference, default redaction mode, and telemetry consent flag for authenticated users.
- `public.sanitization_statistics`: Non-negative integer aggregate counts (`email_count`, `phone_count`, `ip_count`, `pan_count`, `aadhaar_count`, `credit_card_count`, `total_entities`) and the selected `redaction_mode`.

### What Is NEVER Stored or Transmitted
- Raw pasted text or uploaded `.txt` / `.csv` files
- Filenames or document snippets
- Detected PII values (emails, phone numbers, IPs, PANs, Aadhaar numbers, credit card numbers)
- Pseudonymization mappings

## Local-Only Mode

The application runs in **Local-Only Mode** by default when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured. All core PII detection, classification, redaction, diffing, analytics, and file export features work 100% offline in the browser.
