<h1><img src="public/favicon.svg" alt="" width="42" height="42"> MeepleMark</h1>

MeepleMark is a local-first board-game scorepad for phones and desktops. It
records games, players, reusable score sheets, drafts, results, and play history
without requiring an account or a network connection.

**[Try the live demo](https://tintii.github.io/MeepleMark-web/)** — guest mode
only. Scores are stored in your own browser; the demo has no accounts, sync, or
database.

<p>
  <div>Desktop view:</div>
  <img src="docs/images/play-history.png" alt="MeepleMark play history on desktop" width="720"> 
</p>
<p>
  <div>Phone view:</div>
  <img src="docs/images/play-history-mobile.png" alt="MeepleMark play history on mobile" width="168">
</p>

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

Clone the repository first:

```bash
git clone https://github.com/tintii/MeepleMark-web.git
cd MeepleMark-web
```

Requirements: Node.js 22 or later and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:8787`. Continue as a guest to use the complete scoring
workflow without running the API or PostgreSQL.

For account-backed development and project checks, see the
[development guide](docs/development.md). For deployment and operations, see
the [self-hosting guide](docs/self-hosting.md).

## Documentation

- [User manual](docs/user-manual.md)
- [Development guide](docs/development.md)
- [Changelog](CHANGELOG.md)
- [Self-hosting, upgrades, backup, and recovery](docs/self-hosting.md)
- [Persistence and synchronization architecture](docs/self-hosted-persistence.md)
- [Roadmap](docs/roadmap.md)
- [Golden scoring corpus](golden/README.md)

## Project status

MeepleMark is an experimental, LLM-assisted project. Review its security
assumptions, migrations, and deployment configuration before relying on it in
production.
