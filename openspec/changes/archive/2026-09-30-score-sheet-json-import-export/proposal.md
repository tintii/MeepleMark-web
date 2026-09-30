## Why

Score sheets are currently trapped in the browser or account where they were authored, so recreating the same categories and rules on another installation is manual and error-prone. A small JSON import/export path makes a sheet portable while reusing the template contract and validation that already protect scoring.

## What Changes

- Allow a user to download a game's saved score sheet as a JSON file using the existing standalone `Template` document shape.
- Allow a user to select a JSON score-sheet file in a game's score-sheet editor, validate it, and load its categories, win direction, and outcome into the form for review before saving.
- Treat imported `slug` and `version` as source metadata only. Saving uses the destination game's local slug and normal versioning, so an import cannot impersonate another game's sheet or move the version backwards.
- Report malformed, unreadable, or invalid JSON inline without changing the saved sheet or discarding the current editor state.
- Keep import and export local and usable offline for guests and signed-in users.

Out of scope:

- Importing or exporting completed plays, players, games, collections, accounts, or a full backup.
- Bulk/multi-sheet archives, cloud storage integrations, automatic synchronization, and native iOS support.
- Adding formulas, multipliers, or any scoring fields beyond the existing L1 template contract.
- Automatically matching, creating, or overwriting a game from metadata in an imported file.

## Capabilities

### New Capabilities

- `score-sheet-portability`: Exporting one saved score sheet as validated JSON and importing one JSON sheet into the current game's editor without bypassing review, local identity, or version rules.

### Modified Capabilities

None. No capability has been archived into `openspec/specs/`; this extends the completed score-sheet editor baseline with a separately scoped portability contract.

## Impact

- `src/pages/GameDetail.tsx` gains download for a saved sheet; `src/pages/TemplateEditor.tsx` gains local file import and inline error states.
- A small helper near the existing engine/document boundary serializes and validates score-sheet JSON; the existing `Template`, `TemplateValidation`, `buildTemplateCandidate`, and `setTemplate` paths remain authoritative.
- Focused Vitest coverage verifies round trips, invalid-file handling, and destination version/identity behaviour; browser coverage verifies file selection and download affordances.
- No database schema, API, synchronization protocol, server endpoint, dependency, or engine model change is required.
