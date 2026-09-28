# Public registration and administration verification

Recorded: 2026-09-28. This record is separate from the earlier account/sync
acceptance and its still-outstanding UI review.

Implemented scope:

- migration `002_registration_admin.sql` adds constrained roles, closed-by-default
  registration settings, and append-only administrative audit events;
- browser signup uses normalized usernames, Argon2id passwords, the configured
  non-admin default, origin checks, request limits, and normal cookie sessions;
- current database role/status is authoritative for each request; read-only
  accounts cannot create mutations, replay write receipts, adopt guest records,
  or upload conflict choices;
- `/admin` supports bounded account search/filtering, roles, status, session
  revocation, one-use recovery, confirmed deletion, registration policy, and
  paginated audit history without persisting those datasets in IndexedDB;
- the last enabled password-initialized administrator is protected by serialized
  membership changes; public registration never creates an administrator;
- pending offline edits remain in the outbox after demotion and resume only after
  a confirmed capability refresh.

Verification in this workspace:

| Check | Result |
|---|---|
| `npm run lint` | Passed with no diagnostics. |
| `npm run build` | Passed; browser/server TypeScript, bundles, and PWA generation completed. |
| `npm test` | Passed: 16 files and 133 tests; 5 files/19 PostgreSQL tests skipped without `TEST_DATABASE_URL`. |
| PostgreSQL suites | Passed: 5 files and 21 tests against PostgreSQL 17 in an ephemeral Podman container. This includes the staged populated upgrade, concurrent signup/admin removal, audit rollback/survival, recovery-role preservation, and proxy/rate-limit checks. |
| Docker Compose exercise | Passed through an isolated Podman Docker-compatible service after the selected Rancher Desktop socket proved unavailable: fresh build/migration, CLI admin bootstrap, opening registration, public signup, app replacement, logical dump, deliberate deletion, clean restore, migration replay, recovery-epoch rotation, and restored login. Readiness reported `002_registration_admin.sql`; registration policy and both accounts survived. The isolated containers, network, database volume, dump, cookies, and response files were removed afterward. |
| Chromium functional journeys | Passed: 9 guest/offline/responsive checks plus 2 mocked registration/admin checks. Existing screenshot baselines differed and were not overwritten. |
| WebKit functional journeys | Passed: 7 guest/responsive checks (2 documented worker/offline skips) plus 2 mocked registration/admin checks. |
| Real account journeys | Passed in Chromium and WebKit: existing two-client sync/adoption/conflict/account switching plus public signup, admin demotion, held offline work, and restored upload. |
| Admin responsive/keyboard review | Passed in Chromium and WebKit at 375px and 1440px: no page overflow, direct access states, registration controls, modal focus entry and focus return. |

The migration tests staged `001_initial.sql`, inserted a populated account, then
apply `002`; the integration suites cover registration policy/default roles,
privileged-field rejection, authoritative session capabilities, read-only
receipt/adoption denial, admin authorization/CSRF, recovery secrecy, audit
events, and last-admin protection. They require `TEST_DATABASE_URL` and are not
were executed against PostgreSQL 17. The remaining infrastructure gap is the
documented full Compose fresh-install/container-replacement/backup-restore run.
