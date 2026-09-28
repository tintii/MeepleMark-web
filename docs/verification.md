# iOS parity verification

This document records the guest/local parity baseline. Account, synchronization,
PostgreSQL, and container acceptance are recorded separately in
[`accounts-sync-verification.md`](accounts-sync-verification.md); do not infer
server coverage from the parity results below.

## Baselines

- Web revision before this change: `0ce1fe91c8406cf5168b420ef27e47ddba5e6c9f`
- iOS observable-behaviour baseline: `4b5300a`
- Baseline captured: 2026-09-25
- Runtime: Node `22.20.0`, Vite `8.3.0`, TypeScript `6.0.2`
- Existing-version data fixture: `tests/fixtures/existing-indexeddb.json`

The fixture uses the version-1 `meeplemark` IndexedDB store shapes. It contains
an owned game and player, a plain play with nullable references, and a category
play with an embedded template snapshot plus manual total and rank overrides.
The compatibility tests import it without a database reset or migration.

### Baseline commands

| Command | Result before implementation |
|---|---|
| `npm test` | Passed: 8 files, 105 tests |
| `npm run lint` | Passed with 6 existing React effect warnings |
| `npm run build` | Passed; 50 modules transformed |

An initial attempt before `npm ci` reported the expected missing local binaries;
the results above are the baseline after the lockfile dependencies were installed.

## Source-to-capability checklist

Legend: **Parity** is an iOS flow implemented on the web, **Browser adaptation**
is equivalent browser-specific behaviour, and **Repair** is the explicit
flagged-outcome UI repair shared with the iOS gap described in the design.

| iOS screen / source | Verification | Capability | Kind |
|---|---|---|---|
| `ContentView.swift` | Plays, Collection, and Players are persistent desktop navigation and labelled phone bottom navigation; direct URLs and back/forward remain usable | responsive-app-shell | Browser adaptation |
| `PlayListView.swift`, `PlayRowView.swift` | Recent-first rows show game/date/count/status, completed winners only, unreadable records, and confirmed individual deletion | play-history-and-collection | Parity |
| `CollectionView.swift` | Owned games sort alphabetically; direct entry rejects blanks, reuses case-insensitive matches, and allows never-played games | play-history-and-collection | Parity |
| `GameDetailView.swift` | History, score-sheet summary/editor, prefilled Add Play, membership add/remove, and unreadable rows remain reachable | play-history-and-collection | Parity |
| `PlayerDirectoryView.swift`, `PlayerEditView` | Create/edit/delete covers display name, optional BGG username, automatic/eight colours, validation, and identity labels | player-directory-and-selection | Parity |
| `NewPlayView.swift` | Saved players retain IDs; recent names have no IDs; duplicate names remain distinct; unlinked recent games are suggested; template selection is explicit | player-directory-and-selection, play-history-and-collection | Parity |
| `TemplateEditorView.swift` | One-to-ten categories can add/edit/remove/move; validation is retained; real changes version and no-op saves do not | score-sheet-editing | Parity |
| `ScoringView.swift` | Plain scoring reflows, preserves exact decimals and sticky overrides, shows textual manual rank state, and durably completes | reliable-scoring, adaptive-scorepad | Parity + browser adaptation |
| `ScorepadGridView.swift` | Shared-state Grid/Single player modes preserve buffers; desktop table aligns wrapped rows and phone mode exposes all controls | adaptive-scorepad | Parity + browser adaptation |
| `WinnerSummary.swift`, `PlayDraft.swift` | Engine evaluation remains authoritative; saves are ordered/retryable and completion awaits durable persistence | reliable-scoring | Browser adaptation |
| `GameQuery.swift`, `PlayQuery.swift`, `Player.swift`, `Game.swift` | Bounded suggestions, metadata updates/deletion, immutable historical documents, snapshots, and collection semantics match | history, players, score sheets | Parity |
| Outcome selectors in both scoring views | Ranked mode uses rank controls; flagged mode uses explicit unset/win/loss controls and engine summaries | reliable-scoring | Repair |

## Seven-capability acceptance

- [x] **play-history-and-collection** — deletion, direct collection entry,
  game detail flows, recent/unlinked suggestions, and corrupt-row isolation.
- [x] **player-directory-and-selection** — complete metadata editing, deletion,
  historical preservation, referenced selections, duplicates, and typed clearing.
- [x] **score-sheet-editing** — accessible reorder, validation/version rules,
  explicit application, immutable snapshots, and atomic initial persistence.
- [x] **reliable-scoring** — golden engine, sticky overrides, flagged outcomes,
  ordered/retryable saves, durable completion, and guarded navigation/deletion.
- [x] **responsive-app-shell** — shared visual language, adaptive navigation,
  320–1440 widths, zoom/reduced motion, labels/focus, and modal semantics.
- [x] **adaptive-scorepad** — shared Grid/Single state, aligned desktop rows,
  phone-friendly plain/category entry, negative decimals, and buffer retention.
- [x] **offline-browser-use** — generated production precache, route-safe fallback,
  IndexedDB-only data, update safety, and documented HTTPS/hosting contract.

## Environmental validation

- Physical phone browser smoke test: pending; no device is attached to this
  workspace. Browser emulation is recorded separately and is not a substitute.
- Deployment-host deep-link check: pending until a host is selected. The local
  production-preview check validates the artifact and documented fallback only.
- WebKit offline network toggle: the Playwright Linux fallback build reports an
  internal error on forced offline reload. Chromium verifies the generated
  worker’s offline root/nested reload, IndexedDB edit/reload, and missing-asset
  behaviour; WebKit verifies full online journeys, direct links, and responsive
  layouts.

## Final verification results

- Unit/storage/engine suite: 10 files, 115 tests passed.
- Lint: passed with no warnings.
- Production build: generated `sw.js`, Workbox runtime, manifest, and eight
  precache entries with no remote runtime assets.
- Browser coverage: full plain and templated/flagged journeys in Chromium and
  WebKit; storage failure/retry and delayed rapid edits; corrupt and existing-v1
  records; direct links and history navigation; Chromium offline nested reload.
- Responsive coverage: every route at 320, 390, 768, and 1440 CSS pixels in both
  browser projects; enlarged text, light/dark, reduced motion, and representative
  screenshots.
- Final Playwright result: 30 passed, 2 explicitly skipped for the documented
  Linux-WebKit offline/worker-lifecycle harness limitation.
