# meeplemark-web

A browser implementation of **Meeple N Mark / MeepleMark**, a board-game
scorepad. Guest work remains local in IndexedDB. A self-hosted Fastify/PostgreSQL
service adds operator-provisioned accounts, per-account browser workspaces,
offline-first synchronization, explicit conflict recovery, and deliberate copying
of guest data into an account.

The supported production deployment is a single-host Docker Compose stack behind
an operator-managed HTTPS reverse proxy. See the
[persistence architecture](docs/self-hosted-persistence.md),
[self-hosting guide](docs/self-hosting.md), and
[account/sync verification record](docs/accounts-sync-verification.md).

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
- `react-router-dom` for the route shell
- Workbox via `vite-plugin-pwa` for generated production precaching
- Playwright for Chromium/WebKit journeys and responsive screenshots
- Fastify + PostgreSQL for account-owned persistence and synchronization
- Docker/Compose for the production application, migrations, and database

No CDN scripts or fonts — everything is bundled through npm/Vite.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:server # API on http://localhost:8787 (requires PostgreSQL)
npm test           # vitest run — engine, ranking, tokens, storage
npm run build      # static bundle in dist/
npm run preview    # serve the build
npm run test:browser # production-preview journeys (Chromium + WebKit)
```

For account-backed local development, start PostgreSQL, run `npm run migrate`,
then run the API and Vite commands in separate terminals. Guest mode needs no
server. For a production installation and account provisioning, follow
[`docs/self-hosting.md`](docs/self-hosting.md).

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

### iOS parity and browser adaptations

The parity baseline is iOS commit `4b5300a`. The web app now includes direct
collection entry, confirmed play/player deletion, complete player metadata,
saved-player identity selection, unlinked history suggestions, category
reordering, manual override indicators, and explicit win/loss controls.

Phone browsers use labelled bottom navigation and single-player category
scoring by default. Larger layouts retain persistent top navigation and an
aligned, horizontally scrollable category table. Both scoring layouts use the
same draft state, ordered writes, retryable errors, durable completion, and
unfinished-number protection. See `docs/verification.md` for the source matrix
and `e2e/*-snapshots/` for rendered evidence.

Account-backed persistence is now implemented as a separate layer over the
completed parity UI. Accounts are created by an operator; there is no public
registration or email recovery. Signed-in work is saved to an account-specific
IndexedDB replica first and synchronized to PostgreSQL when the server is
reachable. Concurrent record edits require an explicit Use server / Keep mine
choice. Guest data is never uploaded automatically and remains available after
copying. BGG requests/authentication, general import/export, shared catalogues,
native synchronization/packaging, federation, groups, and live collaborative
editing remain out of scope. BGG usernames are metadata only.

## Offline use and hosting

Production builds generate a versioned application-shell precache. Registration
is limited to production on HTTPS (localhost is allowed for testing), and
“Ready for offline use” appears only after precaching succeeds. After that,
known app routes, including account and conflict routes, can reopen offline and
all core data operations continue to use IndexedDB. Previously activated account
workspaces can be used offline; first sign-in, setup, and unlocking after an
explicit logout require the server. Clearing browser/site data, private-mode
eviction, or browser storage pressure can remove unsynchronized local data.
Offline support is not a backup, and only server-acknowledged account records are
protected by PostgreSQL backups.

For a guest-only static deployment, the host must:

1. serve the build over HTTPS;
2. return `index.html` for these navigation routes only: `/`, `/play/*`,
   `/collection`, `/collection/*`, `/players`, `/account`, and `/conflicts`;
3. serve real assets with their normal status and MIME type—missing JS/CSS/image
   requests must remain 404s and must not receive `index.html`;
4. avoid caching `index.html`, `sw.js`, or `manifest.webmanifest` indefinitely;
   hashed files under `assets/` may be cached immutably.

Vite preview validates the production artifact and local fallback behaviour,
but it is not deployment verification. A fresh-browser deep-link check must be
run against the selected host so an existing service worker cannot mask a bad
rewrite rule.

The supported account deployment is not static hosting: use the application
service so the frontend and `/api/v1/*` share an origin. PostgreSQL must never be
exposed to browsers. Browser workspace isolation is not encryption against a
person who controls the same device/profile, and an offline browser cannot learn
that an operator revoked or deleted its account until it reconnects.

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
| `src/account/`, `src/sync/`, `src/adoption/` | Account workspaces, synchronization, conflicts, and guest-data adoption |
| `server/` | Fastify API, PostgreSQL migrations, sync/adoption protocol, and operator CLI |
| `docs/` | Self-hosting, recovery, persistence, and verification guidance |
| `golden/` | Golden corpus, copied from the MeepleMark Swift repo (see `SOURCE.md`) |
