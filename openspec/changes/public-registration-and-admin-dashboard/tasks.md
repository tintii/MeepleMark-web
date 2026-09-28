## 1. Schema and upgrade foundation

- [x] 1.1 Record the current account/sync baseline and outstanding earlier acceptance work; map every domain-write and operator entry point before adding permissions.
- [x] 1.2 Add a versioned migration for constrained account roles, registration settings and administrative audit events; preserve existing users as `user`, IDs, credentials, setup codes and ownership, and initialize registration as closed.
- [x] 1.3 Update schema readiness expectations and verify fresh migration, populated upgrade, repeated execution and failure behavior against real PostgreSQL without editing the initial migration.
- [x] 1.4 Add shared role/capability, registration, admin payload and pagination schemas; verify invalid roles and public privileged fields are rejected.

## 2. Authorization and shared administration services

- [x] 2.1 Resolve current role/status during authentication, expose capabilities in session responses, and implement reusable admin/write guards while preserving owner-scoped reads.
- [x] 2.2 Apply transaction-aware write checks to sync mutations, receipt replays and adoption; test the complete role matrix, forged ownership and demotion racing a write.
- [x] 2.3 Implement shared role/status/deletion services with a consistent lock order and last-usable-admin protection; test concurrent removals and pending/disabled admin exclusions.
- [x] 2.4 Add transactional, secret-free audit events for web and CLI administration; test rollback on audit failure and history survival after actor/target deletion.
- [x] 2.5 Extend the CLI with explicit role assignment and documented first-admin/operator recovery flows; route existing lifecycle commands through shared guarded/audited services.

## 3. Registration and account recovery API

- [x] 3.1 Expose public registration capabilities and implement atomic username/password signup with session and sync-state creation; test normalized duplicates, concurrent requests, invalid credentials and lost-response sign-in recovery.
- [x] 3.2 Serialize signup policy checks against registration changes; test closed signup, invalid role injection, configured read-only defaults and preservation of existing roles.
- [x] 3.3 Add signup throttling, Origin checks and sensitive-payload redaction; constrain proxy trust and test rate limits with forged forwarding headers and no-store authentication responses.
- [x] 3.4 Preserve existing login/setup/recovery compatibility; enforce disabled-account rejection and role preservation during password recovery with previous-session revocation.

## 4. Administration API

- [x] 4.1 Implement admin overview, paginated account search/filter/detail, and bounded audit-history reads; verify all endpoints reject both non-admin roles and omit secret/game-content fields.
- [x] 4.2 Implement role changes, enable/disable, session revocation, one-use recovery issuance and confirmed deletion through shared services; test CSRF, direct API abuse and last-admin conflicts.
- [x] 4.3 Implement registration policy reads/updates restricted to `readonly` or `user` defaults; verify persistence across app restart and unchanged existing accounts.

## 5. Registration and permission-aware browser behavior

- [x] 5.1 Replace primary code onboarding with Create account and Sign in using existing components, accessible validation and password-manager fields; retain secondary recovery/activation, closed-registration feedback and guest access.
- [x] 5.2 Add role/capability state with login/focus/reconnect refresh and cross-tab propagation; deny account edits when capabilities are missing or explicitly read-only.
- [x] 5.3 Guard account repository mutation entry points, editing/scoring routes, adoption and conflict-upload actions; verify read-only browsing/downloads, password changes and independent guest scoring still work.
- [x] 5.4 Handle write-permission denial by pausing uploads/adoption while preserving pending edits and server shadows; show held-work feedback and resume only after permission refresh with normal conflict checks.
- [x] 5.5 Test offline demotion, multiple tabs, restoration of write access, account switching and disabled/deleted-account handling without data loss or false synchronized status.

## 6. Responsive admin dashboard

- [x] 6.1 Add protected `/admin` navigation, overview, account search/filter/pagination and details using responsive tables/cards and current visual tokens.
- [x] 6.2 Add role/status controls, revoke/recovery actions and typed deletion confirmation with clear effects, progress/errors and keyboard focus handling; keep recovery secrets transient.
- [x] 6.3 Add registration controls and paginated audit history; support direct entry, access-denied/offline states and clearing displayed admin data after loss of authorization.
- [x] 6.4 Verify no admin dataset or mutation enters durable browser/service-worker storage; API data remains no-store and administrative writes require online success.

## 7. Acceptance, deployment documentation and spec reconciliation

- [x] 7.1 Run real-PostgreSQL registration/authorization/admin suites, including cross-owner denial, last-admin races, signup closure races and upgrade preservation.
- [x] 7.2 Run Chromium/WebKit journeys for registration, each role, admin lifecycle actions, guest-data adoption permission, offline demotion and return to writable access.
- [x] 7.3 Review registration and dashboard layouts at 375px phone and desktop widths with keyboard navigation and accessible dialogs; record actual verification separately from earlier outstanding UI review.
- [x] 7.4 Exercise documented Compose fresh setup, CLI admin bootstrap, opening signup, populated upgrade, container replacement and backup/restore; preserve runtime secrets and document authorization-safe rollback and HTTPS.
- [x] 7.5 Update README, self-hosting/persistence/verification docs and stale OpenSpec context to distinguish implemented behavior from proposals; document username-only recovery and the per-account scope of all three roles.
- [x] 7.6 Reconcile the earlier operator-only provisioning requirement/public-signup exclusion when promoting specs, retaining unaffected guest/session/ownership/sync requirements and accurately preserving prior incomplete work.
- [ ] 7.7 Run lint, unit/integration/browser suites, production builds and strict OpenSpec validation; record any unavailable checks without marking them passed.
