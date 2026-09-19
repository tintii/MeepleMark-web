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
  `PlayValidation`, ported mechanically from the Swift source. Not yet wired
  into any UI error state.
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
- **Minimal UI shell** (`src/pages/`): three routes —
  - `/` — play list, sorted by date, with a "New Play" button.
  - `/play/new` — game name, dynamic player list, win direction, outcome
    mode.
  - `/play/:id` — plain-mode scoring: one score input per player, live
    rank via `evaluate()`, a "Complete" button.

### Not yet built

- Game collection screens (browse/add/remove, corpus vs. BGG vs. custom)
  and template authoring UI.
- Player directory UI.
- The scorepad/templated-play grid — category columns, the pinned +
  word-wrapped category label column, template application to a play.
- Template editor.
- Any BGG integration (reads, writes, the application token's local-only
  corpus-build usage).
- `PlayValidation`/`TemplateValidation` wired into the UI's error states —
  they exist and are tested, but the UI doesn't call them yet.
- Accessibility pass (the Swift side's greyscale-attributability and
  contrast-ratio guarantees are ported as logic/tokens, not yet audited in
  the rendered UI).
- The visual polish the iOS app has — this shell proves the wiring, not the
  design.

## Repository layout

| Path | Contents |
|---|---|
| `src/engine/` | Ported scoring engine, ranking, validation, models, decimal codec |
| `src/tokens/` | Design tokens as TS constants, `assignRoster()` |
| `src/styles/` | CSS custom properties (`tokens.css`) and shell layout (`shell.css`) |
| `src/storage/` | IndexedDB storage (`idb`) |
| `src/pages/` | The three-route minimal UI shell |
| `golden/` | Golden corpus, copied from the MeepleMark Swift repo (see `SOURCE.md`) |
