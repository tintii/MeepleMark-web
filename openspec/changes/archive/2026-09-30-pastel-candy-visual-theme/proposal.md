## Why

MeepleMark's current interface is functional and accessible, but its mostly neutral presentation does not express the playful, social character of a board-game scorepad or make strong use of its existing player-colour system. A cohesive pastel-candy visual theme, supported equally in light and dark appearances, will give the product a distinctive identity without imitating a confectionery brand or compromising scoring clarity.

## What Changes

- Introduce a token-driven visual theme built around warm cream and cocoa foundations, a berry action colour, and a coordinated pastel player palette.
- Provide a deliberately designed dark appearance using deep chocolate surfaces, warm light text, and readable pastel player accents rather than generic neutral black surfaces.
- Restyle the shared application shell, navigation, page headers, cards, grouped sections, buttons, inputs, chips, dialogs, status treatments, and empty states with rounded geometry and restrained tactile depth.
- Give player markers and player-specific scoring treatments a candy-piece character while preserving their letter labels and all non-colour identity cues.
- Keep score-entry surfaces and dense tables restrained and legible, using colour primarily for hierarchy, identity, selection, and feedback.
- Add reduced-motion, contrast, focus, responsive-layout, and light/dark visual-regression coverage for the refreshed presentation.
- Establish brand-separation guardrails: no use of M&M'S colour specifications, wordmark treatment, stamped lowercase `m`, characters, slogans, or packaging compositions.

## Capabilities

### New Capabilities

- `pastel-candy-visual-theme`: Defines the light and dark visual appearances, semantic and player colour roles, shared component styling, accessibility constraints, and visual verification expectations for MeepleMark's new product identity.

### Modified Capabilities

None.

## Impact

- Primarily affects `src/styles/tokens.css`, `src/styles/shell.css`, shared shell/components, and the application favicon or product mark if a new MeepleMark-specific asset is included.
- May add a locally bundled display font or use an existing system font stack; no externally hosted font is required.
- Updates Playwright screenshot baselines and adds focused theme/accessibility assertions across representative phone and desktop routes.
- Does not change routes, scoring behaviour, stored documents, synchronization contracts, account behaviour, APIs, or database schemas.
