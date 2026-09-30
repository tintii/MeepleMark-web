## Why

MeepleMark users can export one score sheet, but they cannot take a portable copy of the collection, players, and play history held in their current workspace. A single workspace export gives guests and account users a simple way to retain or inspect their data without weakening account isolation or depending on server connectivity.

## What Changes

- Add a versioned JSON export containing every logical game record (including collection membership and saved score sheets), player record, and play in the active workspace.
- Generate the export entirely from the active browser workspace so it includes locally saved and pending account changes, works offline, and is available to guest, read-only, user, and admin workspaces.
- Put the export action on the Account page, where workspace-scoped controls already live. Keep the Administration page focused on installation access and make clear that an administrator cannot export another account's private content.
- Validate records before producing the file, report unreadable records without silently omitting them, and make no local write, sync mutation, or server request.
- Define export only in this change. Import/restore, selective CSV reports, scheduled exports, server-wide exports, credentials, administrative audit history, and replacement of operator PostgreSQL backups remain out of scope.

## Capabilities

### New Capabilities

- `workspace-data-export`: Versioned, offline JSON export of the active workspace's games, collection state, score sheets, players, and plays with validation and privacy boundaries.

### Modified Capabilities

None.

## Impact

The browser storage boundary gains a read-only snapshot/serialization path, and the Account UI gains a download action and failure feedback. Unit and browser coverage will verify the schema, complete record coverage, offline/read-only behavior, corrupt-record handling, and absence of writes or network requests. User documentation and the roadmap will distinguish personal workspace export from score-sheet transfer and operator database backup. No server API, database migration, dependency, or stored-data change is required.
