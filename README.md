# meeplemark-web

A frontend-only browser port of **Meeple N Mark / MeepleMark**, an iOS
board-game scorepad. No backend, no server code, no accounts — everything
runs in the browser, and data is stored locally in IndexedDB.

This is a fresh, standalone repository, not a subdirectory of the Swift
project. The scoring engine, ranking rules, design tokens, and storage
shapes are ported from that project (see `golden/SOURCE.md` for the golden
corpus's provenance), but nothing here depends on Swift at build or run
time.

## Stack

- Vite + React + TypeScript
- Vitest for tests
- Plain CSS with custom properties for design tokens (no CSS framework)
- `decimal.js` for exact decimal arithmetic (scores are never plain JS
  numbers)
- `idb` for IndexedDB storage
- `react-router-dom` for the three-route shell

No CDN scripts or fonts — everything is bundled through npm/Vite.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest run — engine, ranking, tokens, storage
npm run build      # static bundle in dist/
npm run preview    # serve the build
```

## Status

### Ported / built

- **Engine** (`src/engine/`): `evaluate()`, `total()`, `recompute()`,
  `standardCompetitionRanks()`, `anomalyWarnings()` — ported from the Swift
  `MeepleNMarkEngine` package. All decimal arithmetic uses `decimal.js`;
  `src/engine/decimal.ts` mirrors the Swift `DecimalCoding` string format
  exactly (decimal strings only, no exponents, no bare `.5`/`8.`).
- **Golden corpus** (`golden/cases/*.json`, copied verbatim from the Swift
  repo): `src/engine/goldenCorpus.test.ts` runs every case through
  `evaluate()` and checks totals, ranks, win flags, and warning codes
  against `expected`. All cases pass.
- **Validation** (`src/engine/validation.ts`): `TemplateValidation` and
  `PlayValidation`, ported mechanically from the Swift source.
  `TemplateValidation` is wired into the template editor's pre-save check
  (`src/draft/templateCandidate.ts`); `PlayValidation` still runs only where
  it always did, inside `writePlay`, and its thrown error now surfaces as a
  visible message on the scoring screens instead of an unhandled rejection.
- **Design tokens** (`src/styles/tokens.css`, `src/tokens/index.ts`):
  semantic colours, spacing/radius scales, the 8-colour player palette, and
  `assignRoster()`'s marker/colour-assignment algorithm, all ported from
  `DesignTokens/`. Typography *sizes* are new for this web port — the Swift
  source only named the styles (`displayLarge`, `tableNumeral`, ...), never
  defined concrete point sizes; `tableNumeral` keeps its `tabular-nums`
  requirement.
- **Storage** (`src/storage/db.ts`): three IndexedDB stores (`games`,
  `players`, `plays`) via `idb`. `addToCollection`/`removeFromCollection`,
  `setTemplate`/`deleteTemplate` (with version-bump-on-real-change and
  slug/key derivation ported from `Game.swift`), `representSameGame`/
  `representSamePlayer`, and a `readPlay`/`writePlay` pair that validates
  against `PlayValidation` and throws a typed `PlayReadError` on corruption
  — deliberately simplified relative to the Swift version (plain nested
  objects, not a JSON-string column; that indirection was SwiftData-only
  plumbing).
- **Query/draft logic layer** (`src/storage/db.ts`, `src/draft/`): ported
  from `Persistence`'s `GameQuery`/`PlayQuery`/`PlayDraft`. `findOrCreateGame`/
  `existingGameByName` (exact match, then case-insensitive fallback, never
  touching `ownedAt`), `quickPickGames`, `recentGameRefs`,
  `recentPlayerNames`, `playsForGame`, and `listPlaySummaries` (row-ready
  summaries, including the "Unreadable" fallback for a corrupted document)
  live in `db.ts`. The mutation semantics — `parseDecimalField`, `setScore`,
  `setCategoryValue` (never touches `total`/`totalIsOverridden`),
  `recomputeTotal` (routes through the engine's `recompute`, never
  reimplements the sum), `applyTemplate`, `setRank`, `setWin`, `complete` —
  are pure functions in `src/draft/playDraft.ts`, wrapped with
  write-through persistence by the `usePlayDraft` hook
  (`src/draft/usePlayDraft.ts`). `evaluation` is always `evaluate(play)` —
  never computed by hand.
- **Winner summary** (`src/engine/winnerSummary.ts`): `winnerNames`/
  `winnerSummarySentence`, ported from `WinnerSummary.swift`. Shared by the
  play list, a game's play history, and both scoring screens' completion
  confirmation.
- **Full route set** (`src/pages/`, wired in `src/App.tsx`, with a
  Plays/Collection/Players nav shell):
  - `/` — play list: game, date, player count, status, and — only once
    `complete` — the winner line. A draft never claims a result.
  - `/collection` — owned games, alphabetical.
  - `/collection/:gameId` — a game's plays, Add Play (pre-fills the game
    name), score-sheet summary + editor link, and — only when owned — a
    destructive "Remove from collection" in the page body with a
    confirmation dialog (never a toolbar icon).
  - `/collection/:gameId/template` — the score-sheet editor: 1-10 category
    labels, win direction, default outcome, `TemplateValidation` run before
    save, "Delete score sheet".
  - `/players` — saved-player directory: add (name + optional BGG
    username, no network call), rename.
  - `/play/new` — game name with quick-pick suggestions (`<datalist>` +
    recent-game lookup), an offer to apply a matched game's score sheet,
    dynamic player inputs with recent-name suggestions, win direction,
    outcome mode.
  - `/play/:id` (`PlayRoute`) — routes to plain scoring or the scorepad
    grid based on `play.scoring !== null`, mirroring
    `PlayListView.swift`'s branch exactly (a real bug on the iOS side when
    it was missing).
    - Plain scoring (`PlayScoring.tsx`): marker badge, name, rank field
      (placeholder = computed rank; typing sets a sticky override), score
      field, live warnings, two-step completion (collection offer, then
      "Play recorded" with the winner sentence).
    - Scorepad grid (`PlayScorepadGrid.tsx`): categories as rows, players
      as columns. The category-label column is a CSS sibling of the
      horizontally-scrolling player region, not a child of it, so it
      stays pinned rather than scrolling away; labels wrap instead of
      truncating (no ellipsis/line-clamp anywhere in that column).

### Not yet built

- Any BGG integration (reads, writes, the application token's local-only
  corpus-build usage) — out of scope for this phase, and not yet built on
  the iOS side either.
- Accessibility pass (the Swift side's greyscale-attributability and
  contrast-ratio guarantees are ported as logic/tokens; the marker badge's
  letter channel is wired into the UI, but there's been no rendered-UI
  audit — screen reader labeling, focus order, dialog trapping, etc.).
- The visual polish the iOS app has — this phase proves the wiring and the
  UX contract (routing, pinning, confirmation flows), not pixel-level
  design. The one-player-per-screen accessibility-text-size layout for the
  scorepad grid (`ScorepadGridView.swift`'s `onePlayerPerScreenBody`) has no
  web equivalent yet.

## Repository layout

| Path | Contents |
|---|---|
| `src/engine/` | Ported scoring engine, ranking, validation, models, decimal codec, winner summary |
| `src/tokens/` | Design tokens as TS constants, `assignRoster()` |
| `src/styles/` | CSS custom properties (`tokens.css`) and shell layout (`shell.css`) |
| `src/storage/` | IndexedDB storage and queries (`idb`) |
| `src/draft/` | Play-draft mutation semantics (pure) and the `usePlayDraft` hook |
| `src/components/` | Shared UI: play row, marker badge, dialog |
| `src/pages/` | Routes: plays, collection, game detail, template editor, players, new play, scoring (plain + scorepad grid) |
| `golden/` | Golden corpus, copied from the MeepleMark Swift repo (see `SOURCE.md`) |
