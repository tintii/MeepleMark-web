## 1. Export Contract and Snapshot

- [x] 1.1 Add the version-1 `meeplemark-workspace` envelope type and a pure serializer that validates every shared game, player, and canonical play document, sorts copies deterministically, preserves persisted values, and emits indented JSON with a trailing newline; unit-test populated, empty, exact-value, deterministic-order, and bounded multi-error cases.
- [x] 1.2 Add a read-only storage operation that captures games, players, and canonical play documents in one IndexedDB transaction without touching account-only stores; test complete owned/unowned record coverage, logical play extraction, transactional consistency, and absence of outbox or domain writes.

## 2. Account Export Experience

- [x] 2.1 Add an `Export workspace` section to both guest and signed-in Account views that creates and revokes an `application/json` Blob download named `meeplemark-workspace-YYYY-MM-DD.json`, with loading state and actionable failure feedback.
- [x] 2.2 Explain beside the action that the file contains private collection, player, and play data; keep export enabled for read-only accounts and offline use, and verify labelled controls, status/error semantics, keyboard operation, and 375 CSS-pixel layout using existing components and styles.

## 3. Browser Acceptance

- [x] 3.1 Add a guest browser journey that exports a populated workspace offline and verifies the versioned file contains collection membership, a saved score sheet, players, drafts/completed plays, relationships, and exact scoring snapshots without issuing a network request.
- [x] 3.2 Add account-browser coverage proving writable, read-only, and admin users export only the active local workspace, pending local content is included, no outbox/sync state changes, and an unreadable record produces no partial download.

## 4. Documentation and Verification

- [x] 4.1 Document workspace export and its JSON envelope in the user manual, remove the fulfilled export item from the roadmap while retaining import as a future direction, distinguish personal exports from operator PostgreSQL backups, and add an `[Unreleased]` changelog entry.
- [x] 4.2 Run focused unit and browser tests, then `npm test`, `npm run lint`, `npm run build`, the relevant browser suite in Chromium and WebKit, `openspec validate export-workspace-data --strict`, and `git diff --check`; record any unavailable check accurately.
