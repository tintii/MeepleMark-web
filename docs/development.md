# Development guide

## Stack

- React, TypeScript, and Vite
- IndexedDB for local/offline storage
- Fastify and PostgreSQL for optional account synchronization
- Vitest and Playwright for tests
- Docker Compose for self-hosting

## Guest development

With Node.js 22 or later:

```bash
npm install
npm run dev
```

Vite serves the browser application at `http://localhost:5173`. Guest mode does
not need the API or PostgreSQL.

## Account-backed development

Start the disposable integration database, migrate it, then run the API and
Vite in separate terminals:

```bash
docker compose -f compose.integration.yaml up -d test-db
export DATABASE_URL=postgres://meeplemark_test:integration-only@127.0.0.1:55432/meeplemark_test
npm run migrate
npm run dev:server
```

```bash
npm run dev
```

The Vite server proxies `/api` and `/health` to the API at
`http://127.0.0.1:8787`. The development server supplies development-only
defaults for the session secret and application origin; production must use the
settings in the [self-hosting guide](self-hosting.md).

## Checks

```bash
npm test
npm run lint
npm run build
npm run test:browser
```

PostgreSQL integration tests require the integration database:

```bash
npm run test:integration
```

## Repository development workflow

Codex discovers the repo-local `meeplemark-development` skill under
`.codex/skills/`. Development work uses its bundled Ponytail rules to prefer the
smallest correct change and uses OpenSpec to propose, implement, and archive
planned changes. Start by checking active work with:

```bash
openspec list --json
```

The skill also provides a repeatable setup helper. Guest mode installs locked
dependencies; account mode additionally starts and migrates the disposable
integration database:

```bash
.codex/skills/meeplemark-development/scripts/setup-local.sh guest
.codex/skills/meeplemark-development/scripts/setup-local.sh account
```

Every completed repository change belongs under `[Unreleased]` in
`CHANGELOG.md`. Review documentation impact at the same time: update the user
manual for product behavior, this guide for development workflow, the
self-hosting guide for deployment and operations, and the persistence document
for architecture. Keep the root README limited to the product overview,
essential guest quick start, and links to these canonical documents.

## Repository map

| Path | Purpose |
|---|---|
| `src/` | Browser UI, scoring engine, local storage, and synchronization client |
| `server/` | Fastify API, authentication, synchronization, and operator CLI |
| `migrations/` | PostgreSQL migrations |
| `e2e/` | Playwright browser journeys |
| `golden/` | Cross-platform scoring fixtures |
| `docs/` | User, development, architecture, and deployment guides |
| `openspec/` | Feature proposals, specifications, designs, and task records |
| `.codex/skills/` | Repo-local Codex, Ponytail, OpenSpec, and setup workflows |

The scoring engine keeps decimals exact and serializes score values as strings.
Stored plays embed score-sheet snapshots so later edits cannot change history.
See [persistence architecture](self-hosted-persistence.md) for ownership,
offline queues, revisions, conflicts, and recovery behavior.
