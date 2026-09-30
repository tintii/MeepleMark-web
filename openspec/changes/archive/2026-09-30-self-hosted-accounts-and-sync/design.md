## Context

The completed `ios-parity-responsive-web` checklist provides mobile/desktop routes, exact scoring, ordered local play writes, and a production offline shell. Storage currently uses one unowned IndexedDB database with `games`, `players`, and `plays` stores; `GameRecord` includes collection membership and a local template. There is no backend or account boundary. Existing implementation edits in the workspace are the starting point and must be preserved.

The direction recorded on 2026-09-26 prioritizes web delivery, separate users/players, PostgreSQL, and self-hosting. This change implements one complete account-backed path, including the synchronization and packaging needed to make it usable. Native iOS remains a reference, not a second client to implement here.

## Goals / Non-Goals

**Goals:**

- Account-owned data usable from multiple browsers on one installation.
- Uninterrupted local scoring, with truthful device-save/server-sync status.
- Explicit account ownership, local-data adoption, and recoverable conflicts.
- A small service the operator can deploy, upgrade, back up, and restore with Compose.
- Preservation of all existing score/document invariants and guest workflows.

**Non-Goals:**

- Public registration, hosted identity dependencies, OIDC, public catalogues, groups, live collaborative editing, native sync, federation, BGG, general import/export, or Kubernetes.
- Replacing the scoring engine, rendering from live directory names, or silently merging scores.
- Claiming offline access can detect a remote account revocation before reconnecting.

## Decisions

### 1. One TypeScript application service and PostgreSQL

Add a Fastify server under `server/`, using a supported Node LTS release, `pg` with parameterized SQL, and numbered SQL migrations tracked by checksum. Pin compatible maintained releases when implementing. Serve the production Vite build and `/api/v1/*` from one origin; Vite development proxies API calls to the local server. Keep the React app and route URLs.

Factor shared wire-document validators/codecs into a browser-independent module imported by client and server; do not import React, IndexedDB, or Vite environment code into the API. Preserve the engine's decimal-string encoding and run the same golden cases in the server build.

