## 1. Baseline and acceptance coverage

- [x] 1.1 Record the web revision, iOS baseline `4b5300a`, existing test/lint/build results, and a representative existing IndexedDB fixture; verify the fixture covers plain/category plays, snapshots, overrides, and nullable references.
- [x] 1.2 Turn the design's source-to-capability matrix into a verification checklist covering every existing iOS screen and the seven specs; distinguish implemented parity, browser adaptations, and the flagged-outcome repair.
- [x] 1.3 Add browser-test tooling and a production-preview harness with independent test databases, controlled storage failure/delay, Chromium and WebKit projects, and viewport/screenshot support.

## 2. Storage and query parity

- [x] 2.1 Add individual play deletion and tests proving other plays, games, sheets, and players are preserved; verify history and recent suggestions reflect deletion.
- [x] 2.2 Add validated player metadata updates and deletion; test name validation, optional username/colour clearing, and unchanged historical play documents.
- [x] 2.3 Add bounded unlinked-game name suggestions and saved/recent player suggestion composition; verify ordering, limits, duplicate display names, and corrupt-record handling.
- [x] 2.4 Extend new-play creation to accept explicit seat references and an optional selected template, persisting the final play once; test reference/name pairing and no leftover plain draft after a failed templated save.
- [x] 2.5 Use unreadable-safe summaries for both main and game-specific history; verify one corrupt play does not hide other entries or invent scores.

## 3. Shared shell and accessible controls

- [x] 3.1 Add shared page headers, grouped sections, list/form/action styles, product naming, and necessary named visual tokens; preserve shared palette, foreground pairs, and light/dark appearance.
- [x] 3.2 Implement labelled phone bottom navigation with safe-area clearance and persistent desktop navigation; preserve existing routes and provide parent navigation for directly opened nested pages.
- [x] 3.3 Replace the dialog overlay with a named, focus-managed modal supporting initial/return focus, cancellation, and pending actions; verify keyboard and deletion-trigger removal cases.
- [x] 3.4 Standardize accessible field labels, visible focus, friendly announced errors, touch targets, and reduced motion; remove nested interactive elements and ensure form controls reflow at 320 CSS pixels.

## 4. Collection history and player interactions

- [x] 4.1 Add direct game entry to Collection using existing name matching; verify blank rejection, existing-game reuse, alphabetical display, and adding an unplayed game.
- [x] 4.2 Add explicit confirmed play deletion to history and refresh affected lists; retain game-detail membership controls, sheet entry, and prefilled Add Play navigation.
- [x] 4.3 Complete player editing for name, username, and colour preference with automatic reset, identity-labelled swatches, and confirmed deletion; verify reload persistence and preserved historical names.
- [x] 4.4 Update new-play suggestions to include saved players, recent names, and unlinked games; verify explicit selection sets a reference, typing clears it, duplicate saved names remain selectable, and occupied seats are not overwritten.

## 5. Score-sheet parity

- [x] 5.1 Add accessible Move up / Move down category actions alongside add/remove/edit; verify boundaries, long labels, and keyboard/touch operation within the ten-category limit.
- [x] 5.2 Verify reordered sheets persist, real changes advance versions, no-op saves preserve versions, and existing plays retain their snapshots after sheet edits/deletion.
- [x] 5.3 Verify plain mode remains the default, sheet offers only appear for matching games, and explicit sheet selection copies the saved rules and order before navigation.

## 6. Reliable draft persistence and outcomes

- [x] 6.1 Refactor draft mutations to use the latest state and ordered per-play writes with revision-aware save status; test rapid edits, delayed writes, stale route responses, failure, and retry.
- [x] 6.2 Make completion await pending edits and the final completed write; share completion/collection orchestration across scoring layouts and test duplicate submission and both write-failure paths.
- [x] 6.3 Coordinate in-app navigation and deletion with pending/failed saves; add Retry/Leave without saving handling and best-effort unload protection; prove a late write cannot resurrect a deleted play.
- [x] 6.4 Preserve numeric text buffers, identify unfinished/invalid entries before completion or departure, and provide usable signed decimal entry on phone keyboards; test negative scores and partial decimal text without changing the engine parser.
- [x] 6.5 Add textual manual-rank indicators and verify sticky total/rank overrides, clear-rank behaviour, and Recompute across save/reload.
- [x] 6.6 Add explicit per-player win/loss controls for flagged outcomes in both scoring layouts, keeping unset flags distinct and omitting rank inputs; verify persisted flags and engine-derived winner summaries.

## 7. Adaptive scoring layouts

- [x] 7.1 Build a shared category-score control/state layer with Grid / Single player choice and width-based defaults; preserve all values and text buffers through viewport and layout changes.
- [x] 7.2 Implement single-player scoring with identity, position, Previous/Next, vertical categories, total/override/outcome controls, warnings, and completion; verify five players with ten categories at enlarged text sizes.
- [x] 7.3 Implement the desktop grid with shared row sizing and sticky category labels; verify long wrapped labels, manual indicators, and horizontal scrolling without row drift or page overflow.
- [x] 7.4 Reflow plain scoring into phone-friendly player sections while retaining compact desktop rows; verify player/input attribution, long names, focus, and touch targets.

## 8. Offline application shell

- [x] 8.1 Select a build-compatible generated precache integration, register it only for production secure origins, and expose readiness only after successful caching; verify no remote asset/CDN dependency.
- [x] 8.2 Implement known-route navigation fallback and safe asset caching; test offline root and nested reloads against the production build and ensure missing assets are not served HTML.
- [x] 8.3 Implement safe worker updates/cache cleanup without forced reloads during scoring or IndexedDB deletion; test an old active client alongside a newly built version.
- [x] 8.4 Document HTTPS and static-host app-route fallback, then verify a fresh online browser can enter nested routes without a pre-existing worker; distinguish local fixture verification from actual deployment.

## 9. End-to-end acceptance and documentation

- [x] 9.1 Run complete plain and templated journeys in Chromium and WebKit: create a collection game/player/sheet, select saved players, score with ties/overrides or flagged outcomes, complete, reload, edit metadata, and delete records while preserving history.
- [x] 9.2 Run offline create/edit/complete/reload journeys plus delayed/failed save, corrupt-play, direct-link, and back/forward scenarios; verify existing-version data survives the new build.
- [x] 9.3 Review every route at 320, 390, 768, and 1440 CSS pixels, light/dark appearance, reduced motion, and 200% text/zoom; capture representative screenshots and check focus, labels, overflow, long content, and iOS visual hierarchy.
- [x] 9.4 Smoke-test an actual phone browser with keyboard open, portrait/landscape changes, safe areas, negative decimal entry, and reachable actions when hardware is available; record device/browser evidence or explicitly mark this validation unavailable without presenting emulation as a substitute.
- [x] 9.5 Run `npm test`, `npm run lint`, `npm run build`, and the new browser suite; reconcile every parity/spec requirement and leave no unexplained behavioural divergence or changed golden result.
- [x] 9.6 Update README and verification notes with implemented parity, offline behaviour, local-data limitations, hosting requirements, source baseline, screenshots, and any environmental validation gaps.
