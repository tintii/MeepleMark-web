## Context

The web app is a standalone React/Vite frontend backed by three IndexedDB stores. Its decimal engine, player identity assignment, validation, template snapshots, and draft mutations were ported from Swift. Its UI is functional but incomplete. This design uses the fetched iOS `origin/master` commit `4b5300a` as a fixed parity baseline; the sibling checkout's working tree is older and must not be mistaken for the reference app.

Reference source paths below are relative to that commit in `MeepleMark`, not necessarily present in its current working tree. The baseline was inspected with `git show`. Browser improvements supplement parity where native controls or installation provide behaviour the web must implement explicitly.

| iOS reference | Current web coverage / required work | Acceptance capability |
|---|---|---|
| `App/Sources/MeepleNMark/ContentView.swift` | Three destinations exist; add phone bottom navigation and desktop layout | responsive-app-shell |
| `Views/PlayListView.swift`, `PlayRowView.swift` | List, resume, winners exist; add play deletion and preserve unreadable rows | play-history-and-collection |
| `Views/CollectionView.swift` | Owned list exists; add direct game entry and browser-accessible removal | play-history-and-collection |
| `Views/GameDetailView.swift` | History, template entry, prefilled new play, membership actions exist; preserve all flows | play-history-and-collection |
| `Views/PlayerDirectoryView.swift` including `PlayerEditView` | Add/rename exist; add username editing, colour preference, swatches, deletion | player-directory-and-selection |
| `Views/NewPlayView.swift` | Typed entry and recent suggestions exist; add saved-player references and unlinked game suggestions | player-directory-and-selection, play-history-and-collection |
| `Views/TemplateEditorView.swift` | Validation, save/delete exist; add category reordering | score-sheet-editing |
| `Views/ScoringView.swift` | Core scoring exists; add manual rank labels, phone layout, reliable saving | reliable-scoring, adaptive-scorepad |
| `Views/ScorepadGridView.swift` | Grid exists; add single-player mode, robust row alignment and manual rank labels | adaptive-scorepad |
| `Support/WinnerSummary.swift`, `Persistence/.../PlayDraft.swift` | Preserve evaluation and completion semantics; await browser writes | reliable-scoring |
| `Persistence/.../GameQuery.swift`, `PlayQuery.swift`, `Player.swift`, `Game.swift` | Complete relevant UI/query support without changing document invariants | history, players, score sheets |

The `Views/` and `Support/` entries above abbreviate `App/Sources/MeepleNMark/`; `Persistence/.../` abbreviates `Persistence/Sources/MeepleNMarkPersistence/`.

## Goals / Non-Goals

**Goals:**

- Deliver every existing iOS user-facing flow with equivalent data behaviour.
- Preserve the shared engine contract and existing browser records.
- Make phone scoring comfortable, with desktop and keyboard support treated as first-class requirements.
- Preserve iOS visual hierarchy and design tokens while using appropriate browser controls.
- Support trustworthy saves, accessible interactions, and offline reopening after caching.

**Non-Goals:**

- BGG requests/authentication/publishing, cloud sync, accounts, import/export, corpus search, native packaging, or modifying the Swift app.
- Copying iOS defects, adding formulas or nested categories, changing golden scoring results, or redesigning the domain model.
- A statistics product merely because the Swift persistence package exposes an aggregate query.
- Pixel-identical native controls across operating systems or an install prompt as a prerequisite for use.

## Decisions

### 1. Preserve the existing architecture and pin parity to observable workflows

Keep the engine and pure draft mutations as the behavioural source of truth. Extend storage/query APIs and route components; factor common completion and score controls where both layouts need identical behaviour. Use the matrix above and the seven specs to track parity rather than mechanically reproducing every internal Swift API. Validate golden fixtures unchanged.

The alternative of rewriting the app or mirroring SwiftData's JSON-column plumbing adds migration risk without user benefit. The new specs also baseline existing behaviours so a visual rewrite cannot silently remove them.

### 2. Complete storage operations without rewriting history

Add storage operations for deleting a play, updating player metadata, and deleting a player. Add a bounded query for game names on plays lacking a game reference, using the iOS limit of 200 recent unlinked plays. Keep recent player names bounded to the latest 20 plays. Reuse `findOrCreateGame` for direct collection entry; it performs exact then case-insensitive lookup and does not implicitly mark other games owned.

Player editing updates only the directory record. Historical `name`, `playerRef`, scores, and template snapshots remain unchanged after directory edits or deletion. Colour preference is directory metadata, displayed in the player directory; scoring keeps the existing per-roster identity assignment, matching iOS. Do not introduce live name/colour dependencies into historical plays.

