# adaptive-scorepad Specification

## Purpose
TBD - created by archiving change ios-parity-responsive-web. Update Purpose after archive.
## Requirements
### Requirement: Category scoring offers grid and single-player layouts
Category scoring SHALL offer a visible Grid / Single player control. Narrow available width SHALL default to Single player; wider layouts SHALL default to Grid. Enlarged text/zoom SHALL support usable reflow and an explicit single-player choice. Both layouts SHALL operate on the same draft and offer the same scores, overrides, outcomes, warnings, and completion actions.

#### Scenario: Phone scoring
- **WHEN** a five-player, ten-category play opens at a narrow phone width
- **THEN** one player's categories are displayed vertically with player identity, position, and Previous/Next controls

#### Scenario: Desktop scoring
- **WHEN** the same play opens with sufficient width and no explicit layout preference
- **THEN** the category-by-player grid is shown

### Requirement: Grid labels stay aligned and visible
The grid SHALL keep category labels pinned while player columns scroll horizontally. Long category labels SHALL wrap without truncation, and corresponding inputs SHALL remain aligned with their category across all columns. Manual override labels SHALL NOT misalign subsequent rows.

#### Scenario: Wrapped label and manual total
- **WHEN** a category occupies several lines and one player has a manually overridden total
- **THEN** all category/total/rank rows remain aligned while horizontal scrolling leaves category labels visible

### Requirement: Switching layouts and players preserves entry
Changing the selected player, layout, or viewport SHALL preserve accepted values and unfinished text buffers without changing scoring semantics or making a new play. Previous/Next SHALL be disabled at their respective ends. Focus SHALL move predictably when a focused control is replaced.

#### Scenario: Switch during decimal entry
- **WHEN** the user enters an unfinished decimal, switches players or layouts, and returns
- **THEN** the unfinished text is still present and the persisted play still contains only the last valid value until entry is resolved

### Requirement: Plain scoring adapts without losing information
Plain scoring SHALL present player identity, score, and outcome-appropriate controls using compact rows on wider screens and reflowed player sections when needed on phones. Each input SHALL identify its player and purpose. Decimal and negative score entry SHALL be possible on phone keyboards without relying on a keyboard key that is unavailable on the target device.

#### Scenario: Negative score on a phone
- **WHEN** a user records a negative decimal in plain or category scoring on a phone
- **THEN** the UI provides a usable way to enter the sign and decimal and persists the exact accepted value
