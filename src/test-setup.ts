// Provides IndexedDB in the vitest node environment, so src/storage/db.ts
// (which uses the browser's real IndexedDB via `idb`) can be exercised
// without a browser.
import "fake-indexeddb/auto";
