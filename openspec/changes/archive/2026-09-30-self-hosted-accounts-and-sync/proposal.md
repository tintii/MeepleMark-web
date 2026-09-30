## Why

MeepleMark's browser data currently lives on one device, so users cannot retrieve their players, games, and plays from another browser or restore them from an operated server. Add a self-hosted PostgreSQL service while preserving offline scoring and the separation between authenticated users and the players they record.

## What Changes

- Add a TypeScript application API and PostgreSQL persistence with private, account-owned games, player directories, score sheets, collection membership, and plays.
- Introduce user accounts separately from players. Preserve guest scoring; sign-in enables synchronization to this installation rather than becoming a prerequisite for recording a game.
- Provide operator-created local accounts, login, password/session management, and operator recovery without requiring a hosted identity service or email delivery. Operator-created accounts are the draft default pending any different product preference.
- Add a durable browser outbox and revision-based synchronization, with retry-safe operations, incremental downloads, deletion markers, and explicit conflict resolution.
- Offer deliberate migration of existing guest/local data into an account, with resumable progress and no automatic adoption at sign-in.
- Distinguish saving on this device from synchronization to the server. Keep account caches isolated when signing out, switching users, or using another installation.
- Deliver a production Docker image, a single-host Compose deployment with persistent PostgreSQL storage, database migrations, and tested backup/restore and upgrade instructions.
- Preserve the completed iOS-parity work, existing routes, exact decimal scoring, template snapshots, historical names, and mobile/desktop layouts. Native iOS integration remains deferred.

## Capabilities

### New Capabilities

- `self-hosted-user-accounts`: Local account lifecycle, guest access, sessions, and operator provisioning/recovery.
- `account-owned-persistence`: PostgreSQL ownership boundaries, validation, and self-contained play storage.
- `offline-account-sync`: Durable local changes, versioned server mutations, change downloads, deletion, and conflict recovery.
- `local-data-adoption`: Explicit, retry-safe adoption of existing browser records into an account.
- `docker-self-hosting`: Production packaging, configuration, migrations, persistent storage, and operational recovery.

### Modified Capabilities

None are archived in `openspec/specs/`. The completed `ios-parity-responsive-web` change remains the UI/engine baseline. This change extends its local saving/offline behaviour with account synchronization; its original no-backend scope is not a restriction on this work.

## Impact

Adds `server/`, SQL migrations, shared browser/server document validation boundaries, account/settings screens, synchronization modules, Docker/Compose files, and operator documentation. Refactors `src/storage/db.ts` into an explicitly scoped repository and changes local mutation transactions to record pending uploads. Extends Vitest, real-PostgreSQL integration tests, and Playwright with multiple users/browsers and restart/recovery cases.

Existing local records must survive upgrade; introducing account storage must not silently upload, reassign, or delete them. Current decimal-string wire documents and golden fixtures remain compatible. Self-hosting introduces an operator-managed service but does not authorize publishing or deploying it during proposal/application work.

Out of scope: public registration, OIDC, public shared game catalogues, group ownership, simultaneous collaborative scoring, automatic player-to-user linking, federation between installations, native iOS sync, BGG integration, general import/export, Kubernetes, and mandatory managed services.
