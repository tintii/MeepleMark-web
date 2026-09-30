## Context

MeepleMark already supports public username/password registration, admin roles, sessions, audit events, and Docker Compose. A fresh installation nevertheless requires CLI account creation, code redemption, and role promotion. Public registration must stay non-admin, so first-run ownership needs its own model rather than a special case in `/auth/register`.

## Goals / Non-Goals

**Goals:**

- Let a Docker Compose operator claim a fresh installation and create the first administrator entirely in the browser.
- Keep first-run setup distinct from normal public registration in the API, UI, and validation schemas.
- Guarantee that concurrent setup attempts create at most one administrator.
- Make the ownership and exposure boundary understandable in the setup UI and self-hosting guide.

**Non-Goals:**

- Replace administrator-managed public registration.
- Automatically promote users on installations that already contain accounts.
- Add email, invitations, OIDC, environment-defined passwords, or a second credential lifecycle.
- Remove operator recovery commands for an existing or damaged installation.

## Decisions

### Dedicated setup state and endpoint

`/api/v1/meta` exposes `setup.required`, computed as whether the installation contains zero users. A dedicated `POST /api/v1/setup/admin` accepts its own strict username, display-name, and password schema. It does not share the public registration route or accept a role.

The setup transaction locks the singleton installation row, rechecks that no user exists, inserts an enabled `admin` with an initialized Argon2id password, initializes sync state, records a secret-free `installation.admin_created` audit event, and creates the session. If any account already exists, setup returns a conflict and creates nothing. This lock also serializes against public registration, which already locks the installation row.

### Dedicated browser route

`/setup` reads public metadata and displays a focused first-run form when setup is required. The form includes username, optional display name, password, and password confirmation, uses password-manager autocomplete, and explains that this account controls the installation. On success it refreshes the account workspace and opens `/admin`, where the owner can choose whether to enable normal registration.

The Account screen links to installation setup when required. When setup is already complete, `/setup` explains that the installation is configured and directs visitors to sign in; it never offers promotion.

While setup remains required, the application shell also shows a compact notice linking to `/setup`. A visitor can dismiss it, with that choice stored locally for the current installation so it appears only once per browser. The notice is omitted on `/setup` itself and does not replace the persistent setup entry on the Account screen.

### Fresh-install exposure boundary

No setup secret is introduced. The supported Compose service binds to loopback by default, and documentation requires completing `/setup` before exposing the hostname to untrusted traffic. Origin checks, rate limiting, strict payload validation, no-store responses, and password redaction apply to the endpoint. This favors a simple UI-first local bootstrap while making the first-request ownership boundary explicit.

Alternative: an environment setup token reduces first-request risk but creates another secret that must be generated, transmitted, retained, and recovered. It can be added later if remote-first unattended deployment becomes a supported topology.

## Risks / Trade-offs

- An unclaimed installation exposed publicly can be claimed by an attacker. → Bind locally by default, warn in the UI and guide, and require setup before public proxy exposure.
- Two operators can submit simultaneously. → Serialize on the installation row and recheck zero users inside the transaction.
- An existing installation can lose all usable admins. → Never reopen browser setup once any user exists; retain explicit operator recovery.
- Metadata reveals that an installation is unclaimed. → Expose only a boolean and no account, database, or deployment details.

## Migration Plan

No schema migration is needed. Deploy the API and UI together, run existing migrations, start the Compose application on its loopback binding, open `/setup`, create the administrator, configure registration in `/admin`, and only then publish the HTTPS proxy. Existing installations report setup complete and retain their current accounts and registration policy.

## Open Questions

None for the supported single-host Compose topology.
