## 1. Theme Foundation

- [x] 1.1 Define the warm light and chocolate dark semantic colour roles in `src/styles/tokens.css`, preserving compatible token names and declaring the appropriate native `color-scheme`.
- [x] 1.2 Replace the player swatches with eight coordinated pastel fill/foreground pairs and verify every text-bearing pair meets WCAG AA contrast.
- [x] 1.3 Add named display typography, radius, border, shallow-shadow, press-state, and decorative-motion tokens with reduced-motion overrides.
- [x] 1.4 Add an automated token or audit-fixture test covering critical foreground/background and player palette contrast pairs.

## 2. Shared Component Language

- [x] 2.1 Restyle the document background, headings, links, buttons, form controls, fieldsets, focus indicators, disabled states, and selection states from semantic tokens.
- [x] 2.2 Restyle desktop and phone navigation with cocoa wrapper chrome, readable active states, softly raised mobile treatment, and unchanged accessible labels and safe-area behavior.
- [x] 2.3 Apply the shared rounded-surface and shallow-depth treatment to page headers, grouped sections, list rows, cards, chips, empty states, and dialogs.
- [x] 2.4 Give player markers and colour selectors a restrained candy-piece highlight and edge while retaining their letter, name, and deterministic identity assignment.
- [x] 2.5 Restyle warning, destructive, success, save, sync, offline, update, and conflict treatments so meaning remains independent of the player palette in both appearances.

## 3. Route and Scorepad Integration

- [x] 3.1 Review and tune play history, collection, player directory, new-play, template, account, and conflict screens so all shared and route-specific elements use the new visual hierarchy.
- [x] 3.2 Apply player identity accents to plain scoring while keeping numeric inputs, rank controls, outcomes, totals, and completion actions calm and legible.
- [x] 3.3 Apply player identity accents to grid and single-player category scoring while preserving sticky cells, intentional horizontal scrolling, row alignment, and readable dark-mode boundaries.
- [x] 3.4 Verify 320, 390, 768, and 1440 CSS-pixel layouts, enlarged text, long names and labels, minimum touch targets, and focused-control clearance in both appearances.

## 4. Verification and Review

- [x] 4.1 Add or update Playwright coverage for representative empty, populated, form, dialog, plain-score, and category-score states in light and dark appearances.
- [x] 4.2 Verify visible keyboard focus and reduced-motion behavior for navigation, shared controls, dialogs, and score-entry interactions.
- [x] 4.3 Regenerate and review phone and desktop screenshot baselines in Chromium and WebKit, checking surface hierarchy, contrast, overflow, and scoring clarity.
- [x] 4.4 Run the unit, integration, browser, and production-build checks and confirm scoring, storage, account, sync, and offline behavior are unchanged.
- [x] 4.5 Perform a final brand-separation review confirming the UI contains no official M&M'S palette specification, wordmark construction, stamped lowercase `m`, characters, slogans, or packaging compositions.
