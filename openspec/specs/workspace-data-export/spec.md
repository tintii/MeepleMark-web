# workspace-data-export Specification

## Purpose
TBD - created by archiving change export-workspace-data. Update Purpose after archive.
## Requirements
### Requirement: The active workspace can be exported as versioned JSON

The system SHALL let a user download one UTF-8 JSON document for the active workspace. The top-level document MUST contain format `meeplemark-workspace`, format version `1`, a valid UTC export timestamp, and arrays named `games`, `players`, and `plays`. Games and players MUST use their shared logical document contracts, plays MUST use the canonical encoded play contract, and storage or synchronization wrappers MUST NOT appear.

#### Scenario: Export a populated workspace

- **WHEN** the active workspace contains game, player, and play records
- **THEN** the browser downloads a valid version-1 workspace document containing those logical records

#### Scenario: Export an empty workspace

- **WHEN** the active workspace contains no games, players, or plays
- **THEN** the browser downloads a valid workspace document with three empty arrays

### Requirement: Export preserves complete domain content and relationships

The export MUST contain every game in the active workspace, including unowned games referenced by history. Game documents MUST preserve collection membership, saved score sheets, and template versions. Player and play documents MUST preserve identifiers, references, exact decimal strings, embedded scoring snapshots, historical names, notes, statuses, outcomes, ranks or wins, and override flags without recomputation or normalization.

#### Scenario: Export collection and history

- **WHEN** a workspace has owned and unowned games, saved score sheets, directory players, drafts, and completed plays
- **THEN** all records and their existing IDs and references appear in the export, with collection membership represented by each game's existing `ownedAt` value

#### Scenario: Preserve exact scoring data

- **WHEN** a play contains decimal category values, a historical score-sheet snapshot, and manual total or result overrides
- **THEN** the exported play retains the canonical persisted values and flags exactly without reevaluating the play

### Requirement: Export is local, read-only, and role-independent

Export SHALL read the active browser workspace without requiring a network request or successful synchronization. It SHALL be available to guest workspaces and to signed-in `readonly`, `user`, and `admin` accounts. Export MUST NOT modify domain records, create an outbox entry, change synchronization state, or expose another account's workspace.

#### Scenario: Guest exports offline

- **WHEN** a guest with locally saved records exports while offline
- **THEN** the download succeeds using only that guest workspace and no network request occurs

#### Scenario: Read-only account exports pending local state

- **WHEN** a read-only account exports its currently available local workspace
- **THEN** the download contains that workspace's locally committed records and creates no write or synchronization mutation

#### Scenario: Administrator exports personal workspace

- **WHEN** an administrator uses workspace export
- **THEN** the file contains only that administrator account's active workspace and no other account's domain records or administrative data

### Requirement: Export uses a consistent local snapshot

Games, players, and plays MUST be read in one read-only local database transaction before serialization. Records MUST have deterministic ordering within each array so unchanged domain content produces the same array order independently of IndexedDB iteration order.

#### Scenario: Write overlaps export

- **WHEN** a local domain write overlaps creation of an export snapshot
- **THEN** the export reflects one transactionally consistent view rather than a mixture of pre-write and post-write stores

#### Scenario: Store iteration order differs

- **WHEN** equivalent records are returned by IndexedDB in a different order
- **THEN** their arrays have the same defined export order

### Requirement: Invalid records cannot produce a silently incomplete export

The system MUST validate every logical record with the existing shared document validators before download. If any record is invalid or unreadable, the system MUST start no download, MUST omit no record silently, and SHALL report the affected entity type and identifier for a bounded number of failures plus the total failure count. A failed export MUST leave all local and server state unchanged.

#### Scenario: One play is unreadable

- **WHEN** the workspace contains valid records and one play whose canonical document fails validation
- **THEN** no file is downloaded and the UI identifies the play and states that nothing was exported

#### Scenario: Multiple records are invalid

- **WHEN** invalid records exceed the displayed error-detail limit
- **THEN** the UI reports the total count, shows only the bounded detail set, and downloads no partial file

### Requirement: Workspace export has a clear and private user entry point

The Account page SHALL offer an `Export workspace` action for both guest and signed-in workspaces, explain that the JSON contains private collection, player, and play data, and provide accessible progress and error feedback. The downloaded filename SHALL be `meeplemark-workspace-YYYY-MM-DD.json`. The Administration page MUST NOT offer export of another account's domain data and SHALL continue to distinguish installation administration from personal workspace content.

#### Scenario: Export from a phone browser

- **WHEN** a user activates Export workspace from the Account page at a 375 CSS-pixel viewport
- **THEN** progress or failure feedback and the download action remain labelled, keyboard accessible, and visible without horizontal page scrolling

#### Scenario: Export is not an installation backup

- **WHEN** an administrator reviews the export guidance
- **THEN** the UI and documentation distinguish the active-workspace JSON file from the operator's PostgreSQL backup procedure

