## 1. JSON boundary

- [x] 1.1 Add a dependency-free score-sheet portability helper that serializes a `Template` as readable UTF-8 JSON and parses one JSON value through `TemplateValidation` — gate: focused Vitest cases round-trip every template field and reject malformed, non-object, unknown-field, duplicate-key, empty-label, and over-cap inputs.
- [x] 1.2 Define and enforce the 64 KiB import limit before `File.text()` is called — gate: a component test supplies an oversized file whose `text()` fails the test if invoked, and the editor reports the limit without invoking it.

## 2. Export

- [x] 2.1 Add an Export score sheet action to game detail only when a saved sheet exists, using a sanitized game-name filename, `application/json` blob, and revoked object URL — gate: a UI test captures the download and the helper validates its contents as exactly the saved template.
- [x] 2.2 Keep export read-only and local for guest, writable-account, and read-only-account views — gate: permission tests show each viewer can export, with no repository write, outbox entry, or network request.

## 3. Import and review

- [x] 3.1 Add a single-file JSON chooser to the write-gated score-sheet editor and atomically populate categories, win direction, and outcome only after full validation — gate: a UI test imports a valid file and observes all fields in source order while the stored game remains byte-for-byte unchanged.
- [x] 3.2 Render parse, size, read, and template-validation failures inline without changing form or stored state — gate: parameterized tests start with unsaved edits, exercise every failure class, and assert the same field values and persisted sheet remain.
- [x] 3.3 Save imported content through the existing `setTemplate` path while ignoring imported slug/version authority — gate: storage tests import source version 9 into destination version 2 and assert destination local slug/version 3; importing identical content preserves the destination version.

## 4. End-to-end verification

- [x] 4.1 Add a browser round-trip covering export from one game, import into another, review-before-save, explicit save, and offline operation — gate: Playwright completes the flow offline and the destination uses the transferred category order/rules with its own identity.
- [x] 4.2 Run `npm test`, `npm run lint`, `npm run build`, and the focused browser suite, then reconcile every `score-sheet-portability` scenario against automated coverage — gate: all commands pass and any unautomated divergence is recorded before the change is marked complete.
