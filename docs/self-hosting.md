# Self-hosting MeepleMark

## Supported deployment and limits

The supported account-backed topology is one application container and one
PostgreSQL 17 container on a single Compose host, behind an operator-managed
same-origin HTTPS proxy. The application container runs as a non-root user; the
database has no public port; migrations run as a separate one-shot service.

MeepleMark provides operator-controlled public username/password registration,
but not email recovery, OIDC, multi-host orchestration, bundled TLS/DNS,
monitoring, or an off-host backup target. Accounts are installation-local. Guest mode
continues to work without the server. Browser caches are not encrypted from a
person controlling that browser profile, offline clients learn about remote
revocation only after reconnecting, and only server-acknowledged data is covered
by server backups.

## Install and provision

Requirements: Docker Engine with Compose v2 (or a compatible Compose
implementation), an HTTPS reverse proxy, and protected storage for `.env` and
backups. Copy `.env.example` to an untracked `.env`, set a random database
password and a random `SESSION_SECRET` of at least 32 characters, and set the
public HTTPS `APP_ORIGIN`. Never commit that file.

```bash
mkdir -p secrets
docker compose build
docker compose run --rm migrate
docker compose up -d app
docker compose exec app node dist-server/cli.js account create admin "Administrator"
```

Redeem the displayed one-use setup code at `/account`, then explicitly promote
the initialized, enabled account and sign in again or refresh:

```bash
docker compose exec app node dist-server/cli.js account role admin admin
```

Open `/admin` to choose the `user` or `readonly` signup default and deliberately
open registration. Registration begins closed on fresh installs and upgrades;
the first registrant is never promoted automatically. Use `account recovery
admin` to invalidate older codes and issue a replacement. Codes expire after 24
hours and are never stored in plaintext.
The database has no published host port. The application binds to loopback by
default; adapt `docs/Caddyfile.example` for the public hostname and TLS.

Keep the application and API on the exact `APP_ORIGIN`; cross-origin writes are
rejected. A first sign-in/setup and unlocking after explicit logout require the
server, while an already activated account workspace remains usable offline.

## Upgrade and rollback

Take a logical backup first. Pull the new source/image, build it, run the
one-shot migration service, then replace only the app container:

```bash
docker compose build app migrate
docker compose run --rm migrate
docker compose up -d --no-deps app
```

Do not run `docker compose down -v`: `-v` deletes the database volume. A failed
migration is transactionally rolled back and prevents the new app from becoming
ready. Inspect its output, retain the database, and either fix forward or run an
older image only when its documented schema is compatible. Otherwise restore a
backup into a separate Compose project.

Only run application builds that support the database's active schema. For a
rollback across incompatible schemas, stop traffic and restore the matching
database backup into a separate Compose project, acknowledging any newer data
that the restore discards.

## Backup and restore

Named volumes are not backups. Store dumps encrypted with operator-selected
retention and access controls.

```bash
docker compose exec -T db pg_dump -U meeplemark -d meeplemark -Fc > meeplemark.dump
docker compose stop app
docker compose exec -T db dropdb -U meeplemark --if-exists meeplemark
docker compose exec -T db createdb -U meeplemark meeplemark
docker compose exec -T db pg_restore -U meeplemark -d meeplemark --clean --if-exists < meeplemark.dump
docker compose run --rm migrate
docker compose run --rm app node dist-server/cli.js installation rotate-recovery --confirm ROTATE
docker compose up -d app
```

The final command changes the recovery epoch and revokes every session. Browsers
therefore preserve their old epoch's local database/outbox and require explicit
sign-in/reconciliation rather than replaying newer offline changes into the
restored server. Verify account counts plus representative games, players,
templates, memberships, plays, decimal totals, and snapshots before directing
users to the restored installation.

## Account operations

```bash
docker compose exec app node dist-server/cli.js account recovery alice
docker compose exec app node dist-server/cli.js account role alice readonly
docker compose exec app node dist-server/cli.js account role alice user
docker compose exec app node dist-server/cli.js account role alice admin
docker compose exec app node dist-server/cli.js account disable alice
docker compose exec app node dist-server/cli.js account enable alice
docker compose exec app node dist-server/cli.js account revoke alice
docker compose exec app node dist-server/cli.js account delete alice --confirm alice
```

Deletion cascades through that account's server records and requires exact
confirmation. It cannot erase offline copies on browsers, and protected backups
retain data until their operator-defined expiry. The CLI and dashboard prevent
demoting, disabling, or deleting the last enabled administrator with an
initialized password.

## Readiness and troubleshooting

`/health/live` reports that the process is running. `/health/ready` additionally
requires PostgreSQL and the compatible migration version. `/api/*` is always
`no-store`; missing APIs and assets never receive the SPA shell. Local
development runs `npm run dev:server` beside `npm run dev`, whose proxy keeps API
traffic same-origin at `http://localhost:5173`.

## Deployment verification

Before serving traffic, confirm that the migration exits successfully, both
health endpoints pass through the HTTPS proxy, PostgreSQL has no published
port, account login works, and representative records survive an application
container replacement. Test backup restoration and recovery-epoch rotation on
the actual deployment infrastructure; a local TypeScript/Vite build is not an
image or recovery check.
