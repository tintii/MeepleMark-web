## Context

The repository already contains Fastify/PostgreSQL accounts, Argon2id passwords, opaque cookie sessions, an operator CLI, IndexedDB account partitions, an offline outbox, guest-data adoption, and Docker Compose. The earlier self-hosting change has one UI-review task outstanding; this proposal does not mark that work complete. The historical OpenSpec configuration still describes that implementation as future work; actual source is the baseline here.

`server/operator.ts` creates accounts with expiring setup codes. `src/pages/Account.tsx` makes code redemption the onboarding path. `users` has no role, and authenticated accounts currently have write access to their own domain records. Public signup requires both a simpler entry point and explicit authorization rules.

## Goals / Non-Goals

**Goals:** Browser username/password registration; `readonly`, `user`, and `admin` authorization; a responsive admin dashboard; safe upgrades; continued private ownership, guest scoring, and offline use.

**Non-Goals:** Email collection, SMTP, email verification/reset, OAuth/OIDC, shared workspaces, user impersonation, browsing other users' game content, arbitrary database administration, native app changes, or deployment during proposal work.

## Decisions

### 1. Username and password are the registration identity

The user selected username/password with email deferred. Signup requests contain username and password, with an optional display name. Reuse existing username normalization and password validation; return useful field errors for unavailable usernames and invalid values. Use the same normalized uniqueness rule in registration, login, and operator commands. Keep Argon2id hashing and the existing session lifecycle.

`POST /api/v1/auth/register` atomically checks registration policy, creates the user with the configured non-admin role, initializes sync state, and establishes a session. A competing signup for the same normalized username yields one account and one ordinary validation/conflict response. Reject unknown fields, including role, owner ID, and disabled status. No records from the guest workspace are adopted automatically.

Retain `/auth/setup` for existing setup codes and assisted recovery. Normal users see Create account and Sign in; code redemption is behind a recovery/activation link. A lost registration response can be recovered by normal sign-in, rather than retrying with a different identity.

Alternative: email-first signup adds address verification, mail delivery, and recovery operations. Those are intentionally deferred by the user's choice.

### 2. Roles supplement ownership

Add a non-null constrained `users.role` with values `readonly`, `user`, and `admin`, defaulting existing users to `user`. Read current role/status from PostgreSQL for each authenticated API request; expose the role and derived capabilities in session metadata. Treat unknown or missing permissions as denied until the client refreshes them.

| Operation | readonly | user | admin |
| --- | --- | --- | --- |
| Read own games, players, plays, and downloaded history | Yes | Yes | Yes |
| Create, edit, delete, score, or adopt records in own account | No | Yes | Yes |
| Change own password, sign out | Yes | Yes | Yes |
| Manage accounts, roles, registration, audit history | No | No | Yes |
| Read or edit another account's game content | No | No | No |

`readonly` is an account-data restriction, not a ban on changing credentials or local cache maintenance. It grants no shared/global library. Guest use remains a separate local workspace. Admin can disable/delete an account and thus affect its data lifecycle, but ordinary sync APIs continue to scope every request to the authenticated owner.

Centralize `requireWriteAccess` and `requireAdmin` checks. Apply write authorization to all mutation paths, including sync receipts/replay, adoption, and conflict uploads. Admin status does not bypass ownership checks. For writes and role/status changes, use a shared per-account transaction lock order and recheck authorization inside the transaction: work committed before a demotion may succeed; work serialized after it must be rejected.

Alternative: hiding edit buttons only leaves API and offline uploads writable. Encoding the role only in a cookie would leave stale administrator access after demotion.

### 3. Offline caches preserve work without granting server privileges

Centralize capability checks in the account repository as well as the UI. A known `readonly` account cannot create local account mutations or new outbox entries. Reading/downloads and own password controls remain available. Refresh permissions at login, focus, reconnect, and before resuming queued uploads; publish changes across tabs.

An offline browser cannot learn a remote role change immediately. It can continue according to the last confirmed role; the API is authoritative when it reconnects. On `write_forbidden`, refresh capabilities, stop upload/adoption retries, and continue read synchronization where authorized. Retain pending local edits and separate server shadows; never discard or report them as synchronized. Show a clear read-only notice and count of edits held locally. Restore upload eligibility only after confirmed write permission returns, using normal revision-conflict rules. If an account is disabled or deleted, retain the existing authorization-loss/locked-workspace behavior.

Admin operations require a live connection and are never queued in IndexedDB. Admin response data and audit history stay out of service-worker caches and durable browser storage.

Alternative: clearing the outbox on demotion loses legitimate offline work; endlessly retrying denied mutations misrepresents a permission problem as a network failure.

### 4. Administration is a small installation dashboard

Add `/admin` with an overview, paginated/searchable accounts, account detail/actions, registration settings, and paginated audit history. Use the existing theme and components. On phones, account rows become readable cards or compact stacked rows, with labelled actions and confirmation dialogs. On desktop, use a table where it improves scanning. Direct links work, keyboard focus is managed, and wide tables do not force page-level horizontal scrolling.

The dashboard supports viewing username/display name, role, enabled status and creation time; changing roles; disabling/enabling; revoking sessions; issuing a replacement recovery code; and deleting an account with typed username confirmation. Recovery codes are shown once to the issuing administrator for private handoff; reissuing invalidates previous codes. Administrators cannot inspect passwords or session tokens, and a recovery action does not reveal existing credentials. Successful password recovery revokes previous sessions and preserves the assigned role. Disabled accounts cannot redeem codes until re-enabled.

