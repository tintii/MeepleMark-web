## ADDED Requirements

### Requirement: Coordinated light appearance
The application SHALL present a light appearance based on warm cream surfaces, cocoa-toned text, a berry primary action, and coordinated pastel accents. The application SHALL apply those roles consistently through semantic design tokens rather than route-specific palette values.

#### Scenario: Browser requests light appearance
- **WHEN** the browser reports a light color-scheme preference
- **THEN** every route uses the light semantic surface, text, border, action, focus, feedback, and player-colour roles
- **AND** browser-native controls render with an appropriate light color scheme

### Requirement: Designed dark appearance
The application SHALL present a dark appearance using layered deep-chocolate surfaces, warm light text, a readable berry action treatment, and pastel player accents. Dark appearance SHALL define its own surface, border, shadow, action, and feedback values rather than relying on automatic inversion.

#### Scenario: Browser requests dark appearance
- **WHEN** the browser reports a dark color-scheme preference
- **THEN** every route uses the dark semantic roles without a flash or isolated light component
- **AND** browser-native controls render with an appropriate dark color scheme

#### Scenario: Dark appearance shows dense scoring UI
- **WHEN** a user opens either plain scoring or category scoring in dark appearance
- **THEN** inputs, grid boundaries, totals, player identities, status text, and primary actions remain visually distinguishable

### Requirement: Accessible semantic colours
The application SHALL provide explicit foreground and background combinations that meet WCAG AA contrast for normal text and essential interactive indicators. Warning, destructive, success, focus, selection, and primary-action meaning SHALL NOT depend on a player colour.

#### Scenario: Text appears on a themed surface
- **WHEN** text is displayed on a base, elevated, raised, action, feedback, or player-colour surface
- **THEN** it uses the foreground token assigned to that surface at an accessible contrast

#### Scenario: User navigates by keyboard
- **WHEN** keyboard focus moves through links, controls, dialogs, navigation, or score fields in either appearance
- **THEN** a visible focus indicator remains distinguishable from both the component and its surrounding surface

### Requirement: Pastel player identity system
The application SHALL provide eight coordinated pastel player fills with explicit readable foregrounds. Player identity SHALL continue to include its existing letter and player name wherever applicable so colour is not the sole means of identification.

#### Scenario: Multiple players are shown
- **WHEN** a roster, player directory, scorecard, or score grid displays player colours
- **THEN** each player receives the deterministic palette assignment already defined by the roster logic
- **AND** each coloured marker retains a readable letter or adjacent textual identity

#### Scenario: Player marker appears in dark mode
- **WHEN** a pastel player marker is rendered on a dark chocolate surface
- **THEN** its fill, foreground, edge, and highlight remain distinguishable without changing the player's semantic identity

### Requirement: Consistent candy-adjacent component language
The application SHALL style shared navigation, cards, rows, grouped sections, buttons, fields, chips, dialogs, status treatments, and empty states with coordinated rounded geometry and restrained shallow depth. Score inputs and dense data tables SHALL remain visually quieter than navigation and primary actions.

#### Scenario: User moves between routes
- **WHEN** the user visits play history, collection, players, account, forms, dialogs, or scoring routes
- **THEN** shared component types retain consistent surface, radius, border, typography, action, and interaction treatments

#### Scenario: User presses a primary action
- **WHEN** an enabled primary action is hovered, focused, pressed, or activated
- **THEN** it provides a perceivable state change without changing its meaning or moving surrounding layout

### Requirement: Responsive and motion-safe presentation
The refreshed theme SHALL preserve existing responsive layouts, minimum touch targets, text wrapping, zoom resilience, keyboard order, and safe-area clearance. Decorative transitions SHALL be removed or made immediate when the user requests reduced motion.

#### Scenario: Theme is rendered across supported widths
- **WHEN** a representative route is rendered at 320, 390, 768, or 1440 CSS pixels in either appearance
- **THEN** content remains within the viewport except for intentional score-grid scrolling
- **AND** sticky navigation does not obscure focused content

#### Scenario: User requests reduced motion
- **WHEN** the browser reports `prefers-reduced-motion: reduce`
- **THEN** candy-themed hover, press, and elevation transitions do not animate

### Requirement: Independent MeepleMark identity
The theme SHALL use a general pastel-candy visual vocabulary without reproducing M&M'S proprietary brand devices. It SHALL NOT use the M&M'S wordmark construction, exact official colour specification, stamped lowercase `m`, characters, slogans, or packaging compositions.

#### Scenario: Theme assets and components are reviewed
- **WHEN** the implemented token palette, product mark, marker treatment, navigation, and promotional or empty-state decoration are reviewed together
- **THEN** they read as MeepleMark-specific board-game UI and contain none of the excluded brand devices

### Requirement: Visual theme verification
The application SHALL maintain rendered regression coverage for representative themed states in light and dark appearances on phone and desktop viewports.

#### Scenario: Theme regression suite runs
- **WHEN** browser visual tests run for the application shell, populated cards, forms, dialogs, plain scoring, and category scoring
- **THEN** reviewed screenshots cover light and dark appearances at representative phone and desktop widths
- **AND** tests exercise visible keyboard focus and reduced-motion behavior where relevant