Alternatives: MongoDB adds no necessary capability for the ownership/relationship model; a full-stack framework rewrite would disrupt an already working UI; Redis and a separate worker service are unnecessary for the initial deployment. PostgreSQL also holds sessions and sync metadata. Use explicit SQL transactions on one checked-out connection, as required by [node-postgres](https://node-postgres.com/features/transactions). Fastify's runtime support policy is documented in its [LTS reference](https://fastify.dev/docs/latest/Reference/LTS/).

### 2. Local accounts with operator provisioning and guest continuity

**Draft default:** an operator CLI creates accounts by username and issues a random single-use, 24-hour setup code. The user sets their password through the setup screen. The CLI can issue a replacement code, disable an account, revoke sessions, and initiate confirmed account deletion. Recovery uses the same one-use code process; no SMTP or public signup dependency. Codes are displayed only during the deliberate operator command, stored hashed, and excluded from normal logs. Password entry/setup codes must not require shell arguments containing secrets.

Use a maintained Argon2id library with at least OWASP's current minimum parameters, benchmarked on the supported container target. Authenticate with opaque random session tokens in host-only HttpOnly, Secure, SameSite cookies; store token hashes and expirations server-side. Use maintained Fastify cookie/session primitives, an Origin check and CSRF token for state-changing browser requests, bounded request sizes, and login/setup throttling. Default sessions have a 7-day idle timeout and a 30-day absolute timeout; both are configurable and enforced server-side. Password change/reset or account disabling invalidates other sessions. Username matching is explicitly normalized and unique; display names remain separate. [Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) inform this design.

Guest mode retains today's local-only scoring. Account actions live in an accessible Account screen without displacing Plays, Collection, and Players. Sign-in selects an account workspace and never adopts guest data automatically. Previously activated offline access can reopen that account's cached workspace until explicit local logout; network operations always require fresh server authorization. First login/setup and unlocking a deliberately logged-out workspace require connectivity.

Alternatives: mandatory login breaks the existing no-setup flow; public signup adds abuse/recovery policy; an external identity provider increases operator prerequisites. These can be separate follow-ups. This default is a proposal choice, not a claim that the user explicitly selected the asynchronous account-policy suggestion.

### 3. Account-owned records with familiar document shapes

Initial tables:

| Table | Purpose |
|---|---|
| `installation` | Stable installation ID and a recovery epoch changed after restoring an older backup |
| `users`, `sessions`, `account_setup_codes` | Login lifecycle; users have no automatic player record |
| `user_games` | Owner, client UUID, metadata, owned-at, local template JSONB, template version, record revision, deletion marker |
| `players` | Owner, client UUID, name, optional BGG username/colour, revision, deletion marker |
| `plays` | Owner, client UUID, date/status/game query columns, validated wire document JSONB, revision, deletion marker |
| `sync_state`, `changes` | Per-user committed sequence and ordered change metadata |
| `mutation_receipts` | Per-user mutation ID, request fingerprint, and accepted result for replay |
| `adoption_receipts` | Per-user source workspace/record mapping for repeatable guest adoption |

Every user-data key includes `owner_id`; queries and mutations require a server-derived owner. Never trust an owner supplied in JSON. Reference checks are scoped to that owner and permit that owner's tombstoned records so deleting a player does not break historical plays. Validation distinguishes a absent/null reference from a cross-owner reference; the latter cannot be dereferenced or accepted as an authorized relationship. Unknown reference handles from historical data may remain opaque non-dereferenced references, and must never resolve outside the current owner.

All games in this phase are user-scoped, including imported BGG/corpus metadata. Keeping owned-at/template on a user-owned game is safe; these must be split into per-user records if a shared catalogue is later introduced. Do not globally deduplicate by name or BGG username. Distinct users can record the same names and identifiers independently.

Derive query columns from the validated play document in the same write transaction; callers cannot submit contradictory indexed values. Preserve completed-play editing currently supported by the UI. Template snapshots, score strings, override flags, and historical names do not change when referenced records are edited/deleted.

Alternative: immediately separating global games, memberships, and user templates adds a shared catalogue policy absent from this scope. Generic unvalidated JSON-only storage obscures ownership and query invariants. Use normal columns plus JSONB only for structured embedded content.

### 4. Durable local transactions and explicit workspace scope

Replace the global database singleton with a repository opened for an explicit scope. Preserve the existing `meeplemark` version-1 stores as the guest workspace, adding metadata as needed. Account databases are namespaced by origin, installation ID, and user UUID, with entity stores, server-shadow revisions, outbox, conflict copies, adoption mappings, and sync cursor metadata. Never mix guest and account records in an unscoped query.

Every account mutation commits its local entity and outbox entry in one IndexedDB transaction. The UI reports device-save success only after that transaction commits. Account-level synchronization is asynchronous; completion does not wait for the network. It can show `Play recorded on this device — waiting to sync` until the server acknowledgement arrives.

Outgoing requests are immutable after first dispatch. Additional edits to an in-flight record stay as a later pending generation; unsent generations can coalesce to the latest local document. After a predecessor acknowledgement, build the next immutable request with its accepted server revision. Retrying a request reuses the same mutation ID and payload. Downloaded state updates the server shadow without overwriting local pending edits; acknowledgements only clear the local generation they cover.

Coordinate tabs with a per-workspace sync lock and IndexedDB compare-and-set for local generations. An in-memory queue alone is insufficient across tabs/restarts. Store and check a workspace generation on async callbacks so a late response cannot modify another user's UI/database. Account switching broadcasts invalidation to other tabs sharing the cookie session; stop their old upload loops until session identity is verified.

Alternatives: network-first writes break offline entry; storing an outbox separately after a local write leaves a crash window; session-wide global state makes accidental cross-account uploads possible.

### 5. Versioned mutation protocol and ordered downloads

The API exposes installation/protocol metadata, account/session operations, and authenticated synchronization endpoints. Mutations carry `{mutationId, entityType, entityId, baseRevision, operation, document?}`; ownership comes from the session. Creation expects revision zero and no existing live record or tombstone. Edits/deletes require the current revision. A delete creates a tombstone, not permission to recreate the same ID.

For each mutation transaction: authorize the user; lock that user's `sync_state` row; check the mutation receipt/fingerprint; validate document and references; compare revision; update the record; increment the per-user sequence; append change metadata; store a receipt; commit. Same ID and same fingerprint returns the prior accepted result; different content under an accepted mutation ID is rejected. Auth and ownership checks occur before receipt replay. A conflict returns HTTP 409 and the authorized current revision/state; a schema rejection changes nothing.

The per-user lock serializes sequence allocation through commit, avoiding the missed-event race from treating a global sequence's allocation order as commit order. It is a reasonable initial trade-off for one user's scoring workload. Different users remain independent. PostgreSQL documents the relevant [row locking](https://www.postgresql.org/docs/current/explicit-locking.html) and [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) semantics.

`GET /api/v1/sync/changes?after=<cursor>&limit=<bounded-size>` returns ordered change metadata joined to each record's current authorized document or tombstone, plus the cursor for the last scanned change and a high-water mark. Capture the page's metadata/state in a consistent read transaction. Clients apply only newer record revisions and commit the page/cursor atomically in IndexedDB. Repeated records are harmless, and the returned current state may be newer than the triggering change. A newly signed-in browser starts at cursor zero; it marks initial synchronization complete only after reaching the reported high-water mark. All records must enter storage through the mutation path, including adoption and operator-triggered data operations.

Retain change metadata, minimal tombstones, and successful mutation receipts for the lifetime of an account in this first release. Change entries store no historic score payload; joins return current state. Tombstone creation clears that record's live payload after any existing historical references are preserved in play snapshots. Receipt contents contain IDs/revisions/status and a request hash, not a second full document. Cleanup/compaction requires a later cursor-expiry design. Backups can contain older data until their documented retention expires.

Sync runs at login, app focus/reconnect, after local changes with a brief batching delay, and through an explicit Sync now action; bounded polling while foregrounded discovers edits from another device. Retry network/server failures with bounded backoff. Stop on authentication or protocol errors. No WebSocket or background-execution guarantee is required.

### 6. Conflicts preserve work and require an explicit choice

Use record-level optimistic concurrency, not silent last-write-wins. On conflict, preserve the latest local draft, its base, and current server document; pause only that record's outgoing changes. Other records continue to synchronize.

Offer `Use server version` and `Keep my version`, showing relevant names, scores, timestamps, and deletion state. Keep my version submits a new mutation based on the reviewed server revision; another concurrent update produces another conflict. If the server record is deleted, keeping local content creates an explicit copy under a new ID, never resurrects the tombstone. A pending local deletion conflicting with a server edit offers Cancel deletion or Delete updated record. References in other plays are not silently repointed to copies. Dependent pending records remain actionable with their own missing/deleted-reference handling.

Alternative: automatic field merging can silently alter totals, category ordering, or overrides. Preserving the original scoring document and letting the user choose is simpler to verify.

### 7. Logout, account switching, and recovery boundaries

Logout immediately hides account data, stops sync, invalidates callbacks across tabs, and marks the workspace locked. Online logout also revokes the session. Offline logout records a revoke-pending flag; reconnect must process revocation before any automatic account access, and explicit login is required to unlock. Do not infer an unlock from a still-valid HttpOnly cookie after offline logout.

Keep unsynchronized data in its locked partition unless the user explicitly chooses to remove it from this browser. Unlocking it requires signing back into that same account. Account B never reads, adopts, or uploads A's partition. Document that browser storage isolation is an application boundary, not encryption against someone controlling the device/browser profile. A known expired/revoked session locks the workspace; unavailable-network status alone is not proof of revocation and retains the previously enabled offline workflow.

The API requires both installation ID/recovery epoch and expected account ID in the sync request context, comparing these with server identity/session. A mismatch stops syncing without reassignment. Post-restore recovery changes the epoch, revokes sessions, and forces reauthentication/reconciliation. Preserve all local records/outbox as a recovery workspace; never apply a fresh server snapshot over them automatically. Offer explicit re-upload as adopted copies or use of restored server data. A different installation at the same origin does not inherit authorization to the old installation's pending data.

Operator account disabling revokes server access immediately. Confirmed deletion purges the account's live records, sync metadata, and sessions; backup expiry follows documented operator retention. An offline device cannot learn deletion until it reconnects, at which point the old account is locked, never converted to guest data or another user's records.

### 8. Explicit, resumable adoption of guest records

On login show a non-blocking offer with the guest record counts and destination account. Skip leaves all guest data local and available in guest mode. Adopting copies a stable, validated snapshot into the account; it does not move/delete the source or start continuously mirroring guest edits.

Assign each source workspace a persistent UUID. Server adoption receipts keyed by `(owner, sourceWorkspace, entityType, sourceId)` store the target ID and source fingerprint. Preserve source IDs when possible; allocate and persist a stable mapping on collision rather than overwriting an existing account record. Copy games/players before dependent plays; map live references, preserve display names, and keep embedded template snapshots/category keys intact. References to missing historical source records remain nullable/opaque and cannot resolve to another owner's record. The account's local working copy receives exactly the accepted remapped document.

Reuse the normal mutation transaction and sync feed. Retry after interrupted upload returns the same mapping/result. If source content changes after its snapshot was adopted, report it as changed/already adopted and offer a deliberate copy/update flow; do not automatically duplicate or overwrite it. Invalid records are listed and skipped without deletion; valid records can continue. Progress reports local staging separately from server-acknowledged records, and partial adoption can resume.

Alternative: automatically attaching the current browser database to the first account creates ownership mistakes and collision risk. Matching by names loses distinct players/games and is not acceptable.

### 9. Docker Compose is part of release acceptance

Provide a multi-stage application Dockerfile and Compose services for `app`, `db`, and a one-shot migration command using the app image. The app serves frontend/API on one port behind a documented operator TLS proxy. A sample proxy configuration completes the supported HTTPS path; local development uses a documented localhost mode. Database ports are not published by default. Mount PostgreSQL storage in a named volume and use persistent runtime configuration for the installation identity.

Pin supported image/runtime major versions, run the app as a non-root user, and keep secrets outside image layers and committed configuration. Include health/readiness endpoints; start the app only after database health and migration success. Compose supports these ordering conditions, but the API also handles connection failures after startup. [Compose startup guidance](https://docs.docker.com/compose/how-tos/startup-order/)

Route `/api/*` before SPA fallback. API/auth responses are `no-store` and never cached by the service worker; missing APIs/assets return their proper status rather than HTML. Extend cached navigation for account and conflict routes without caching user-specific HTML or credentials. Keep `index.html`/worker updates compatible with offline clients; unsupported protocol versions pause uploads while preserving local changes.

Document fresh installation, provisioning, configuration, migrations, updates, logical PostgreSQL backup/restore, volume retention, and disaster recovery epoch changes. Verify restore into a clean isolated Compose project and container replacement with existing data. `docker compose down -v` is not an upgrade step. Backup artifacts require operator-chosen retention/protection; named volumes alone are not backups. No production deployment is included in implementing this change.

## Risks / Trade-offs

- [Per-user serialization and retained metadata grow with usage] Keep requests/pages bounded, batch pending edits, and measure representative history; do not prematurely add concurrent event allocation or unsafe cleanup.
- [Local data eviction before sync] Show pending status accurately; server persistence protects only acknowledged records.
- [Authentication adds account isolation to every path] Require two-user API tests and multi-tab browser switching tests, including in-flight responses and offline logout.
- [A server restore can invalidate cursor/revision assumptions] Recovery epoch rotation and explicit preserved-local-data reconciliation are required restore steps.
- [Adoption can partially succeed] Persist source/target mappings and use retry-safe server receipts; never delete source data on failure.
- [Offline cache cannot detect remote revocation] Document the trusted-device assumption and lock on explicit logout/known revocation; never claim offline remote revocation.
- [Scope spans frontend/backend/operations] Implement the ordered tasks in slices, but do not mark the release complete before two-browser offline/recovery and Compose restore checks pass.

## Migration Plan

1. Capture current test/build results and fixtures for the unowned version-1 IndexedDB database.
2. Add the server schema, migrations, account/API boundary, and Compose development services without removing guest mode.
3. Introduce scoped browser repositories and atomic outbox transactions; keep the old database as guest data.
4. Add account UI/sync/conflicts and deliberate guest adoption; test failure and upgrade with preexisting records.
5. Finish production image/proxy/backup documentation and run isolated deployment/recovery acceptance.

Database upgrades are explicit and backed up before execution. Rollback targets must declare schema compatibility; otherwise restore into an isolated project and follow the recovery-epoch procedure. Browser upgrades never reset databases or silently upload guest records. Preserve old caches only as needed for active clients, with protocol checks protecting the API from incompatible clients.

## Open Questions

Operator-created accounts are the draft assumption offered to the user; guest scoring remains available. A later explicit preference for open registration or OIDC requires updating account specs/tasks before implementation. No hosting provider is required: the operator supplies a domain/TLS proxy and retention settings. Exact supported dependency/image patches and Argon2 performance parameters are selected and pinned during implementation within the documented requirements. Native retirement remains undecided and does not block this web change.
