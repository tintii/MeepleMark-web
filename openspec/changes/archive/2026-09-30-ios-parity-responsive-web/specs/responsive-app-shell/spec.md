## ADDED Requirements

### Requirement: The shell preserves the iOS visual identity
The web app SHALL use the shared semantic colours, player palette/foreground pairs, spacing and radius scales, system typography hierarchy, grouped forms, and list structure. Scores SHALL use tabular numerals and restrained table styling. Display naming SHALL use the product identity definition. Light/dark appearance and reduced-motion preferences SHALL be respected.

#### Scenario: Switch appearance
- **WHEN** the browser switches between light and dark appearance
- **THEN** all application surfaces, dialogs, fields, text, and player markers remain legible using the corresponding tokens

### Requirement: Navigation adapts to phone and desktop browsers
Plays, Collection, and Players SHALL be independently accessible through labelled bottom navigation on phones and persistent navigation on larger screens. Phone content SHALL account for safe areas and navigation clearance. Existing URLs, direct entry, and browser back/forward SHALL continue to work. Nested pages SHALL offer a usable parent destination even when opened directly.

#### Scenario: Direct entry to a score sheet
- **WHEN** a valid score-sheet URL is opened directly and the browser is refreshed
- **THEN** the editor loads its game and exposes a route back to that game without requiring prior browser history

### Requirement: Layouts support small screens enlarged text and keyboards
Every screen SHALL remain usable at widths of 320, 390, 768, and 1440 CSS pixels and at 200% text/zoom. Forms and plain scoring SHALL reflow without page-level horizontal overflow; category-grid scrolling SHALL be confined to its own region. Text SHALL remain readable without truncating essential names/labels or disabling zoom. Primary touch controls SHALL provide targets at least 44 by 44 CSS pixels. Focused inputs and their immediate actions SHALL remain reachable with a phone keyboard open.

#### Scenario: Edit on a narrow phone
- **WHEN** a user enters a long player name or category label at 320 CSS pixels
- **THEN** the text remains accessible and the save/remove controls fit or reflow within the viewport

### Requirement: Controls and dialogs support assistive technology
Interactive controls SHALL have accessible names, visible focus, meaningful document order, and appropriate native semantics. Destructive actions SHALL have explicit buttons rather than requiring swipe/hover gestures. Dialogs SHALL be named, receive initial focus, contain focus while modal, support appropriate cancellation, and return focus to their trigger or a logical surviving control. Errors SHALL be announced without exposing raw implementation details as the only explanation.

#### Scenario: Keyboard confirmation
- **WHEN** a keyboard user opens and cancels a delete dialog
- **THEN** focus stays inside the dialog while open and returns to the triggering control after cancellation

#### Scenario: Successful deletion removes the trigger
- **WHEN** a confirmed deletion removes the row whose button opened the dialog
- **THEN** focus moves to the next logical row or list heading rather than disappearing
