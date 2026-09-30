# MeepleMark

MeepleMark is a local-first board-game scorepad for phones and desktops. It
records games, players, reusable score sheets, drafts, results, and play history
without requiring an account or a network connection.

## What it does

- Scores games with either one total per player or up to ten custom categories.
- Calculates exact decimal totals, rankings, and ties while preserving manual
  total and rank overrides.
- Supports ranked games and explicit win/loss results for cooperative, solo, or
  elimination-based games.
- Keeps a game collection, player directory, reusable score sheets, and
  completed-play history.
- Imports and exports individual score sheets as JSON.
- Saves locally in IndexedDB and works offline after the application shell has
  been loaded successfully.
- Optionally synchronizes account-owned data through a self-hosted
  Fastify/PostgreSQL service.

See the [user manual](docs/user-manual.md) for the scoring workflow, score-sheet
management, offline behavior, accounts, and the JSON format.

## Quickstart

Requirements: Node.js 22 or later and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Continue as a guest to use the complete scoring
workflow without running the API or PostgreSQL.

For a production installation, follow the
[self-hosting guide](docs/self-hosting.md). For account-backed local development,
tests, and repository structure, see the
[development guide](docs/development.md).

## Documentation

- [User manual](docs/user-manual.md)
- [Development guide](docs/development.md)
- [Changelog](CHANGELOG.md)
- [Self-hosting, upgrades, backup, and recovery](docs/self-hosting.md)
- [Persistence and synchronization architecture](docs/self-hosted-persistence.md)
- [Golden scoring corpus](golden/README.md)

## Project status

MeepleMark is an experimental, LLM-assisted project. Review its security
assumptions, migrations, and deployment configuration before relying on it in
production.
