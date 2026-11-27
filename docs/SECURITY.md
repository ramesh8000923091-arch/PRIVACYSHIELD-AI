# PrivacyShield AI — Security Documentation

## 1. Threat Model & Mitigations

| Threat | Mitigation Implemented |
| :--- | :--- |
| **Data exfiltration to external APIs** | Zero backend text-processing endpoints; zero external LLM calls; Playwright network interception tests verify zero outbound document traffic. |
| **Sensitive data persistence in browser storage** | `useWorkspaceStore` intentionally uses zero persistence middleware; `useAuditLogStore` enforces `.strict()` Zod metadata validation; Privacy Verification Module audits `localStorage` & `sessionStorage`. |
| **Cross-Site Scripting (XSS) via malicious documents** | Zero usage of `dangerouslySetInnerHTML`; all highlighted and diff segments render as safe React text nodes; strict CSP headers in `frontend/vercel.json`. |
| **Malicious or oversized file uploads** | `validateUploadedFile` enforces `.txt`/`.csv` extension allowlist, MIME allowlist, `10 MB` size cap, non-empty check, and null-byte binary rejection. Uploaded content is never executed. |
| **UI freeze / ReDoS on large inputs** | Bounded deterministic regexes paired with structural/checksum validators (Luhn, Verhoeff, RFC 4291 IPv6); automatic Web Worker offload for inputs `>= 50 KB` with `AbortController` cancellation. |
| **Memory retention of Blob downloads** | `URL.revokeObjectURL()` is invoked in a `finally` block immediately after triggering file downloads. |
| **Unauthorized Supabase metadata access** | Row Level Security (RLS) enabled on all tables with `auth.uid() = user_id` policies and strict integer `CHECK` constraints. |
| **Vulnerable dependencies** | Audited via `npm audit` with **0 vulnerabilities** across all runtime and development packages. |

## 2. Content Security Policy (`frontend/vercel.json`)

- `default-src 'self'`
- `script-src 'self'`
- `connect-src 'self' https://*.supabase.co`
- `worker-src 'self' blob:`
- `object-src 'none'`
- `frame-ancestors 'none'`
- Additional security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

## 3. Validation Boundaries & Disclaimers

- **Aadhaar:** Validated via leading-digit `[2–9]` rule + Verhoeff checksum. Does **not** verify against UIDAI.
- **PAN:** Validated via complete 10-character structural rule (including 4th-char entity code and 5th-char name initial). Does **not** verify against Income Tax Department databases.
- **Credit Card:** Validated via length (13–19 digits) + Luhn mod-10 checksum. Never logged or stored.
