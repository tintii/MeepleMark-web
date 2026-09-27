import type { Page, TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

export const viewports = {
  phone320: { width: 320, height: 720 },
  phone390: { width: 390, height: 844 },
  tablet768: { width: 768, height: 1024 },
  desktop1440: { width: 1440, height: 1000 },
} as const;

export function testDatabaseName(testInfo: TestInfo): string {
  const safeTitle = testInfo.titlePath.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
  return `meeplemark-e2e-${testInfo.project.name}-${safeTitle}-${testInfo.retry}`;
}

export async function openIsolatedApp(page: Page, testInfo: TestInfo, path = "/"): Promise<string> {
  const name = testDatabaseName(testInfo);
  const separator = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${separator}testDb=${name}`);
  return name;
}

export async function setStorageControl(
  page: Page,
  control: { delayMs?: number; failures?: number },
): Promise<void> {
  await page.evaluate(({ delayMs, failures }) => {
    if (delayMs === undefined) localStorage.removeItem("meeplemark:e2e:write-delay");
    else localStorage.setItem("meeplemark:e2e:write-delay", String(delayMs));
    if (failures === undefined) localStorage.removeItem("meeplemark:e2e:write-failures");
    else localStorage.setItem("meeplemark:e2e:write-failures", String(failures));
  }, control);
}

export async function deleteTestDatabase(page: Page, name: string): Promise<void> {
  await page.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  }, name);
}

export async function seedExistingFixture(page: Page): Promise<void> {
  const fixture = JSON.parse(await readFile(new URL("../tests/fixtures/existing-indexeddb.json", import.meta.url), "utf8")) as {
    games: unknown[];
    players: unknown[];
    plays: unknown[];
  };
  await page.evaluate(async (data) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(new URLSearchParams(location.search).get("testDb") ?? "meeplemark", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of ["games", "players", "plays"]) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["games", "players", "plays"], "readwrite");
        for (const game of data.games) transaction.objectStore("games").put(game);
        for (const player of data.players) transaction.objectStore("players").put(player);
        for (const play of data.plays) transaction.objectStore("plays").put(play);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, fixture);
}
