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

