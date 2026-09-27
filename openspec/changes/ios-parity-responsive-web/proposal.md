## Why

MeepleMark-web implements the main scoring flows but omits user-facing functionality already available in the iOS app. Complete the port and give it the same recognizable visual identity with a phone-first browser experience that also works comfortably on desktop.

## What Changes

- Establish feature parity against MeepleMark iOS commit `4b5300a`, covering all existing screens and interactions, with an explicit verification matrix.
- Add direct collection entry, individual play deletion, complete player editing/deletion, saved-player selection with identity references, and suggestions from unlinked historical plays.
- Add score-sheet category reordering, visible manual rank indicators, and an accessible single-player scoring layout alongside the grid.
- Preserve exact scoring, live evaluation, sticky overrides, template snapshots, draft resumption, and historical names. Make the already-selectable cooperative/solo outcome usable through explicit win/loss controls; this closes an existing UI gap shared with iOS rather than changing the engine.
- Adapt the iOS navigation, grouped forms, typography, colours, and player markers for phone and desktop browsers, including keyboard navigation, zoom, safe areas, and accessible dialogs.
- Make completion wait for durable saving, expose recoverable write failures, and prevent pending writes from undoing newer edits or resurrecting deleted plays.
- Support offline reopening after the first successful app-shell cache, including direct play URLs, without accounts or a backend.

## Capabilities

### New Capabilities

These are new specification baselines in this repository; some describe existing behaviour that this change must retain.

- `play-history-and-collection`: History, deletion, direct collection management, game details, and game suggestions.
- `player-directory-and-selection`: Full player management, saved/recent suggestions, and historical identity preservation.
- `score-sheet-editing`: Category editing/reordering, validation, versioning, and immutable play snapshots.
- `reliable-scoring`: Exact evaluation, explicit outcomes, durable completion, and recoverable persistence.
- `responsive-app-shell`: iOS-aligned visual language, navigation, forms, accessibility, and responsive browser behaviour.
- `adaptive-scorepad`: Plain and category scoring layouts that work on phones, desktop, and enlarged text.
- `offline-browser-use`: Cached application shell, offline routes and local workflows, and safe application updates.

### Modified Capabilities

None. There are no existing specs under `openspec/specs/`.

## Impact

Touches `src/pages/`, `src/components/`, `src/App.tsx`, `src/styles/`, `src/tokens/`, `src/storage/db.ts`, and `src/draft/`. Adds production service-worker registration/caching and browser-level tests alongside existing Vitest coverage. Keeps React, Vite, TypeScript, decimal.js, IndexedDB, existing URLs, and stored data compatible; no backend or domain-schema replacement is planned. Adds development/build tooling only where needed for browser tests and generated cache manifests.

BGG network integration, cross-device sync, import/export, a new game catalogue, native packaging, and changes to the Swift app are outside this change. BGG usernames remain local player metadata. No application implementation is included in these proposal artifacts.
