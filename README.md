# PrivacyShield AI

**Client-Side PII Detection, Classification & Data Sanitization Platform**

PrivacyShield AI is a privacy-first cybersecurity web application that detects, classifies, highlights, compares, and sanitizes Personally Identifiable Information (PII) directly inside your browser. Raw documents, uploaded files, detected sensitive values, and pseudonymization mappings **never leave your device**.

---

## Core Privacy Guarantee

- **100% Client-Side Processing:** All text scanning, validation (Luhn & Verhoeff checksums), redaction, side-by-side diffing, analytics, and `.txt`/`.csv` exports execute strictly in browser memory.
- **Zero External AI or Document APIs:** Deterministic TypeScript engine with Web Worker offloading for large documents (`>= 50 KB` or `> 500` CSV rows).
- **RAM-Only Sensitive State:** Raw inputs, detected values, and pseudonymization maps live exclusively in volatile memory and are never persisted to `localStorage`, `sessionStorage`, `IndexedDB`, or external servers.
- **Privacy Verification Module:** Built-in runtime and test-time verification ensuring zero PII leaks across network requests, browser storage, console logs, analytics, and optional Supabase payloads.
- **Local-Only Mode by Default:** Works completely offline without Supabase credentials. Optional Supabase integration stores only authenticated UI preferences and explicitly consented aggregate integer counts.

---

## Supported PII Categories

| Category | Validation Method | Notes |
| :--- | :--- | :--- |
| **Email (`EMAIL`)** | Pattern & boundary validation | Standard RFC-aligned email addresses |
| **Phone (`PHONE`)** | Indian mobile validation | `+91`, `91`, `0`, or bare 10-digit `[6-9]` mobile numbers with spacing/hyphen variants |
| **IP Address (`IP_ADDRESS`)** | Structural IPv4 & IPv6 validators | Strict octet (`0–255`) and RFC 4291 IPv6 validation |
| **Indian PAN (`PAN`)** | Complete structural validation | 10-char format including 4th-char entity code & 5th-char name initial *(format check only, not govt. verified)* |
| **Aadhaar (`AADHAAR`)** | Leading-digit + Verhoeff checksum | 12-digit `[2-9]` format with Verhoeff validation *(checksum check only, not UIDAI verified)* |
| **Credit Card (`CREDIT_CARD`)** | Length + Luhn mod-10 checksum | Validates 13–19 digit card sequences and rejects invalid checksums |

---

## Redaction Modes

1. **Full Mask:** Replaces sensitive values with category tokens (`[REDACTED_EMAIL]`, `[REDACTED_CARD]`, etc.) or generic `[REDACTED]`.
2. **Partial Mask:** Preserves strictly bounded verification context (e.g., `an**@example.com`, `XXXXXX3210`, `192.168.xxx.xxx`, `XXXX-XXXX-XXXX-3456`).
3. **Consistent Pseudonymization:** Assigns deterministic, category-prefixed RAM-only tokens (`USER_01`, `PHONE_01`, `CARD_01`) consistently across repeated normalized occurrences, resetting automatically on new documents.

---

## Project Structure

```text
privacyshield-ai/
├── frontend/          # React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui
│   ├── public/        # SVG brand assets
│   ├── src/
│   │   ├── components/  # common, layout, editor, detection, redaction, analytics, ui
│   │   ├── pages/       # HomePage, WorkspacePage, HistoryPage, AboutPage, NotFoundPage
│   │   ├── services/    # detection, redaction, csv, export, privacy, supabase
│   │   ├── store/       # Zustand RAM-only workspace store & safe local stores
│   │   ├── hooks/       # Theme, shortcuts, detection runner, scroll sync
│   │   ├── types/       # Shared TypeScript contracts
│   │   ├── constants/   # Category metadata, limits, synthetic samples
│   │   ├── utils/       # Validation, formatting, class helpers
│   │   └── styles/      # Design tokens & Tailwind CSS theme
│   └── tests/         # unit (Vitest), integration (RTL), e2e (Playwright)
├── backend/           # Optional Supabase config, SQL migrations, RLS & DB types (metadata only)
├── docs/              # Architecture, Privacy Policy, Security, API & Testing docs
└── package.json       # Root convenience scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** `>= 20.x` (tested on Node `v24.21.0`)
- **npm** `>= 10.x`

### Installation

```bash
cd frontend
npm install
```

### Environment Variables (Optional)

PrivacyShield AI runs in **Local-Only Mode** out of the box. To enable optional Supabase preferences/statistics sync later, copy the example file:

```bash
cp frontend/.env.example frontend/.env
```

Never commit `.env` files or API keys.

### Available Commands (from repository root)

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite development server (`http://localhost:5173`) |
| `npm run typecheck` | Run strict TypeScript type-checking (`tsc -b --noEmit`) |
| `npm run lint` | Run ESLint across `frontend/` |
| `npm run format:check` | Verify Prettier formatting |
| `npm run test` | Run Vitest unit & integration test suites |
| `npm run test:e2e` | Run Playwright end-to-end & privacy tests |
| `npm run build` | Type-check and build production bundle (`frontend/dist`) |

---

## Documentation

- [Architecture Specification](docs/ARCHITECTURE.md)
- [Privacy Policy](docs/PRIVACY_POLICY.md)
- [Security Documentation](docs/SECURITY.md)
- [Internal Service & Metadata API](docs/API_DOCUMENTATION.md)
- [Testing & Verification Guide](docs/TESTING.md)
- [Backend Metadata Policy](backend/README.md)

## Deployment (Vercel)

- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **SPA Routing & CSP Headers:** Pre-configured in `frontend/vercel.json`
- **Environment Variables (Optional):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (leave blank for Local-Only Mode)

---

## License

Built for educational and cybersecurity competition evaluation. Contains zero real personal data; all bundled test datasets are strictly synthetic.
