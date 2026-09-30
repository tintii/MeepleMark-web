## Context

MeepleMark already centralizes colour, typography, spacing, radius, motion, and player identity values in `src/styles/tokens.css`; shared component and route styling lives predominantly in `src/styles/shell.css`. The current theme uses neutral system surfaces and restrained blue accents in both appearances. Player markers provide the main colour, but the surrounding shell does not yet establish a recognizable product character.

The refresh crosses every route and viewport, including dense score-entry interfaces where decoration cannot compete with data entry. It must preserve the completed responsive shell, minimum touch targets, focus behavior, reduced-motion handling, semantic markup, player letter markers, and all behavioral contracts. It must also compose cleanly with account and synchronization screens introduced by the separate `self-hosted-accounts-and-sync` change.

The visual reference is a broad category—pastel candy, warm wrappers, and chocolate tones—not M&M'S brand assets or exact brand colours.

## Goals / Non-Goals

**Goals:**

- Establish a distinctive, warm, playful MeepleMark identity across phone and desktop layouts.
- Define coordinated light and dark semantic tokens, including explicit foregrounds for every colored surface.
- Apply the theme consistently to the shell, cards, grouped sections, forms, actions, chips, dialogs, feedback, player identities, and scoring views.
- Preserve fast, calm score entry by concentrating decorative colour and depth around navigation, hierarchy, actions, and player identity.
- Maintain accessible contrast, visible focus, non-colour status cues, minimum touch targets, zoom resilience, and reduced-motion behavior.
- Verify representative routes in both color schemes through rendered browser tests and screenshots.

**Non-Goals:**

- Reproducing M&M'S branding, exact colour specifications, logo construction, characters, slogans, candy imprints, or packaging.
- Redesigning information architecture, route behavior, scoring rules, persistence, accounts, synchronization, or offline operation.
- Adding a manual theme preference or persisting theme selection; this change continues to follow the browser/operating-system color-scheme preference.
- Making every control circular or highly decorated, or using player colours as general-purpose action colours.
- Requiring a remotely hosted font, image service, or runtime network request for presentation.

## Decisions

### 1. Use semantic theme tokens rather than component-local colours

Expand the existing token layer with roles for page and raised surfaces, primary action and foreground, subtle tinted surfaces, strong and subtle borders, navigation chrome, interactive shadows, and focus. Components continue to consume semantic custom properties; literal palette values remain in the token file.

Light appearance uses warm cream surfaces, cocoa text, and a deeper berry action colour. Dark appearance uses deep chocolate surfaces, warm near-white text, and a lighter berry action colour. This preserves the existing architecture and makes every component switch coherently through `prefers-color-scheme`.

The alternative—placing pastel literals directly in component selectors—would create inconsistent dark-mode adaptations and make contrast auditing difficult.

### 2. Separate semantic actions from the player palette

The primary action family uses berry in both appearances. Warning, destructive, success, focus, and neutral states retain dedicated semantic roles. The eight player colours become coordinated pastel candy hues: coral, apricot, butter, mint, aqua, periwinkle, lavender, and pink. Every player fill has an explicit readable foreground token, normally dark cocoa in both appearances.

Player colour is used for marker discs, colour selection, and restrained identity accents. It does not determine button meaning, result status, or validation state. Letters, names, labels, and state text remain present so colour is never the sole identifying signal.

The alternative—using arbitrary player colours for actions—would weaken both UI semantics and accessibility.

### 3. Express the theme through shape and shallow depth

Cards, dialogs, grouped sections, and major controls receive softer `16–20px` geometry. Primary actions use pill-like or strongly rounded shapes with a short shadow and clear pressed state. Player markers use a circular highlight and inset edge to suggest a small candy piece without using an imprint or brand mark. Inputs and dense tables remain recognizably utilitarian with modest rounding and limited shadow.

Depth is encoded with named shadow tokens and kept shallow so the interface does not become skeuomorphic. Hover and press transitions use existing motion tokens; reduced-motion users receive immediate state changes.

