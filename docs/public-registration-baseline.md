# Public registration implementation baseline

Before this change, MeepleMark had operator-created accounts, one-use setup and recovery codes, Argon2id passwords, opaque cookie sessions, owner-scoped PostgreSQL records, IndexedDB account partitions, an offline outbox, guest adoption, and Docker Compose deployment. The earlier `self-hosted-accounts-and-sync` change still has an outstanding browser UI review and remains recorded as such.

Server mutation entry points are:

- `POST /api/v1/sync/mutations`, including immutable mutation-receipt replay
- `POST /api/v1/adoption`, including adoption-receipt replay and its delegated sync mutations
- authentication setup, password change, logout, and session creation/revocation
- operator create, recovery, enable/disable, revoke, delete, and installation recovery reset commands

Browser account-data mutation entry points are centralized through `putScopedRecord` and `deleteScopedRecord`. Conflict resolution can create or resume outbox entries, and guest adoption stages mappings before uploading. Page-level editing actions call the storage repository rather than the network directly.

The initial migration is checksum tracked and is intentionally unchanged. Migration `002_registration_admin.sql` upgrades existing users to `user`, keeps registration closed, and adds administrative audit storage.
