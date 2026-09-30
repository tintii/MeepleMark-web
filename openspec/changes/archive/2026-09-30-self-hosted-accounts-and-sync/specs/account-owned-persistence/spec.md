## ADDED Requirements

### Requirement: PostgreSQL persists account-owned domain records
The server SHALL persist games, collection membership, local score sheets, players, and plays in PostgreSQL with owner-scoped identities and record revisions. In this release all game records SHALL be user-scoped; no shared catalogue SHALL expose user membership or templates. The browser SHALL access records through the authenticated API rather than direct database access.

#### Scenario: Independent collections and templates
- **WHEN** A and B each record the same game with different ownership and score sheets
- **THEN** changing A's game leaves B's membership and score sheet unchanged

### Requirement: Ownership is enforced on every server data path
The API SHALL derive ownership from the session and scope every read, write, sync page, adoption mapping, and receipt replay to that user. Client-supplied ownership SHALL NOT grant access. References SHALL resolve only within the owner's namespace, while opaque historical missing references SHALL NOT expose other users' records.

#### Scenario: Another user's record ID
- **WHEN** B attempts to read, update, delete, or synchronize A's record using its ID
- **THEN** A's record remains inaccessible and unchanged

#### Scenario: Forged ownership
- **WHEN** a request authenticated as B includes A's owner ID
- **THEN** the request cannot read or mutate A's data

### Requirement: Stored plays retain the scoring contract
The API SHALL validate incoming play/template documents, retain exact decimal strings, and preserve embedded snapshots, historical names, and manual override flags. Query columns SHALL be derived from the validated document in the same transaction. Scores/ranks/winners SHALL use the shared engine contract, and existing golden fixtures SHALL remain unchanged.

#### Scenario: Round trip exact scores
- **WHEN** a templated play containing decimal categories, ties, and manual overrides is synchronized and downloaded in another browser
- **THEN** its evaluation and snapshot match the original document exactly

#### Scenario: Invalid wire data
- **WHEN** a mutation contains invalid score encodings, template data, or contradictory document structure
- **THEN** no partial domain write, change event, or successful receipt is committed

### Requirement: Historical plays survive directory and template edits
Player changes/deletion and game sheet changes/deletion SHALL NOT rewrite historical play names, scores, or embedded snapshots. Removing collection membership SHALL preserve the game and its plays. Deleting a play SHALL leave unrelated records intact.

#### Scenario: Rename and delete a player
- **WHEN** a user renames and then deletes a player referenced by a completed play
- **THEN** the play remains readable after synchronization with the originally recorded name and result

### Requirement: Server identity protects synchronization boundaries
The server SHALL expose a stable installation ID, protocol version, and recovery epoch. Sync requests SHALL verify the expected installation, epoch, and account against the current service/session. A mismatch SHALL pause uploads without assigning pending data to the new identity.

#### Scenario: Different installation at the same URL
- **WHEN** a browser reconnects to a replacement installation at its previous origin
- **THEN** old pending records remain preserved and are not automatically uploaded to the replacement
