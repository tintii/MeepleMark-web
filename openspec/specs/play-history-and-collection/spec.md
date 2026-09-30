# play-history-and-collection Specification

## Purpose
TBD - created by archiving change ios-parity-responsive-web. Update Purpose after archive.
## Requirements
### Requirement: Plays remain discoverable and resumable
The app SHALL list plays most recent first with game, date, player count, and draft/completed status. Only completed plays SHALL show a winner summary. Opening a play SHALL select plain or category scoring from its embedded snapshot. A corrupt play SHALL remain identifiable as unreadable without hiding other plays or displaying invented scores.

#### Scenario: Resume a category draft
- **WHEN** a user opens a draft with an embedded score sheet from history or game details
- **THEN** category scoring opens with its saved values and overrides, and the history row has no winner claim

#### Scenario: Corrupted history entry
- **WHEN** a stored play fails validation
- **THEN** both the main history and relevant game history show an unreadable entry, and opening it presents an error instead of scores

### Requirement: Individual plays can be deleted
The app SHALL expose an explicit, keyboard- and touch-accessible delete action in play history with confirmation. Deletion SHALL remove only the selected play, refresh affected history/suggestions, and prevent pending writes from restoring it.

#### Scenario: Confirm deletion
- **WHEN** one of three plays for a game is deleted after confirmation
- **THEN** the other two plays, the game, its score sheet, and all player records remain intact after reload

#### Scenario: Cancel deletion
- **WHEN** the user cancels the delete confirmation
- **THEN** the play remains unchanged

### Requirement: Games can be added directly to the collection
The app SHALL accept a non-empty typed game name in Collection, reuse the existing exact or case-insensitive name match, and mark it owned without requiring a play. Owned games SHALL be listed alphabetically. Blank submissions SHALL create nothing.

#### Scenario: Add an already-played game
- **WHEN** the user adds `wingspan` and an unowned `Wingspan` record already exists
- **THEN** that record becomes owned without creating another game or changing any play

#### Scenario: Add an unplayed game
- **WHEN** the user adds a new game to the collection
- **THEN** it is immediately available in the owned list and new-play suggestions without creating a play

### Requirement: Game details preserve collection and history flows
Game details SHALL show the game's play history, score-sheet entry point/summary, and an Add Play action prefilled with its name. Membership controls SHALL allow adding an unowned game and confirmed removal of an owned game. Removal SHALL preserve the game record, sheet, and recorded plays. Starting or completing a play SHALL NOT automatically add collection membership.

#### Scenario: Remove ownership
- **WHEN** removal is confirmed from an owned game's details
- **THEN** the game leaves Collection but its history and score sheet remain available

### Requirement: Game suggestions include owned recent and unlinked history
New-play suggestions SHALL contain referenced games in most-recent-play order, followed by remaining owned games alphabetically, followed by distinct names from up to 200 recent plays without a game reference. Suggestions SHALL be deduplicated by displayed name without deleting or merging stored records. Manual typing SHALL remain sufficient to start a play.

#### Scenario: Legacy unlinked play
- **WHEN** a recent stored play names a game but has no game reference
- **THEN** that name is offered during new-play creation and the historical play is not rewritten
