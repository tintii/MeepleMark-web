## Context

Each `GameDocument` can carry one `localTemplate`, using the engine's standalone `Template` shape: `slug`, `version`, `winDirection`, `defaultOutcome`, and one to ten ordered categories. `TemplateValidation` already validates that boundary, while `setTemplate` owns destination-local slugs and version increments. The browser app works offline and stores guest or account-scoped records locally before any synchronization.

This change needs a file boundary, but not a new data model. The important distinction is between portable sheet content and local identity: categories and scoring rules should transfer; a source game's local slug and version must not become authoritative in the destination.

## Goals / Non-Goals

**Goals:**

- Round-trip one saved score sheet through human-readable JSON using the existing template contract.
- Validate imported data before it reaches editor state or storage.
- Let the user review imported content and explicitly save it to a chosen game.
- Preserve the existing local identity, versioning, offline, permission, and sync paths.

**Non-Goals:**

- Full backup/restore or import/export of games, plays, players, accounts, or collections.
- Multiple sheets in one file, automatic game matching, or creating a game from a file.
- A new schema version, server endpoint, cloud picker, dependency, or native iOS implementation.
- Trusting imported source identity or expanding the L1 scoring model.

## Decisions

### D1 — The file is the existing standalone `Template` JSON document

Export serializes the saved `localTemplate` with two-space indentation and a trailing newline. Import parses one JSON value and runs `TemplateValidation`; no parallel portable-sheet type or envelope is introduced.

*Alternatives considered:*

- **A new envelope with a format version and game metadata.** Rejected. There is only one small document to carry, the existing shape is already versioned and validated, and game matching is explicitly out of scope.
- **Export only category labels and rules.** Rejected. That creates a second schema and validator for no user-visible gain. The source `slug` and `version` can remain harmless provenance because D3 prevents them from becoming destination identity.
- **Export the whole `GameDocument`.** Rejected. Collection state, IDs, origin, and ownership are not a score sheet and would turn this into partial backup/restore.

### D2 — Export is a local browser download from game detail

When a saved sheet exists, game detail offers Export to every user who can view that game, including a read-only account user. The browser creates a UTF-8 `application/json` `Blob`, triggers a download with a sanitized game-name-based filename, and revokes the object URL. No server round trip is required.

*Alternatives considered:*

- **Put export only in the write-gated editor.** Rejected. Export is read-only and should remain available to a user who can view but not edit their records.
- **Add an API export endpoint.** Rejected. The complete sheet is already in the local document, and a server dependency would break guest/offline use.
- **Use the Web Share API.** Rejected as the sole path because browser/file support varies; an ordinary download is the portable baseline. Sharing can be additive later.

### D3 — Import loads content into the editor; Save assigns destination identity

The editor accepts one `.json` file, checks its size, parses it, validates it, and then replaces the form's category labels, win direction, and outcome. It does not write storage. The user reviews the result and presses the existing Save button, which calls `setTemplate`; that path generates the destination game's `local:<game-id>` slug and next version. The imported `slug` and `version` are never passed as persistence authority.

*Alternatives considered:*

- **Save immediately after file selection.** Rejected. A file-picker action should not silently overwrite a valid sheet, and review is nearly free because the editor already exists.
- **Preserve the imported slug and version.** Rejected. Local slugs contain source-local game identity, may collide, and imported versions must not roll destination history backward or jump it arbitrarily.
- **Create or match a game from the imported slug.** Rejected. A local slug is not a shared game identity, and the established merge keys are `slug` for corpus games and `bggThingId`, not this file's template slug.

### D4 — Import is bounded and failure is non-destructive

Files larger than 64 KiB are refused before reading. JSON parse errors and every validation issue are shown inline. On any failure, the saved sheet and every current form field remain unchanged. File MIME type is not trusted; the selected bytes are parsed as text and JSON because browsers and operating systems report JSON types inconsistently.

*Alternatives considered:*

- **No size limit because valid sheets are small.** Rejected. File selection is a trust boundary, and the cap cheaply prevents accidentally loading an enormous file into memory while leaving ample space for ten labels.
- **Accept valid-looking fields and discard unknown or invalid ones.** Rejected. Silent repair makes exports non-deterministic and can change scoring rules. Existing strict validation should report the problem instead.
- **Replace fields progressively while parsing.** Rejected. Atomic state replacement after complete validation is simpler and guarantees failure cannot leave a half-imported form.

### D5 — One pure helper owns serialization and parsing

A small module converts a `Template` to download text and converts bounded JSON text to a validated `Template`. React pages own only file/download browser mechanics and state updates. Tests call the pure helper directly; browser tests cover the two controls and the review-before-save flow.

*Alternatives considered:*

- **Put parsing and serialization directly in React handlers.** Rejected. It makes failure branches awkward to test and invites the import and export shapes to drift.
- **Add a JSON Schema validator dependency.** Rejected. `TemplateValidation` is already the application boundary used by the editor and shared documents.

## Risks / Trade-offs

- **[A source-local slug exposes an opaque game ID in the exported JSON]** → Treat it as provenance only and document that import ignores it. If exports later need privacy-redacted metadata, introduce a versioned envelope then rather than weakening the current template contract now.
- **[A valid import accidentally replaces carefully edited unsaved fields]** → File selection is explicit, successful import replaces the form atomically, and no durable change occurs until Save. Browser coverage verifies Cancel/navigation leaves the stored sheet untouched.
- **[An invalid or hostile file consumes memory or reaches persistence]** → Refuse files over 64 KiB before `text()`, catch parse errors, run strict `TemplateValidation`, and mutate neither form nor storage on failure.
- **[Downloaded JSON differs from what scoring uses]** → Serialize `game.localTemplate` directly and round-trip it through the same parser/validator in a unit test.
- **[Account synchronization treats import as a foreign revision]** → Import itself creates no mutation. Explicit Save uses the existing scoped repository/outbox and normal destination revision path.

## Migration Plan

No stored-data or database migration is required. Deploy the new controls and helper with the normal web release; existing games immediately qualify when `localTemplate` is present. Rollback removes the controls and helper without altering stored sheets or previously downloaded files.

## Open Questions

None. Bulk portability and full backup/restore remain separate product decisions rather than blockers for single-sheet files.
