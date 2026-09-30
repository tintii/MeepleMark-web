import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openIsolatedApp, seedExistingFixture } from "./harness";

async function downloadedJson(page: Page): Promise<Record<string, unknown>> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).focus();
  await page.keyboard.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^meeplemark-workspace-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  if (!path) throw new Error("download did not produce a local file");
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

test("a guest exports the complete populated workspace offline", async ({ page, context }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/account");
  await seedExistingFixture(page);
  await expect(page.getByLabel("Offline use status: ready")).toBeVisible({ timeout: 15_000 });
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(page.getByRole("heading", { name: "Export workspace" })).toBeVisible();
  await expect(page.getByText(/private collection, player, and play data/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await context.setOffline(true);
  try {
    const document = await downloadedJson(page) as {
      format: string; version: number; games: Array<Record<string, unknown>>; players: Array<Record<string, unknown>>; plays: Array<Record<string, unknown>>;
    };
    expect(document.format).toBe("meeplemark-workspace");
    expect(document.version).toBe(1);
    expect(document.games).toHaveLength(1);
    expect(document.games[0]).toMatchObject({ id: "fixture-game", ownedAt: "2026-01-01T00:00:00.000Z", templateVersion: 2, localTemplate: { version: 2 } });
    expect(document.players).toEqual([expect.objectContaining({ id: "fixture-player", displayName: "Avery" })]);
    expect(document.plays.map((play) => play.id)).toEqual(["fixture-plain", "fixture-category"]);
    expect(document.plays[0]).toMatchObject({ status: "complete", players: [{ total: "-1.5", totalIsOverridden: true }] });
    expect(document.plays[1]).toMatchObject({ status: "draft", gameRef: "fixture-game", scoring: { version: 1 } });
    expect((document.plays[1].players as Array<Record<string, unknown>>)[0]).toMatchObject({ playerRef: "fixture-player", categories: { flowers: "0.1", paths: "0.2" }, total: "4", totalIsOverridden: true, rankIsOverridden: true });
    expect(requests).toEqual([]);
  } finally {
    await context.setOffline(false);
  }
});

for (const role of ["readonly", "user", "admin"] as const) {
  test(`${role} exports only pending content in the active local account workspace`, async ({ page, context }) => {
    const accountId = `export-${role}`;
    const session = { accountId, username: role, displayName: role, role, capabilities: { write: role !== "readonly", admin: role === "admin" } };
    const meta = { protocolVersion: 1, installationId: "export-installation", recoveryEpoch: "export-epoch", setup: { required: false }, registration: { enabled: false, defaultRole: "user" } };
    await page.route("**/api/v1/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/api/v1/auth/session") return route.fulfill({ contentType: "application/json", body: JSON.stringify(session) });
      if (pathname === "/api/v1/meta") return route.fulfill({ contentType: "application/json", body: JSON.stringify(meta) });
      if (pathname === "/api/v1/sync/changes") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [], cursor: 0, highWater: 0, initialSyncComplete: true }) });
      return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    });
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
    await context.setOffline(true);
    const before = await page.evaluate(async ({ accountId, role }) => {
      const name = (await indexedDB.databases()).find((candidate) => candidate.name?.startsWith("meeplemark-account-") && candidate.name.endsWith(accountId))?.name;
      if (!name) throw new Error("active account database was not opened");
      const request = indexedDB.open(name);
      const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const player = { id: `pending-${role}`, displayName: `Pending ${role}`, bggUsername: null, preferredColorIndex: null };
      const transaction = db.transaction(["players", "outbox"], "readwrite");
      transaction.objectStore("players").put(player);
      transaction.objectStore("outbox").put({ key: `player:${player.id}`, entityType: "player", entityId: player.id, generation: 1, operation: "put", document: player, baseRevision: 0, state: "pending", mutationId: null, payload: null, updatedAt: "2026-09-30T00:00:00.000Z" });
      await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
      const foreignRequest = indexedDB.open(`meeplemark-account-foreign-${role}`, 1);
      const foreign = await new Promise<IDBDatabase>((resolve, reject) => { foreignRequest.onupgradeneeded = () => foreignRequest.result.createObjectStore("players", { keyPath: "id" }); foreignRequest.onsuccess = () => resolve(foreignRequest.result); foreignRequest.onerror = () => reject(foreignRequest.error); });
      await new Promise<void>((resolve, reject) => { const tx = foreign.transaction("players", "readwrite"); tx.objectStore("players").put({ id: "foreign-secret", displayName: "Foreign secret" }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      foreign.close();
      const outbox = await new Promise<unknown[]>((resolve, reject) => { const get = db.transaction("outbox").objectStore("outbox").getAll(); get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
      db.close();
      return { name, outbox };
    }, { accountId, role });

    try {
      const document = await downloadedJson(page) as { players: Array<{ id: string }> };
      expect(document.players.map((player) => player.id)).toEqual([`pending-${role}`]);
      expect(document.players.map((player) => player.id)).not.toContain("foreign-secret");
      const after = await page.evaluate(async (name) => {
        const request = indexedDB.open(name);
        const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const outbox = await new Promise<unknown[]>((resolve, reject) => { const get = db.transaction("outbox").objectStore("outbox").getAll(); get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
        db.close();
        return outbox;
      }, before.name);
      expect(after).toEqual(before.outbox);
    } finally {
      await context.setOffline(false);
    }
  });
}

test("an unreadable record prevents a partial download", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/account");
  await seedExistingFixture(page);
  await page.evaluate(async () => {
    const request = indexedDB.open(new URLSearchParams(location.search).get("testDb")!);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const transaction = db.transaction("plays", "readwrite");
    transaction.objectStore("plays").put({ id: "broken-play", playedAt: "2026-09-30T00:00:00.000Z", status: "draft", gameName: "Broken", gameRef: null, play: { id: "broken-play", players: [] } });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  });
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("play 'broken-play'");
  await expect(page.getByRole("alert")).toContainText("Nothing was exported");
  expect(downloaded).toBe(false);
});
