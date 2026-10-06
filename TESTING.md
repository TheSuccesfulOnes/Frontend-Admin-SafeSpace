# Administrative frontend validation tests

Run from this repository with Node 24 and npm 11 (the versions used for verification):

```sh
npm ci
npm test
npm run test:typecheck
npm run build
npm run lint
npm audit
npm audit --omit=dev
```

`npm test` runs Vitest once and generates `tests/results.json`, `tests/validation-inventory.json` and the executed inventory table below from actual individual runner results, including expanded parameterized cases. Failed cases are counted as executed but are distinguished from passed cases; skipped cases are not counted toward the 20 minimum. The full command fails if any owner has fewer than 20 cases or if an owner is missing, a test fails, or a case is skipped. `tests/validation-owners.json` classifies all 29 TypeScript/TSX source files as 12 owners or 17 exclusions with reasons; the runner rejects unclassified/new files and duplicate classifications. The generated inventory JSON lists every case title, suite, owner and unit/integration type. `npm run test:watch` is for development; regenerate the final inventory with the full `npm test` command. Focused runs can be passed to `npm test -- tests/api.test.ts` but produce partial JSON inventories and preserve the last full-run documentation table: always finish with the full command.

<!-- executed-inventory -->

Last full run: 288 executed cases; 288 passed, 0 failed, 0 skipped.

| Source | Suites | Unit | Local integration | Executed |
| --- | --- | ---: | ---: | ---: |
| `src/app/App.tsx` | `tests/App.test.tsx` | 0 | 22 | 22 |
| `src/components/ConfirmationDialog.tsx` | `tests/ConfirmationDialog.test.tsx` | 23 | 2 | 25 |
| `src/pages/ActivitiesPage.tsx` | `tests/ActivitiesPage.test.tsx` | 0 | 20 | 20 |
| `src/pages/LoginPage.tsx` | `tests/LoginPage.test.tsx` | 0 | 20 | 20 |
| `src/pages/OverviewPage.tsx` | `tests/OverviewPage.test.tsx` | 0 | 20 | 20 |
| `src/pages/PaymentsPage.tsx` | `tests/PaymentsPage.test.tsx` | 0 | 28 | 28 |
| `src/pages/ReportsPage.tsx` | `tests/ReportsPage.test.tsx` | 0 | 20 | 20 |
| `src/pages/SurveysPage.tsx` | `tests/SurveysPage.test.tsx` | 0 | 20 | 20 |
| `src/pages/UserManagementPage.tsx` | `tests/UserManagementPage.test.tsx` | 0 | 30 | 30 |
| `src/services/adminService.ts` | `tests/adminService.test.ts` | 6 | 22 | 28 |
| `src/services/api.ts` | `tests/api.test.ts` | 25 | 2 | 27 |
| `src/services/sessionStorage.ts` | `tests/session-flows.test.tsx`, `tests/sessionStorage.test.ts` | 26 | 2 | 28 |

<!-- executed-inventory -->

## Scope and test design

Twelve active owners are included. Activities test trimmed options and minimum count, native form constraints, add/remove boundaries and confirmed CRUD/lifecycle operations. Surveys test title/question constraints, DAILY/WEEKLY and comment flag contracts, confirmed CRUD, valid lifecycle transitions, selected comment cleanup and retry. User management tests role binding, required fields/email, password length/matching, protected owner/self-account guards, confirmation/cancellation and duplicate identity errors. Payments test PDF extension/MIME/non-empty data, byte boundaries, name/plan/voucher completeness, trimming, multipart API contract, confirmation, cancellation, reset, retry and busy guards. Reports test all twelve distinct supported status transitions and mutation/cancellation/retry/busy handling. Overview tests disabled-account enable flows for every role, owner protection and action lifecycle. App tests stored-session admission, 401/403 revocation, other HTTP failures, persistence, logout and retry. ConfirmationDialog tests user consent and busy guards for each operation plus Escape cleanup. Session storage tests shape/role rejection, persistence, cleanup and unavailable storage. API tests error payload type checks, status preservation, malformed JSON and empty response handling. Admin service tests role admission and endpoint/method/body/header contracts across all mutation families, nested comments and multipart payment.

Integration here means local jsdom React component → actual `adminService`/`authService` → actual `parseApiResponse` → fake `fetch`, or actual service → parser → fake `fetch`. No service/parser mocks are used in component flows. Unit tests exercise storage, error parser, role predicate and confirmation guards directly. Local integration does not verify backend authorization, SQL/Firestore, PDF content parsing, deployment, real browser navigation or live end-to-end behavior.

