## ADDED Requirements

### Requirement: Players support complete local editing
The directory SHALL support creating, renaming, and deleting players, setting or clearing an optional BGG username, and setting or clearing one of the eight player colour preferences. A non-empty trimmed display name SHALL be required. The directory SHALL display names alphabetically with username context when present and a colour swatch with a non-colour identity label. BGG usernames SHALL remain local metadata with no network request.

#### Scenario: Edit optional metadata
- **WHEN** the user changes a player's name, sets a colour, and clears their username
- **THEN** those changes persist after reload and a subsequent edit can reset the colour to automatic

#### Scenario: Invalid name
- **WHEN** an empty or whitespace-only name is submitted
- **THEN** a visible validation message appears and no invalid directory record is saved

### Requirement: Directory changes preserve recorded history
Renaming, changing metadata, or deleting a player SHALL NOT rewrite or cascade-delete any play. Historical plays SHALL render from their own names, scores, and snapshots even when a referenced player no longer exists. Deletion SHALL require confirmation.

#### Scenario: Delete a previously selected player
- **WHEN** a saved player referenced by an existing play is deleted
- **THEN** the directory entry disappears while the play retains its original name, reference, and scores and remains readable

### Requirement: Suggestions combine saved and recent players
New-play entry SHALL offer saved players followed by distinct additional names from the latest 20 plays. Saved-player suggestions SHALL carry explicit IDs; recent-name-only suggestions SHALL carry no ID. Selecting a suggestion SHALL fill the first empty seat or append a seat without overwriting an occupied one. Typing names without selecting suggestions SHALL remain supported.

#### Scenario: Select a saved player
- **WHEN** the user selects a saved-player suggestion and starts the play
- **THEN** the selected seat stores the displayed name and that player's ID

#### Scenario: Duplicate saved names
- **WHEN** two saved players have the same display name
- **THEN** both remain selectable as separate directory choices and choosing either preserves its own ID

### Requirement: Editing selected names clears identity references
Editing a selected seat's name SHALL clear that seat's player reference. Removing or reordering any seat state SHALL keep names and references paired. Free text SHALL NOT infer an identity by matching a name.

#### Scenario: Replace a selected name
- **WHEN** a user selects a saved player and then edits the seat's name
- **THEN** the play records the edited name with a null player reference, while other selected seats retain their references
