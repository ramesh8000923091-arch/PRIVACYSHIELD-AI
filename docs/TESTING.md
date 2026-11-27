# PrivacyShield AI — Testing & Verification Guide

## Test Suites

| Layer | Runner | Location | Coverage |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | Vitest | `frontend/tests/unit/` | All 6 PII detectors (true/false positives), Luhn, Verhoeff, overlap resolver, 3 redaction modes, pseudonymization consistency/reset, entity exclusion, CSV cell sanitization, file validation, safe export, Privacy Verification Module, Landing page components |
| **Integration Tests** | Vitest + RTL | `frontend/tests/integration/` | Full workspace pipeline: text paste → detection → mode switch → entity exclusion → diff → analytics → local activity log → privacy audit |
| **End-to-End & Security Tests** | Playwright (Headless Chromium) | `frontend/tests/e2e/` | All routes, theme switching, responsive Desktop/Tablet/Mobile (`0` horizontal overflow), sample loading, TXT & CSV file uploads, mode switching, entity exclusion, download trigger, zero console errors, zero external network leaks, zero PII in browser storage |

## Running Tests

From `frontend/`:

```bash
npm run typecheck      # Strict TypeScript check
npm run lint           # ESLint static analysis
npm run format:check   # Prettier style check
npm run test           # Vitest unit + integration tests
npm run test:e2e       # Playwright headless Chromium E2E + privacy verification
npm run build          # Production TypeScript + Vite build
```