Every test starts with a fetch stub that rejects unconfigured requests. Page fixtures check authorization and allow only explicit route/method patterns; focused tests assert exact mutation contracts. No real Render, Firebase, Gemini or paid service calls occur during tests. Dependency installation/audit uses the npm registry, not application services. Dates are fixed to 2026-10-05T12:00:00Z. Components are unmounted after each case, cleaning effects/timers; mocks, timers and local/session storage are reset between cases. jsdom does not enforce `minLength`/`maxLength` like a real browser: native required/email validity and declared length boundaries are tested, and direct submit events intentionally exercise application guards. DOM maximum-length attributes are not claimed as server-side rejection tests. Translation keys are stable test labels; production translations remain unchanged except the payment size correction.

## Regression corrections

- `sessionStorage.ts`: browser storage access can throw during both read and cleanup. Previously the catch branch threw again; cleanup is now best effort and the caller gets an anonymous session. Regression explicitly simulates both operations failing.
- `PaymentsPage.tsx` and `translations.ts`: parent backend audit identified `PaymentService.MAX_SAFE_FIRESTORE_VOUCHER_BYTES = 700_000`; the old frontend 10 MiB limit accepted vouchers that the backend always rejected because a Firestore document must also hold metadata. Limit is now 700,000 bytes with localized helper/error messages. Tests cover exactly 700,000, 700,001 and the formerly accepted 10 MiB. Empty files, missing `.pdf` extension and incompatible MIME are blocked; `application/pdf`, `application/octet-stream` and empty MIME are accepted, matching the backend's optional content type contract. PDF fixtures start with `%PDF-1.7`; content signature inspection remains the backend's responsibility. Backend contract was reported by the parent; this repo's tests do not execute that backend.

## Excluded scan candidates and reasons

- `src/App.tsx`: inspected legacy self-contained admin/login/HR prototype. `src/main.tsx` imports `src/app/App.tsx`; no active source imports the legacy `src/App.tsx`. Its duplicate validators are excluded as unreachable application code; it remains subject to the production TypeScript build.
- `src/main.tsx`: bootstrap and StrictMode mounting, no input/business validator.
- `src/config/env.ts`: build-time API URL default and trailing-slash normalization; no security or business admission decision. Endpoint construction is exercised through service contracts. URL allow-listing is not implemented or claimed.
- `src/services/authService.ts`: login transport and snake-case field mapping; no runtime shape/role validation. Exercised through all LoginPage and App login integrations. The cast of `role` does not enforce authorization; LoginPage's predicate owns admission.
- `src/i18n/LanguageProvider.tsx`: `savedLanguage === 'es' ? 'es' : 'en'` is a presentation preference fallback, excluded from business/input/security validators. `src/i18n/useLanguage.ts` provider-presence exception is a configuration guard, not a data validator. `translations.ts` and `languageContext.ts` are labels/context definitions. Locale effects and translation correctness are not claimed by these tests.
- `src/components/PasswordField.tsx`: forwards required/minLength attributes supplied by owning pages and toggles visibility; no independent password validator. Covered when form pages render it.
- `src/components/layout/Sidebar.tsx`: name-to-avatar fallback, counters and navigation rendering; no permission enforcement. `Topbar.tsx`, `PageContent.tsx`, `PageFooter.tsx`, `Metric.tsx`, `LanguageSwitcher.tsx`: rendering or event forwarding only, no independent validator.
- `src/hooks/useAutoDismiss.ts`: presentation timer/feedback cleanup, not a business validator; cleaned through component unmount. No sleep-based tests.
- `src/types/domain.ts`: compile-time types only; no runtime schema/factory checks. Assets, CSS and Vite bootstrap configuration have no application validation flow.

## Limitations and verification

These are case counts, not instrumented statement/branch coverage percentages. API success payloads are type-cast, not runtime-schema-validated; session checks currently accept empty string identity fields. Native max lengths and select options can be bypassed by synthetic events or direct service consumers; authorization and all upload/security checks must still be enforced by the backend. The frontend PDF MIME/extension check cannot prove actual PDF content. No claim of live backend or browser end-to-end verification is made.

Verification on 2026-10-05, Node v24.19.0 / npm 11.17.0:

- `npm test`: all executed cases passed; exact owner/suite/type counts are generated above and in the inventory JSON.
- `npm run test:typecheck`: passed (includes tests, configuration and production source).
- `npm run build`: passed; production TypeScript build and Vite bundle (42 transformed modules).
- `npm run lint`: passed without warnings after correcting unsafe optional chaining in a test assertion.
- `npm audit --json`: zero vulnerabilities across all dependencies.
- `npm audit --omit=dev --json`: zero production dependency vulnerabilities.

Added development-only Vitest, Testing Library React/jest-dom and jsdom dependencies. Installation initially reported one high-severity development dependency issue in `source-map-js` (GHSA-68fv-2mgg-jv7q). `npm update source-map-js` updated the lockfile to 1.2.2, shared by jsdom/css-tree and Vite/PostCSS; both final audits are clean. React/React DOM production dependency declarations were unchanged. The full suite, test typecheck, production build, lint and both dependency audits were independently rerun successfully before committing.
