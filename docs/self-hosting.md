# Self-hosting MeepleMark

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
docker compose exec app node dist-server/cli.js account create alice "Alice"
```

Give the displayed one-use setup code to Alice through a protected channel. It
expires after 24 hours and is never stored in plaintext. Use
`account recovery alice` to invalidate older codes and issue a replacement.
The database has no published host port. The application binds to loopback by
default; adapt `docs/Caddyfile.example` for the public hostname and TLS.

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
docker compose exec app node dist-server/cli.js account disable alice
docker compose exec app node dist-server/cli.js account enable alice
docker compose exec app node dist-server/cli.js account revoke alice
docker compose exec app node dist-server/cli.js account delete alice --confirm alice
```

Deletion cascades through that account's server records and requires exact
confirmation. It cannot erase offline copies on browsers, and protected backups
retain data until their operator-defined expiry.

## Readiness and troubleshooting

`/health/live` reports that the process is running. `/health/ready` additionally
requires PostgreSQL and the compatible migration version. `/api/*` is always
`no-store`; missing APIs and assets never receive the SPA shell. Local
development runs `npm run dev:server` beside `npm run dev`, whose proxy keeps API
traffic same-origin at `http://localhost:5173`.

