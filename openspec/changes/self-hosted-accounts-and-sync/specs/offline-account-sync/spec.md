## ADDED Requirements

### Requirement: Local data and pending mutations commit together
Every mutation of an account-owned browser record SHALL atomically commit the changed entity and its pending synchronization state in IndexedDB. Device-save acknowledgement SHALL follow that commit. Losing network access SHALL NOT prevent valid local edits or completion after the app/account workspace has been cached.

#### Scenario: Browser stops after local save
- **WHEN** an account edit commits locally and the browser stops before upload
- **THEN** reopening preserves both the changed record and the pending upload

### Requirement: Save status distinguishes local persistence from server acceptance
The UI SHALL distinguish local saving/failure from pending/syncing/synced/conflicted/reauthentication states. A play completed offline SHALL be acknowledged as recorded on the device without claiming server synchronization. Server acknowledgement SHALL clear only the local generation it covers.

#### Scenario: New edit during upload
- **WHEN** an upload is acknowledged after the user has made a newer local edit
- **THEN** the newer edit remains pending and the UI does not mark the record fully synced

### Requirement: Mutations are revision-checked and retry-safe
Server mutations SHALL include a stable mutation ID and expected record revision. Each successful transaction SHALL atomically update the entity, increment its revision, append change metadata, and persist a replay receipt. Replaying the same accepted mutation SHALL not repeat its effects; reusing its ID for different content SHALL be rejected. Creation SHALL not overwrite a live record or tombstone.

#### Scenario: Lost response after commit
- **WHEN** a server mutation commits but the response is lost and the browser retries
- **THEN** the browser receives the accepted result without an extra play, revision, or change event

#### Scenario: Changed replay payload
- **WHEN** a previously accepted mutation ID is reused with different content
- **THEN** the server rejects it without overwriting the accepted record

### Requirement: Incremental downloads cannot skip committed changes
The server SHALL provide owner-scoped, bounded, cursor-based change pages ordered by a commit-safe sequence. Each item SHALL contain the current record state or tombstone and revision. The browser SHALL atomically apply each page and advance its cursor, ignore older/equal record revisions, and preserve local pending edits in a separate working copy. Initial synchronization SHALL indicate when its high-water mark has been reached.

#### Scenario: Concurrent server commits
- **WHEN** two accepted mutations overlap while another browser downloads pages
- **THEN** neither committed mutation is permanently skipped by the download cursor

#### Scenario: Crash during download
- **WHEN** applying a page is interrupted before its local transaction commits
- **THEN** retrying from the prior cursor applies the page without lost or duplicated visible records

### Requirement: Deletions survive delayed offline clients
Server deletion SHALL retain a minimal tombstone and revision. A stale edit or create for the deleted identity SHALL conflict rather than revive it. Tombstones, replay receipts, and change metadata SHALL remain available for the account lifetime in this release unless the account itself is purged.

#### Scenario: Stale device edits a deleted play
- **WHEN** A deletes a play in one browser and an older offline browser later uploads an edit to it
- **THEN** the play remains deleted on the server and the old browser receives a recoverable conflict

### Requirement: Conflicts preserve versions and offer explicit resolution
On revision conflict the app SHALL preserve the latest local document, its base, and authorized server state, pausing only that record's upload. It SHALL offer Use server version or Keep my version with sufficient result/deletion context. Keeping local content SHALL use a new mutation against the reviewed revision; a new concurrent change SHALL conflict again. Keeping content against a tombstone SHALL create an explicit copy under a new ID.

#### Scenario: Conflicting scores
- **WHEN** two browsers edit the same score from the same base and one upload succeeds
- **THEN** the second browser retains its input and shows both results without silently replacing either

#### Scenario: Local deletion versus remote edit
- **WHEN** a pending local deletion conflicts with a newer server edit
- **THEN** the user can cancel deletion or explicitly delete the reviewed updated record

### Requirement: Synchronization respects account and tab boundaries
The client SHALL coordinate local generations and uploads across tabs, freeze dispatched mutation payloads, and reject late callbacks for an inactive workspace. Authentication failures SHALL pause uploads pending reauthentication. Network/server failures SHALL support bounded-backoff retry and Sync now, without requiring background browser execution.

#### Scenario: Session changes during a request
- **WHEN** A's upload is in flight while another tab signs into B
- **THEN** no request is accepted into B's data and A's late response cannot populate B's UI or storage

### Requirement: Restore recovery preserves pending device data
A restored older server database SHALL use a changed recovery epoch and revoked sessions. Browsers SHALL preserve local documents/outbox, stop normal cursor/revision processing, and require reauthentication and explicit reconciliation. They SHALL NOT automatically overwrite the restored server or discard local work.

#### Scenario: Restore with a newer offline draft
- **WHEN** the server is restored to a backup older than a browser's cached/pending draft
- **THEN** the browser retains that draft as recoverable data and offers deliberate recovery rather than silently replaying stale synchronization state
