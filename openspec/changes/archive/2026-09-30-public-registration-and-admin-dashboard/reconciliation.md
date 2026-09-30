## Reconciliation with self-hosted accounts

This change supersedes only the earlier `self-hosted-accounts-and-sync`
requirement that normal accounts be operator-provisioned and its explicit
exclusion of public signup. Public registration is now an administrator-controlled
username/password flow that starts closed. Operator setup codes remain for the
first administrator and assisted recovery.

The earlier guest continuity, Argon2id credentials, opaque sessions, origin and
CSRF checks, private owner scoping, explicit guest adoption, offline outbox,
conflict handling, Docker topology, backup/restore, and recovery-epoch
requirements remain in force. All three roles still see only their own game
content; `admin` adds installation account management rather than ownership
bypass. The earlier task 8.3 UI review remains incomplete and is not represented
as completed by this change.
