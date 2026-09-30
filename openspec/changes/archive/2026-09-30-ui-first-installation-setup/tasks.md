## 1. Setup contract and API

- [x] 1.1 Add a strict first-administrator setup request model and expose zero-account setup state in public installation metadata.
- [x] 1.2 Implement the dedicated setup endpoint with installation locking, admin/session/sync/audit creation, existing-account rejection, origin checks, rate limiting, redaction, and no-store responses.
- [x] 1.3 Add real-PostgreSQL coverage for setup state, successful setup, forged fields, foreign origins, concurrent claims, and separation from closed public registration.

## 2. Browser setup experience

- [x] 2.1 Add a dedicated responsive `/setup` page with accessible account fields, password confirmation, ownership guidance, and authenticated navigation to administration.
- [x] 2.2 Link required setup from the account experience and preserve normal sign-in, public registration, recovery, and guest behavior after setup.
- [x] 2.3 Add browser coverage for fresh setup, completed setup, mismatched passwords, and narrow layouts.
- [x] 2.4 Add an installation-specific, one-time dismissible setup notice with a direct setup link and browser coverage.

## 3. Documentation and verification

- [x] 3.1 Update the changelog, user manual, self-hosting guide, persistence architecture, and offline route allowlist for UI-first installation setup and its exposure boundary.
- [x] 3.2 Run lint, unit, integration, browser, production-build, documentation-link, whitespace, and strict OpenSpec checks; record platform-specific limitations accurately.
  - Lint, 149 unit tests, 22 PostgreSQL integration tests, production build, local documentation links, whitespace, and strict OpenSpec validation pass.
  - The setup browser flow passes in Chromium and WebKit. The full browser run remains limited by missing Darwin screenshot baselines, an unrelated Chromium service-worker readiness timeout, and the existing WebKit delete-dialog focus-restoration failure.
