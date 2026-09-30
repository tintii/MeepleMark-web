## Context

The active MeepleMark workspace is an IndexedDB database with three domain stores: games, players, and plays. Collection membership and saved score sheets are fields on game documents; play rows also carry index fields around the canonical encoded play document. Account workspaces additionally contain synchronization metadata, but that metadata is an implementation detail and can contain installation/account identifiers. The active local records may be newer than the server because writes are local-first.

The Administration page manages installation access and deliberately cannot browse another account's game content. The Account page already owns workspace identity, synchronization, and local-data adoption. Operator `pg_dump` remains the supported whole-installation disaster-recovery mechanism.

## Goals / Non-Goals

**Goals:**

- Download one complete, human-readable snapshot of the active workspace's logical domain records.
- Preserve record IDs, relationships, exact decimal strings, collection timestamps, score sheets, play snapshots, historical names, and overrides.
- Include locally committed changes regardless of synchronization state and work for guests and every account role while offline.
- Define a small versioned format that a later, separately proposed import feature can recognize.
- Refuse to present a silently incomplete file as a successful export.

**Non-Goals:**

- Import, restore, merge, conflict resolution, selective export, CSV/analytics, or automatic/scheduled export.
- Export of accounts, credentials, sessions, synchronization internals, conflicts, administrative settings, or audit events.
- Administrative access to another account's domain records or a browser replacement for PostgreSQL backup/restore.
- A server endpoint, schema migration, streaming archive, compression, encryption, or new dependency.

## Decisions

### 1. Export a versioned logical JSON envelope

The downloaded document has this top-level shape:

```json
{
  "format": "meeplemark-workspace",
  "version": 1,
  "exportedAt": "2026-09-30T12:34:56.000Z",
  "games": [],
  "players": [],
  "plays": []
}
```

`games` and `players` contain their existing shared document shapes. `plays` contains canonical encoded play documents, not the IndexedDB row wrapper. Games include owned and unowned records because either kind can be referenced by plays; `ownedAt` preserves collection membership and `localTemplate` preserves the saved score sheet. Records use stable ordering (games and players by ID; plays by `playedAt` and ID) and serialization uses two-space indentation plus a trailing newline.

Alternatives considered:

- **Export raw IndexedDB stores.** Rejected because play index columns, outbox entries, server shadows, and conflict rows are storage/sync implementation details rather than portable user data.
- **Use separate collection and score-sheet arrays.** Rejected because those concepts already live in `GameDocument`; duplicating them creates consistency rules without adding information.
- **Use CSV or one file per entity type.** Rejected because nested scoring snapshots and exact relationships fit JSON, and one download is the smallest useful interaction.

### 2. Read one local point-in-time snapshot

A small storage helper opens one read-only transaction over `games`, `players`, and `plays`, reads all three stores, and waits for the transaction to complete. It extracts canonical play documents without decoding and re-encoding decimals. A pure serializer accepts those logical arrays, validates them with the existing shared document validators, sorts copies, and returns JSON text. The UI turns the text into an `application/json` Blob, triggers a browser download, and revokes the object URL.

This path intentionally does not synchronize first. The export represents what the current browser has durably saved, including pending offline changes; waiting for a server would both omit that guarantee and break guest/offline use.

Alternatives considered:

- **Add an authenticated export API.** Rejected because it would omit guest data and locally pending work, require connectivity, and tempt privileged cross-account export.
- **Call the existing list functions independently.** Rejected because writes between separate reads could produce a mixed snapshot, and decoded plays risk transforming their persisted wire representation.
- **Force synchronization before export.** Rejected because local durability, not server acknowledgement, defines the active workspace view.

### 3. Validate every logical record and fail the export atomically

Before serialization, every game, player, and extracted play document is checked with the existing shared validators. If any record is unreadable, no download starts. The Account page reports the entity type and ID for a bounded number of failures, the total failure count, and that no records were exported; it does not silently omit or repair data. Valid empty workspaces still export empty arrays.

Alternatives considered:

- **Skip corrupt records.** Rejected because a file presented as a backup-like copy would be misleadingly incomplete.
- **Include corrupt raw rows beside valid documents.** Rejected because that weakens the versioned logical contract and makes future import semantics ambiguous.
- **Abort on the first invalid record.** Rejected because reporting a bounded summary of all affected IDs is nearly as simple and more actionable.

### 4. Put the action with the active workspace, not privileged administration

Add an `Export workspace` section to the Account page for both guest and signed-in states. The action is read-only, remains enabled for `readonly` accounts, and explains that the file contains private play and player data. The Administration page remains concerned with accounts and installation policy and continues to state that administrators cannot browse other accounts' content.

An admin-only placement was considered because export can feel operational. It was rejected because it would exclude guests and non-admin account owners, confuse personal export with installation backup, and undermine the established content-isolation message. Operators continue using the documented PostgreSQL backup procedure for the whole installation.

### 5. Keep export metadata minimal

The envelope includes only a format discriminator, format version, UTC export timestamp, and domain arrays. It omits username, display name, account ID, installation ID, origin, role, sync cursors, revisions, outbox, conflicts, and adoption mappings. The filename is `meeplemark-workspace-YYYY-MM-DD.json`; identity metadata can be added only through a future format version if an import requirement proves it necessary.

Alternatives considered:

- **Include account and installation identity for provenance.** Rejected because it increases privacy exposure and is not needed to understand the domain records.
- **Reuse the score-sheet JSON shape.** Rejected because a full workspace needs an explicit envelope and record collections; the existing standalone sheet format remains unchanged.

## Risks / Trade-offs

- **[Large workspaces require memory for the records, serialized text, and Blob]** → Use one straightforward in-memory JSON export for now; add streaming or compression only if measured workspace sizes make it necessary.
- **[The file contains private player names, notes, and play history]** → State this beside the action and avoid adding identity or sync metadata; protection of the downloaded file remains the user's responsibility.
- **[A concurrent write could otherwise create mismatched relationships]** → Read all domain stores in one IndexedDB transaction and serialize only after it completes.
- **[Corruption prevents a useful export]** → Report bounded record identifiers and export nothing rather than claiming completeness; repair/recovery is a separate change.
- **[Users may mistake personal JSON for server disaster recovery]** → Keep the action on Account and document that operators must still use PostgreSQL backups.

## Migration Plan

No data or database migration is required. Deploy the serializer, storage snapshot helper, and Account-page action with the normal web release. Existing guest and account workspaces become exportable immediately. Rollback removes the UI and helper without changing stored records or previously downloaded files.

## Open Questions

None. Import/restore semantics and any need for encrypted or streaming archives are intentionally deferred until separately requested.