Suggested API surface under `/api/v1/admin`: overview, paginated users and user details, role/status updates, revoke-sessions, recovery, confirmed deletion, registration settings, and audit events. All routes require an enabled admin session; all writes require Origin/CSRF validation. Validate payloads and page bounds server-side. Return `401` for no valid session, `403` for insufficient role, and `409` for last-admin/policy conflicts.

Alternative: a general management console adds unrelated database/hosting functionality. Account administration is the immediate need.

### 5. Registration settings and admin bootstrap are explicit

Persist `registration_enabled` (initially false) and `registration_default_role` (`user` initially, only `readonly` or `user` allowed) on the installation row. Publish only these public capabilities through installation metadata. Both fresh setup and upgrades require an administrator to enable registration. The dashboard presents a straightforward Open registration control; closing it does not disable existing accounts or guest use.

Keep role assignment out of the public registration payload. Policy checks and account creation serialize against policy changes, so a request serialized after closure cannot create an account. Changing the default affects only later signups.

Add a documented operator `account role <username> <readonly|user|admin>` command sharing the dashboard's role-change service. On a fresh installation, the operator creates and activates their account with the existing CLI once, promotes it to admin, then opens registration from the dashboard. Upgrades promote an existing enabled, password-initialized account. Public registrants are never automatically promoted, even when no administrator exists.

Reject demotion, disabling, or deletion of the last enabled admin with an initialized password. Serialize all admin membership/status changes and deletions under the installation lock; the CLI follows the same invariant. A filesystem/database operator can recover administrator access through the documented CLI promotion flow without changing ordinary account data. Enabling a previously disabled admin and deleting a user follow the same lock order.

Alternative: making the first registrant admin introduces a takeover race. Environment-defined admin passwords introduce a second credential lifecycle and are unnecessary with the existing CLI.

### 6. Administrative actions have an audit record

Store append-only administrative events with time, source (`web` or `cli`), actor ID where applicable, target ID where applicable, action, and an allowlisted before/after summary. Persist successful mutations and their audit entries in the same transaction. Include role/status changes, registration policy changes, session revocation, recovery issuance, and deletion. A deleted actor/target must not cascade-delete audit history; retain stable ID references without requiring live user foreign keys. Do not store deleted account content or credentials in these events.

Audit responses omit passwords, hashes, tokens, setup/recovery codes, and database/deployment secrets. Recovery secrets appear only in the direct no-store issuing response, never in audit history or ordinary logs. The dashboard has no audit edit/delete operation. Audit storage is backed up with PostgreSQL; no claim of tamper resistance against the database operator is made.

### 7. Retain deployment and authentication boundaries

Keep `SESSION_SECRET` supplied through runtime deployment configuration and stable across replicas/restarts. This proposal does not move secrets into PostgreSQL. Public signup is Origin-checked and rate-limited before expensive hashing, alongside existing login/setup limits. Limit proxy trust to documented trusted hops so spoofed forwarding headers cannot bypass per-client limits; the supported deployment remains one app instance behind the configured proxy, without a new horizontal-scaling claim.

Keep API responses `no-store`, including admin errors. Sensitive payload redaction must cover new password/recovery fields and responses. Do not loosen Secure-cookie production behavior to make local examples work; document HTTPS for the production Compose journey.

## Risks / Trade-offs

- Public signup can consume storage and hashing resources → bounded requests and attempts, explicit registration control, account disable/delete tools; no promise of internet-scale abuse resistance.
- Username-only recovery requires administrator assistance → retain recovery codes as a secondary flow and clearly explain it in the UI; email recovery is deferred.
- A remote demotion cannot instantly update an offline device → preserve local work and enforce current privileges at the server before committing writes.
- Administrators have destructive account-management powers → role checks, explicit deletion confirmation, last-admin protection, and transactional audit records.
- Existing server binaries do not enforce roles → do not run mixed old/new API versions after introducing read-only accounts; rollback requires stopping traffic and restoring a matching backup or an authorization-compatible build.
- Earlier account specs forbid public signup → explicitly reconcile superseded provisioning requirements when archiving, preserving unaffected account/sync requirements.

## Migration Plan

1. Back up the current database and record the baseline account IDs, credentials, ownership and sync state. Do not edit checksum-tracked `001_initial.sql`.
2. Add a new serialized migration for roles, installation settings and audit history. Existing users become `user`; registration is closed; no account is automatically promoted. Update readiness to recognize the expected new schema.
3. Deploy the API and UI together; refresh cached clients and deny writes from any client lacking current authorization. Old clients still cannot bypass server role guards. Preserve existing account partitions, pending edits, setup codes, and session identity.
4. Promote an enabled existing account through the CLI, or create/activate/promote the first operator account. Sign in, verify dashboard access, choose the signup default and open registration deliberately.
5. Exercise signup, each role, demotion/reconnect, account recovery, last-admin protection, container replacement, and backup restore using the documented Compose topology. Review at phone and desktop sizes.
6. Roll back only to a build enforcing the new authorization model, or stop service and restore the pre-upgrade database together with its matching build. Document any post-backup data loss before such a restore; never silently drop tables or clear browser data.

## Open Questions

No blocking product decisions remain. Username/password registration and the three role names are confirmed. The proposed access scope keeps all domain records private and gives administrators account-management authority; shared read-only libraries or administrative content browsing would need an explicit follow-up proposal.
