# Accounts and synchronization verification

## Migration baseline

Captured on 2026-09-26 before implementing `self-hosted-accounts-and-sync`.

- Git base: `0ce1fe9 feat: game collection, template editor, player directory, scorepad grid`
- Existing iOS-parity work is intentionally retained as a dirty workspace; no
  tracked or untracked files were reset before this change was applied.
- Runtime: Node `22.22.2`, npm `10.9.7`, Vite `8.3.0`, TypeScript `6.0.2`.
- Version-1 IndexedDB fixture: `tests/fixtures/existing-indexeddb.json`.
- Fixture SHA-256:
  `1b1a231e7cf9f8060dc86d236d667bfdc188e1b8e5637058103ec0c4b02f49f4`.
- The fixture remains a version-1 `meeplemark` database with `games`,
  `players`, and `plays` stores. It covers nullable references, embedded score
  sheet snapshots, exact decimal strings, and manual total/rank overrides.

### Baseline results

| Command | Result |
|---|---|
| `npm test` | Passed: 10 files, 115 tests |
| `npm run lint` | Passed with no warnings |
| `npm run build` | Passed: 58 modules transformed; production service worker generated with 8 precache entries |

The pre-existing workspace inventory at capture time is available from Git:
tracked changes remain visible through `git diff`, while the iOS-parity source,
tests, documentation, and OpenSpec artifacts that were already untracked remain
in place. This record deliberately does not duplicate or normalize those edits.

## Acceptance verification — 2026-09-27

Environment: macOS arm64, Node `25.7.0`, npm `11.10.1`, OpenSpec `1.6.0`,
Docker CLI `28.1.1-rd`, Docker Engine `27.3.1`, and Compose `2.37.1` through
Rancher Desktop. Dependencies were installed from the committed lockfile with
`npm ci`; npm reported one low-severity development-tree audit finding. The
production-only image install reported zero vulnerabilities. No automatic audit
rewrite was applied during acceptance.

| Check | Actual result |
|---|---|
| `npm run lint` | Passed with no diagnostics. |
| `npm test` | Passed: 15 files and 128 tests; 4 files/15 tests were skipped in this general run because they require `TEST_DATABASE_URL`. |
| `npm run test:integration` | Passed against PostgreSQL 17: 4 files, 15 tests. |
| `npm run build` | Passed: browser TypeScript, server TypeScript/bundle, 72 Vite modules, and PWA generation with 8 precache entries. |
| Chromium browser coverage | Guest/offline/responsive functional run passed 17 tests with the account journey gated; the separately enabled PostgreSQL account journey passed. |
| WebKit browser coverage | Guest functional run passed 9 tests with 4 suite-declared worker/offline skips; the separately enabled PostgreSQL account journey passed after using macOS WebKit's Option+Tab convention for button focus. |
| Visual browser assertions | The committed visual baselines are Linux-specific. Darwin execution generated no comparable committed baseline, so Linux CI remains authoritative for the 5 visual cases per browser. |
| `openspec validate self-hosted-accounts-and-sync --strict` | Passed with OpenSpec 1.6.0. |
| Production image and Compose | Passed: multi-stage app/migration image built; migration exited successfully; PostgreSQL and app became healthy; runtime user was `node`; `/health/ready` reported schema `001_initial.sql`; `/account` returned 200; missing API and asset paths returned 404; PostgreSQL had no host-published port. |

The initial all-project browser attempt also established that a missing WebKit
binary and missing platform baselines fail visibly rather than being silently
accepted. After installing the lockfile-compatible WebKit runtime, isolated
functional reruns produced the results above. Account projects must not share a
single rate-limited API process in parallel: four setup operations from the two
journeys plus earlier attempts can legitimately reach the five-per-15-minute
setup limit. The final WebKit account rerun used a fresh API process and one
worker.

These checks validate a fresh image and runtime smoke path. The deeper populated
container-replacement and logical restore exercise is recorded by task 8.4 and
must still be repeated for each release environment and backup policy. Linux CI
remains the authority for the committed Chromium/WebKit screenshot baselines.
