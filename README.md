# MeepleMark

MeepleMark is a web-based board-game scorepad for recording players, games,
score sheets, and play history. It works well on phones and desktops, supports
offline scoring through IndexedDB, and can optionally synchronize account data
through a self-hosted Fastify/PostgreSQL service.

The scoring engine uses exact decimal arithmetic and supports category-based
score sheets, rankings, ties, manual overrides, cooperative results, drafts,
and completed-play history. Guest data stays in the browser; signed-in data is
saved locally first and synchronized when the server is available.

## LLM-generated project

This project—including much of its application code, tests, documentation, and
architecture—was generated broadly by large language models under human
direction. It should be treated as an experimental, LLM-assisted codebase:
review the implementation, security assumptions, migrations, and deployment
configuration carefully before relying on it in production.

## Stack

- React, TypeScript, and Vite
- IndexedDB for local and offline storage
- Fastify and PostgreSQL for optional account synchronization
- Vitest and Playwright for tests
- Docker Compose for self-hosting

## Local development

Guest mode needs no server:

```bash
npm install
npm run dev
```

Open `http://localhost:8787`.

For account-backed development, start PostgreSQL, run the migrations, and run
the API alongside Vite:

```bash
npm run migrate
npm run dev:server
npm run dev
```

## Tests

```bash
npm test
npm run lint
npm run build
npm run test:browser
```

PostgreSQL integration tests use [compose.integration.yaml](compose.integration.yaml).

## Accounts and administration

Guest scoring remains available without an account. An operator bootstraps the
first administrator with a one-use setup code, then explicitly opens public
username/password registration from `/admin`:

```bash
docker compose exec app node dist-server/cli.js account create admin "Administrator"
# Redeem the displayed code in /account, then promote the initialized account:
docker compose exec app node dist-server/cli.js account role admin admin
```

Accounts have one role: `readonly` can browse its own records, `user` can also
change them, and `admin` additionally manages installation access. Admin status
does not grant access to another account's games, players, or plays. Registration
starts closed and never grants `admin`. Recovery is administrator-assisted with
a one-use code because email delivery is intentionally not configured.

## Self-hosting

The supported deployment is a single-host Docker Compose stack behind an HTTPS
reverse proxy. Copy `.env.example` to an untracked `.env`, set strong values for
`POSTGRES_PASSWORD` and `SESSION_SECRET`, then follow the
[self-hosting guide](docs/self-hosting.md).

```bash
docker compose build
docker compose run --rm migrate
docker compose up -d app
```

Do not expose PostgreSQL directly to the internet. Back up the database volume;
a Docker volume by itself is not a backup.

## Documentation

- [Self-hosting and recovery](docs/self-hosting.md)
- [Persistence architecture](docs/self-hosted-persistence.md)
- [Account and sync verification](docs/accounts-sync-verification.md)
- [Registration and administration verification](docs/public-registration-verification.md)
- [Golden scoring corpus](golden/README.md)

The original scoring model and golden fixtures were ported from the sibling
Swift/iOS MeepleMark project.