Extend new-play input from bare names to seat selections carrying `name` and nullable `playerRef`, keeping existing callers compatible until migrated. Saved-player suggestions carry explicit IDs; typed historical names carry no ID. Typing over a selected seat clears its reference even if the typed name equals another saved player's name. Duplicate display names must remain distinct directory choices, with stable IDs and optional username context; never infer identity from text alone. This is more robust than copying iOS's name-keyed suggestion map.

No store or document migration is currently required: all new persistent fields already exist. If indexes prove necessary, add them through a versioned, non-destructive upgrade and test existing data; do not reset the database.

### 3. Keep score-sheet editing and play snapshots separate

Provide explicit Move up / Move down controls usable by touch and keyboard; drag-and-drop is optional and cannot be the only reorder interaction. Preserve the existing one-to-ten category validation, label-to-key rules, no-op save behaviour, and version increments for real changes, including order changes. Editing or deleting a game's sheet affects future plays only.

Starting a templated play must persist its complete snapshot and template rules before navigating. Construct and validate the final document before the initial write so failed template persistence cannot leave a misleading plain draft. Plain mode remains the default; matching a game never applies a sheet automatically.

### 4. Make persistence state explicit

Refactor the draft hook to expose load errors separately from save status (`saved`, `saving`, `error`) and retry. Apply mutations against the latest in-memory draft, serialize writes for each play, and track the revision acknowledged by storage. Only a successful latest revision clears a save error. Route changes must not apply a previous play's load/save result to the newly opened play.

`complete()` returns an awaitable result. Flush preceding edits and commit the completed document before opening the collection offer or recorded dialog. Disable duplicate completion while pending. On failure, retain the user's input, surface a retry, and never claim success. Collection-add failures retain the offer with retry and Not now choices; the already-saved play remains complete. Share this orchestration between scoring layouts.

Deletion drains or cancels writes for that play before deleting, so late writes cannot recreate it. During in-app navigation, finish pending valid saves before leaving; if saving fails, present Retry and an explicit Leave without saving choice. For tab close/reload, use the browser's best-effort unsaved-change prompt while a save is pending/failed; do not claim the browser guarantees delivery after process termination. Warn before leaving with unfinished numeric text rather than silently treating the old persisted number as the latest entry.

An uncoordinated promise per edit is simpler but can lose acknowledged ordering and gives the current false-success completion behaviour. Cross-tab simultaneous editing conflict resolution is outside this change; sequential reopening/reloading must show persisted data.

### 5. Retain engine semantics and make selectable outcomes usable

Use engine evaluation for totals, ranks, warnings, and winner sentences. Keep partial numeric text in view state while typing and exact decimal strings in storage. Manual total and rank overrides remain sticky, visibly marked, and explicitly clearable. Clearing a rank restores automatic ranking; Recompute restores the calculated category total.

Both plain and category layouts expose win/loss controls for flagged outcomes, without rank inputs. This repairs an existing shared UI omission: both apps expose the outcome in templates, and the web also exposes it during plain creation, but no scoring view calls `setWin`. Unset results stay unset until explicitly chosen. No new outcome mode or scoring rule is introduced.

### 6. Adapt the iOS shell for browsers

Use shared page headers, grouped sections, list rows, form fields, action styles, and dialogs. Preserve semantic colours, the eight player accents with their foregrounds, restrained score tables, tabular numerals, and system typography. Use the existing product identity definition for display naming. Add named tokens for any necessary touch sizes, layout widths, focus indicators, and motion; honour dark appearance and reduced motion.

Phones use a labelled bottom navigation bar for Plays, Collection, and Players, with safe-area padding and content clearance. Larger viewports use a persistent top navigation with bounded forms and wider scoring content. Keep semantic links, existing route URLs, browser back/forward, and in-app parent navigation for direct links. Editing screens can remain routes; recreating every native sheet is unnecessary.

Use a shared accessible dialog built on native `<dialog>` where supported by the target browsers, with explicit accessible naming, initial focus, focus return, Escape/cancel behaviour, and pending-action protection. Native browser semantics are preferable to the present untrapped overlay. No swipe-only or hover-only action may gate functionality. Main controls target at least 44 by 44 CSS pixels, text fields use readable sizing, and sticky elements must not obscure focused controls.

### 7. Support grid and single-player scoring from one state model

