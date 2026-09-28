## Why

Joining a MeepleMark installation currently requires an operator to create an account and distribute a setup code. Users should be able to register through the browser, and administrators need a phone-friendly dashboard to manage access without routine shell commands.

## What Changes

- Add public username/password registration and normal sign-in, with guest use retained. Username/password is the agreed initial choice; email registration, verification, and email recovery remain a separate extension so SMTP is not required.
- Replace setup-code onboarding as the normal entry point with Create account. Keep existing setup codes valid and retain assisted password recovery as a secondary flow.
- Introduce exactly three account roles: `readonly` can view its own records; `user` can create, edit, and delete its own records; `admin` has the same personal workspace rights plus installation administration. Players remain independent of login accounts.
- Enforce permissions on the server and reflect them throughout browser editing, adoption, conflict resolution, and offline synchronization. Preserve pending edits when permissions are reduced.
- Add an admin dashboard for account search, roles, disabling/enabling, session revocation, assisted recovery, confirmed account deletion, registration settings, and an administrative audit history.
- Let administrators open or close registration and select `readonly` or `user` as the registration default (`user` initially). Start with registration closed until the operator enables it during installation or upgrade, so updating an existing private server does not silently open it to the public.
- Bootstrap the first administrator through an explicit operator command; never grant admin to the first public registrant. Protect the last active administrator from removal.

## Capabilities

### New Capabilities

- `public-account-registration`: Browser signup, registration policy, normal sign-in, and compatibility with existing account onboarding and recovery.
- `account-role-permissions`: Server-enforced `readonly`, `user`, and `admin` roles, ownership boundaries, and permission-aware offline behavior.
- `administration-dashboard`: Responsive account administration, registration controls, audit history, and operator bootstrap/recovery.

### Modified Capabilities

None are archived under `openspec/specs/`. This change builds on the implemented `self-hosted-accounts-and-sync` change. It supersedes that change's operator-only provisioning requirement and its public-registration exclusion, while retaining session validation, private ownership, guest use, explicit adoption, and Docker self-hosting. When archiving, reconcile those earlier requirements with this change rather than preserving contradictory signup rules.

## Impact

Adds PostgreSQL migrations for roles, registration settings, and administrative audit events; extends Fastify authentication, authorization, sync/adoption guards, operator commands, and installation metadata; adds browser registration and admin routes using existing visual tokens and responsive components. Updates readiness checks, upgrade/bootstrap instructions, and API/browser/Compose verification.

Existing account IDs, credentials, players, saved records, and browser partitions remain intact; existing accounts become `user` unless explicitly promoted. `SESSION_SECRET` remains a stable runtime deployment secret. Admin authority does not grant access to other users' score content or impersonation. Email delivery, shared workspaces, global read-only catalogues, OAuth/OIDC, and native iOS work are outside this proposal.
