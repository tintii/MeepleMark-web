## 1. Baseline and server foundation

- [x] 1.1 Record the current parity implementation state and test/lint/build results; retain version-1 IndexedDB fixtures and all existing workspace changes as the migration baseline.
- [x] 1.2 Extract browser-independent document codecs/validation for server reuse; prove unchanged exact decimal, template, override, and golden evaluation results in both builds.
- [x] 1.3 Scaffold the Fastify/TypeScript API, `pg` pool, configuration validation, and development proxy; define versioned request/response schemas and limits for account, mutation, change-page, and adoption endpoints.
- [x] 1.4 Add an isolated real-PostgreSQL integration-test service and migration runner with checksums/serialization; verify clean creation, repeated execution, and failed-migration behaviour.

## 2. Ownership schema and accounts

- [x] 2.1 Implement installation/recovery identity, users/sessions/setup codes, user-owned domain records, sync state/change metadata, and receipt tables; verify owner-scoped constraints and query indexes.
- [x] 2.2 Add operator account create/recovery/disable/revoke/delete commands and one-use expiring setup codes; verify no secret arguments/logging are required and destructive account actions require explicit confirmation.
- [x] 2.3 Implement Argon2id password setup/change/login, opaque cookie sessions, expiration, CSRF/Origin checks, and throttling using maintained libraries; test invalid/expired codes, failed login, session revocation, and prohibited cross-origin writes.
- [x] 2.4 Implement owner-scoped domain persistence and shared validation; test forged ownership, cross-owner IDs/references, private sheets/membership, historical preservation, and rejected partial writes.

## 3. Server synchronization protocol

- [x] 3.1 Implement immutable mutation envelopes and the per-user transactional sequence/receipt path; verify lost-response replay returns the accepted result and changed replay payloads are rejected.
- [x] 3.2 Add revision conflict responses, tombstone deletion, and creation checks against tombstones; prove delayed offline edits cannot resurrect deleted identities.
- [x] 3.3 Implement bounded incremental change pages with consistent current-state reads and commit-safe cursors; test overlapping transactions, pagination, duplicate entity events, and initial high-water completion.
- [x] 3.4 Enforce expected installation/epoch/account/protocol context before all sync and receipt access; verify mismatches cannot upload under another identity.

## 4. Scoped browser persistence and account UI

- [x] 4.1 Refactor the global repository into explicit guest/account scopes while preserving the old database; test all existing CRUD/history routes in guest mode and two independent account partitions.
- [x] 4.2 Add account entity/server-shadow/outbox/conflict/cursor stores and atomic local mutation transactions; simulate interruption between local mutation and upload and verify no saved edit lacks pending sync state.
- [x] 4.3 Add Account/setup/login/password/logout screens and active-workspace indication using existing responsive/accessible components; retain guest scoring and the three primary destinations.
- [x] 4.4 Coordinate account switching, offline logout/revocation, partition locking, and late callbacks across tabs; verify B cannot see or upload A's cached/pending changes and A can recover them after reauthentication.

## 5. Browser synchronization and conflict recovery

- [x] 5.1 Implement upload coordination, durable immutable in-flight requests, unsent-generation coalescing, and revision rebasing after acknowledgements; test edits made during upload and browser restart.
- [x] 5.2 Implement incremental downloads with atomic page/cursor commits and separate server shadows; test interrupted page application and protect pending local edits from incoming remote state.
- [x] 5.3 Add login/focus/reconnect/change triggers, bounded retry/polling, and Sync now; verify server failures and expired sessions pause appropriately without blocking local scoring.
- [x] 5.4 Integrate device-save/server-sync status into completion and account UI; verify offline completion reports local success and a delayed acknowledgement cannot mark newer changes synced.
- [x] 5.5 Build per-record conflict review and Use server / Keep mine flows, including conflicting deletion and explicit copies of server-deleted records; test repeated concurrent conflicts and unchanged unrelated records.
- [x] 5.6 Implement installation/recovery-epoch mismatch handling with preserved recovery workspaces and deliberate reconciliation; test restoring an older server beside a browser with newer local work.

## 6. Explicit guest-data adoption

- [x] 6.1 Add source-workspace identity and a destination/count preview with Skip; verify first login never automatically uploads or reassigns guest data.
- [x] 6.2 Implement stable snapshot staging, server adoption receipts, and collision-safe mappings through the normal mutation path; verify dependent references and unchanged embedded scoring snapshots/decimal values.
- [x] 6.3 Add resumable progress, invalid-record reporting, changed-source resolution, and account-switch pause; verify lost acknowledgements/repeated adoption create no duplicates and retain all source data.

## 7. Production self-hosting and recovery

- [x] 7.1 Add a multi-stage non-root application image and Compose app/db/migration services with versioned dependencies, a persistent database volume, and runtime-only secrets; verify no default public database port or production test controls.
- [x] 7.2 Add schema-aware readiness, ordered startup/migrations, same-origin API/static serving, and a sample HTTPS proxy configuration; test fresh direct links and missing API/asset responses.
- [x] 7.3 Update service-worker navigation for account/conflict routes while excluding auth/API data; verify offline account navigation, no-store responses, and safe protocol/update handling with pending edits.
- [x] 7.4 Document installation, provisioning, upgrade, volume retention, backup/restore, and rollback; implement the restore epoch/session-reset step and verify logical backup recovery in a clean isolated deployment.
- [x] 7.5 Exercise container replacement and failed upgrades against populated data; verify accounts, players, plays, templates, memberships, and pending-device recovery survive without destructive volume resets.

## 8. Acceptance and documentation

- [x] 8.1 Run API ownership and transaction suites on real PostgreSQL, including two users, lost responses, concurrent commits, invalid documents, stale tombstone updates, and account deletion.
- [x] 8.2 Run Chromium/WebKit journeys with two browsers: provision/login, adopt guest data, record offline, reconnect, observe on the other browser, resolve conflicts, switch accounts, and resume after session expiry.
- [ ] 8.3 Review new account/adoption/conflict/status UI at phone/desktop widths with keyboard navigation and offline conditions; retain the completed parity and unchanged golden regression suites.
- [x] 8.4 Execute the documented fresh Compose setup, container replacement, and clean restore acceptance with representative data; record unavailable runtime/browser checks as outstanding rather than passed.
- [x] 8.5 Run lint, unit/integration/browser suites, production build/image checks, and strict OpenSpec validation; update README, persistence roadmap, and operator/verification docs with actual support and limitations. (Verified 2026-09-27; Linux CI remains authoritative for the committed visual baselines.)
