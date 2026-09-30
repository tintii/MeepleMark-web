# score-sheet-portability Specification

## Purpose
TBD - created by archiving change score-sheet-json-import-export. Update Purpose after archive.
## Requirements
### Requirement: A saved score sheet can be exported as JSON

The system SHALL allow any user who can view a game with a saved score sheet to download that sheet as a UTF-8 JSON file. The JSON MUST conform to the existing standalone `Template` contract and contain the saved sheet's ordered categories, win direction, default outcome, slug, and version. Export MUST work without network access and MUST NOT modify local or server state.

#### Scenario: Export a saved sheet

- **WHEN** a user exports a game whose saved sheet has three ordered categories, low-score-wins direction, and ranked outcome
- **THEN** the browser downloads a valid JSON `Template` containing those categories in order and those rules

#### Scenario: Export while offline

- **WHEN** the application is offline and the user exports a locally available saved sheet
- **THEN** the download succeeds without a network request or queued synchronization mutation

#### Scenario: A game has no saved sheet

- **WHEN** a user views a game with no saved score sheet
- **THEN** the system does not offer a score-sheet export

### Requirement: A valid JSON score sheet can be loaded for review

The score-sheet editor SHALL accept one JSON file whose value conforms to the existing standalone `Template` contract. A successful import MUST load its ordered category labels, win direction, and default outcome into the current editor form, and MUST NOT persist them until the user explicitly saves.

#### Scenario: Import an exported sheet

- **WHEN** a user selects a valid exported score-sheet file in another game's editor
- **THEN** that file's categories and rules populate the form and the destination game's saved sheet remains unchanged until Save

#### Scenario: Leave without saving an import

- **WHEN** a valid import has populated the editor and the user leaves without saving
- **THEN** reopening the game shows the previously saved sheet unchanged

#### Scenario: Round-trip a sheet

- **WHEN** a saved sheet is exported and that file is imported into an editor
- **THEN** the editor presents the same category order, labels, win direction, and outcome as the exported sheet

### Requirement: Destination identity and versioning remain authoritative

Saving imported content MUST use the destination game's existing local template identity and normal version rules. The imported `slug` and `version` MUST NOT replace the destination slug, lower its version, or force its version to the imported value.

#### Scenario: Import from a different game

- **WHEN** a file with a source game's slug and version 9 is imported and saved over a destination sheet at version 2
- **THEN** the saved sheet uses the destination game's local slug and advances according to the existing destination version rule rather than becoming version 9

#### Scenario: Import identical content

- **WHEN** imported categories and rules are identical to the destination game's saved sheet and the user saves
- **THEN** the existing unchanged-sheet rule preserves the destination version

### Requirement: Invalid imports are bounded and non-destructive

The system MUST refuse a file larger than 64 KiB before reading its contents. It MUST reject unreadable text, malformed JSON, non-object JSON, and any object that fails existing template validation. Every failure MUST be explained inline and MUST leave both the current editor fields and the saved score sheet unchanged.

#### Scenario: Malformed JSON

- **WHEN** the user selects a file containing malformed JSON
- **THEN** the editor reports that the file is invalid and preserves all current fields and the saved sheet

#### Scenario: Invalid template shape

- **WHEN** the user selects valid JSON with an empty category label, duplicate category key, unsupported scoring field, or more than ten categories
- **THEN** the editor reports the validation issues and preserves all current fields and the saved sheet

#### Scenario: Oversized file

- **WHEN** the user selects a file larger than 64 KiB
- **THEN** the editor refuses it before reading and preserves all current fields and the saved sheet

### Requirement: Import and export respect existing access boundaries

Export SHALL be available as a read operation to a user who may view the game. Import and Save SHALL remain behind the existing game-write permission and MUST use the existing scoped persistence and synchronization path.

#### Scenario: Read-only account exports a sheet

- **WHEN** a read-only account user can view one of their games with a saved sheet
- **THEN** they can export the sheet but cannot import or save a replacement

#### Scenario: Signed-in user saves imported content

- **WHEN** a writable signed-in user imports valid content and explicitly saves it
- **THEN** the destination game is updated through the same scoped mutation and synchronization path as a manually edited sheet
