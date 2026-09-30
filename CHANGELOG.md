# Changelog

Notable changes to MeepleMark are recorded here. The project does not have a versioned release yet, so completed work is grouped under initial development.

## [Unreleased]

### Added

- Offline JSON export of the active guest or private per-account workspace,
  preserving collection, player, play, and pending local data without exposing
  sync state or another account's content.
- Import and export individual game score sheets as JSON.
- A concise user manual, including the score-sheet JSON format.
- A development guide covering setup, checks, and the repository layout.
- Screenshots of play history and responsive scorekeeping layouts in the
  project documentation.
- Contextual offline-use help explaining what remains available without a
  connection and the limits of browser-local storage.
- An iPhone Safari prompt with instructions for adding MeepleMark to the Home
  Screen when it is not already installed.
- A header link to the MeepleMark source repository on GitHub.
- A repo-local Codex development workflow combining Ponytail, OpenSpec,
  changelog and documentation maintenance, verification guidance, and
  repeatable local setup.
- A one-time browser setup flow that creates and signs in the first
  administrator on a fresh self-hosted installation without terminal account
  commands, with a dismissible first-visit reminder linking to setup.

### Changed

- Added consistent, responsive 403, 404, and unexpected-error pages with safe
  recovery actions for forbidden access, unknown addresses, and missing games.
- Improved spacing and control styling in the score-sheet editor.
- Display imported win-direction and outcome rules correctly when starting a play.
- Redesigned the mobile navigation with recognizable dice, game-stack, and
  meeple icons plus evenly sized tab controls.
- Replaced the floating offline-ready badge with a compact header indicator and
  details popover.
- Improved mobile navigation and add-button spacing around device safe areas.
- Kept the root README focused on the product and quick start, with contributor
  workflow and roadmap details in dedicated documentation.
- Consolidated project, development, deployment, and verification documentation
  and archived completed OpenSpec changes.

### Fixed

- Restored clear spacing between account filters and account cards in the
  administration dashboard at phone and desktop widths.

## Initial development — 2026-09-19 to 2026-09-29

### Added

- Local-first scorekeeping with exact decimal calculations and IndexedDB storage.
- Game collection, player directory, score-sheet templates, play history, and scorepad views.
- Offline PWA support, responsive layouts, themes, and application icons.
- Optional accounts and PostgreSQL sync, including Docker-based self-hosting.
- Public registration controls and administration tools.
- A browser implementation of the Swift/iOS scoring model and shared golden
  scoring fixtures.
- Guest/local, account synchronization, registration, administration, and
  deployment acceptance coverage.