Offer a visible Grid / Single player switch for category scoring. Default to Single player on narrow viewports (initial threshold 40rem), and Grid where space permits. Choose the automatic layout using available width in relative units so zoom/enlarged text can trigger reflow; always retain an explicit user choice. Keep all player values and partial input buffers above the layout switch so switching players or layouts loses nothing.

In Single player mode show Previous/Next, current player and position, vertically listed categories, total, and outcome controls. On desktop use a semantic table with sticky category cells inside one horizontal scroll container so row heights are shared across wrapped labels and score cells. This replaces independently sized columns that can drift out of alignment. Horizontal scrolling is confined to the grid; the page itself must fit its viewport. Plain scoring uses compact rows on desktop and stacked player sections when necessary on phones.

The alternative of merely shrinking the existing grid harms both touch entry and enlarged-text use. Browser settings cannot be treated as a direct equivalent of iOS Dynamic Type, hence automatic reflow plus a manual switch. Final breakpoint tuning follows rendered testing, not device-name detection.

### 8. Cache only the application shell for offline reopening

Generate a production precache manifest from the Vite build output and register a scoped service worker on HTTPS/localhost. Cache the HTML shell and bundled assets; use a same-origin navigation fallback for known app routes. Never substitute HTML for missing asset requests. IndexedDB remains the sole user-data store; cache cleanup must only remove this app's outdated shell caches.

Use a maintained build-time precache integration or generated manifest, selected during implementation after checking the installed Vite version's supported integration. Do not hand-maintain hashed asset lists. A small integration is preferable to adopting a new application framework. Registration stays off in normal development, with offline tests against the production preview.

Do not force a worker activation/reload during an open scoring session. Allow updates after a safe reload or explicit acceptance once pending edits have saved, and clean outdated caches only when safe for clients using the old shell. Show offline readiness only after the shell is actually cached. The first ever visit still requires connectivity. Offline support does not imply cross-device sync or guaranteed persistence after browser data is cleared.

### 9. Verify at the behaviour and rendered-UI boundaries

Keep existing Vitest engine/storage tests and add targeted cases for new data operations, player identity selection, sheet ordering/snapshots, and delayed/failed saving. Add browser automation (Playwright preferred) for full journeys in Chromium and WebKit, production offline reloads, direct links, keyboard dialogs, and responsive layouts.

Use 320, 390, 768, and 1440 CSS-pixel viewport widths, light/dark appearance, reduced motion, and 200% text/zoom checks. Include five players with ten categories, long labels/names, negative and decimal scores, ties, manual overrides, and flagged outcomes. Save representative screenshots as review evidence. Compare the visual hierarchy against the SwiftUI source; real iOS screenshots, when available, improve comparison but do not block implementing the documented structure. Actual phone keyboard and browser chrome behaviour require a device smoke test; browser emulation must not be presented as that evidence.

## Risks / Trade-offs

- Browser data/cache eviction → Describe offline readiness accurately; keep failures visible and avoid promising native installation durability.
- Service-worker version skew → Use generated manifests, controlled activation, and tests with an old open client plus a new build.
- Layout switches dropping partial edits → Own buffers above both layouts and test switching before a number is fully entered.
- Long labels misaligning the score grid → Use shared table rows and sticky cells; test multi-line labels.
- Pending saves outliving navigation/deletion → Coordinate writes and deletion by play ID; exercise delayed and rejected writes.
- Visual similarity cannot be proven from SwiftUI alone → Record the source baseline and rendered web screenshots; report any missing device comparison honestly.
- Full parity spans several routes → Implement in ordered slices while keeping every requirement in the release acceptance matrix.

## Migration Plan

1. Record baseline test/build results and an existing-version IndexedDB fixture before implementation.
2. Add storage/query and draft-persistence behaviour, retaining old records and route URLs.
3. Add missing interactions, shared shell components, and adaptive scoring layouts.
4. Add and verify production caching; document static-host navigation fallback and HTTPS requirements.
5. Run the full acceptance matrix and update the README with supported behaviour and remaining environmental test limitations.

This proposal does not authorize publishing/deployment. For a later release, rollback uses a compatible previous app build and a worker update that preserves IndexedDB; never delete user stores or site-wide caches to resolve a shell problem. Existing cached clients must be considered in the release procedure.

## Open Questions

No product-scope decisions block implementation. The static hosting provider and availability of physical iOS/Android test devices are not known. Keep routing/caching deployment guidance provider-neutral and report device checks as pending if hardware is unavailable. The offline integration package and exact responsive breakpoints are implementation choices to validate against the installed build tools and rendered layouts.