The alternative—illustrative candy backgrounds and strong gloss on every element—would distract from score entry and age poorly across dark mode.

### 4. Create hierarchy with restrained display typography

Body copy, controls, and tabular numerals retain the system sans-serif stack. Product naming and major headings use a rounded display stack beginning with the generic `ui-rounded`, with system fallbacks and heavier weight. No remote font request is made. Layout and wrapping must remain correct when the rounded face is unavailable.

The alternative of adding a hosted display font introduces offline, privacy, and loading concerns for a relatively small visual benefit. A bundled font can be evaluated later as a separate asset decision.

### 5. Adapt the existing responsive shell instead of restructuring routes

Desktop navigation becomes a cocoa-toned wrapper band with warm text and a berry active indicator. Phone navigation retains its current bottom placement and labels, gaining softly raised chrome and candy-like icon treatments. Route markup changes only where a shared class or decorative, hidden element is necessary; decoration must not alter accessible names or keyboard order.

Cards and rows receive the new surface, radius, border, and interaction treatments. On scoring routes, player headings and markers carry colour while numeric entry areas and table grids remain high-contrast and quiet. This minimizes regression risk in the completed responsive behavior.

### 6. Treat dark mode as a designed chocolate palette

Dark mode uses layered brown-red surfaces rather than replacing light neutrals with generic black and grey. Pastel player fills remain intentionally bright against these surfaces and keep their declared foregrounds. Borders and shadows are retuned rather than merely inverted. Native controls declare an appropriate `color-scheme` so browser-rendered affordances match the active appearance.

Both appearances must meet WCAG AA contrast for normal text and interactive state indicators. Pastel fills that cannot carry normal text at the required contrast may only be used decoratively or must be adjusted during implementation.

### 7. Verify the theme at shared-component and rendered-page boundaries

Token tests or a small audit fixture cover the semantic roles and player fill/foreground pairs. Playwright covers representative empty, populated, form, dialog, plain-scoring, and category-scoring states at phone and desktop widths in light and dark appearances. Tests retain keyboard focus and reduced-motion checks and update screenshot baselines only after review.

Behavioral unit tests remain unchanged except where markup-class changes require query adjustments. The theme must not alter stored values or scoring output.

## Risks / Trade-offs

- [Pastel colours can have weak text contrast] → Pair every coloured fill with an explicit foreground, test the pair, and reserve very light colours for larger surfaces or decoration when necessary.
- [A playful theme can reduce dense-scorepad clarity] → Keep grid cells, inputs, totals, and warnings restrained; concentrate candy treatments in player identity and shared chrome.
- [System rounded fonts vary by platform] → Use a robust fallback stack and validate wrapping in Chromium and WebKit without making layout depend on exact glyph metrics.
- [Dark surfaces can flatten together] → Define separate base, elevated, and raised roles with tested borders instead of relying only on shadows.
- [Broad CSS changes can create route-specific regressions] → Implement shared tokens first, then shared primitives, then route-specific exceptions while reviewing the responsive screenshot matrix.
- [The inspiration could become too derivative] → Review the result against the explicit exclusion list and remove any logo-like candy imprint, mascot, slogan, or packaging composition.

## Migration Plan

1. Add the complete semantic and player token sets for both appearances while preserving existing token names needed by components.
2. Restyle global typography, focus, surfaces, buttons, and form controls, then migrate shared navigation, page, row, section, chip, badge, dialog, and feedback primitives.
3. Tune plain and category scorepads so identity accents are visible without reducing numeric-entry clarity.
4. Exercise account, synchronization, offline, warning, destructive, and empty states so new and existing screens share the same visual language.
5. Run unit, build, accessibility-oriented browser checks, and the light/dark responsive screenshot matrix; review and commit the new baselines.

Rollback is a CSS/token and optional presentation-markup revert. No data or service-worker migration is required, and user records remain compatible across old and new builds.

## Open Questions

No product decision blocks implementation. Exact palette values, radius increments, and shallow-shadow strength can be tuned during rendered review as long as they preserve the semantic roles, pastel direction, accessibility requirements, and brand-separation guardrails above.
