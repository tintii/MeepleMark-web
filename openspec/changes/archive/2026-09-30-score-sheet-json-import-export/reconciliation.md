# Reconciliation

All `score-sheet-portability` requirements are implemented without a new dependency, schema, API, or persistence path.

| Spec behavior | Automated coverage |
|---|---|
| Export exact saved `Template`, safe filename, and JSON round trip | `scoreSheetPortability.test.ts`; Playwright offline round trip |
| Offline export/import and no export for a game without a sheet | Chromium Playwright round trip |
| Import for review without saving; leaving discards imported form state | Playwright round trip compares IndexedDB before Save, leaves, and reopens the editor |
| Destination slug/version authority and unchanged-content no-op | `db.test.ts`; Playwright destination save |
| Malformed, non-object, unknown-field, duplicate-key, empty-label, over-cap, unreadable, and oversized rejection | `scoreSheetPortability.test.ts`; Playwright preservation checks |
| Read-only export with no mutation; import remains write-gated | Chromium and WebKit Playwright permission test |
| Signed-in Save uses the normal outbox | `db.test.ts` account-workspace outbox test |

Verification passes: `npm test` (146 passed, 21 environment-gated skipped), `npm run lint`, `npm run build`, and the focused Playwright suite (5 passed, 1 harness skip). The skip is limited to Playwright WebKit's inability to read a selected file while its entire context is forced offline; Chromium verifies the offline round trip, while WebKit verifies file validation and permission behavior online.

An additional full `npm run test:browser` audit found 16 unrelated existing failures: two acceptance tests still call `selectOption` on the newer colour-picker control, and fourteen stored visual baselines already differ on screens untouched by this change. The new focused tests passed during that run; no baseline was updated as part of this feature.
