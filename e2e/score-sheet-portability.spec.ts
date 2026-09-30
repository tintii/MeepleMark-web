import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openIsolatedApp, seedExistingFixture } from "./harness";

test("a score sheet exports and imports offline with review before destination-local save", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "webkit", "Playwright WebKit cannot read a selected file while its context is forced offline; WebKit file import is covered online below.");
  const database = await openIsolatedApp(page, testInfo, "/collection");
  await seedExistingFixture(page);
  await page.reload();

  await page.getByLabel("Game name").fill("Import Destination");
  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByRole("link", { name: "Import Destination" }).click();
  const destinationId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.getByRole("button", { name: "Export score sheet" })).toHaveCount(0);
  await page.getByRole("link", { name: "Add a score sheet" }).click();
  await page.getByLabel("Category 1 label").fill("Old one");
  await page.getByLabel("Category 2 label").fill("Old two");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("link", { name: "Edit score sheet" }).click();
  await page.getByLabel("Category 1 label").fill("Older one");
  await page.getByRole("button", { name: "Save" }).click();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Collection" }).click();
  await page.getByRole("link", { name: "Fixture Garden" }).click();
  await context.setOffline(true);
  try {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export score sheet" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("fixture-garden-score-sheet.json");
    const path = await download.path();
    if (!path) throw new Error("download did not produce a local file");
    const exportedText = await readFile(path, "utf8");
    expect(JSON.parse(exportedText)).toMatchObject({
      slug: "local:fixture-game",
      version: 2,
      winDirection: "high",
      defaultOutcome: "ranked",
      categories: [{ key: "flowers", label: "Flowers" }, { key: "paths", label: "Paths" }],
    });

    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Collection" }).click();
    await page.getByRole("link", { name: "Import Destination" }).click();
    await page.getByRole("link", { name: "Edit score sheet" }).click();
    const beforeImport = await readGame(page, database, destinationId);
    await page.getByLabel("Import score sheet JSON").setInputFiles(path);
    await expect(page.getByLabel("Category 1 label")).toHaveValue("Flowers");
    await expect(page.getByLabel("Category 2 label")).toHaveValue("Paths");
    await expect(page.getByLabel("Win direction")).toHaveValue("high");
    await expect(page.getByLabel("Outcome")).toHaveValue("ranked");
    expect(await readGame(page, database, destinationId)).toEqual(beforeImport);

    await page.getByRole("link", { name: "Import Destination" }).click();
    await page.getByRole("link", { name: "Edit score sheet" }).click();
    await expect(page.getByLabel("Category 1 label")).toHaveValue("Older one");
    await page.getByLabel("Import score sheet JSON").setInputFiles(path);
    await expect(page.getByLabel("Category 1 label")).toHaveValue("Flowers");
    await page.getByRole("button", { name: "Save" }).click();
    const saved = await readGame(page, database, destinationId);
    expect(saved.templateVersion).toBe(3);
    expect(saved.localTemplate).toMatchObject({
      slug: `local:${destinationId}`,
      version: 3,
      categories: [{ key: "flowers", label: "Flowers" }, { key: "paths", label: "Paths" }],
    });
  } finally {
    await context.setOffline(false);
  }
});

test("invalid and oversized imports preserve unsaved editor fields and storage", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.goto(`/collection/fixture-game/template?testDb=${database}`);
  await page.getByLabel("Category 1 label").fill("Unsaved flowers");
  const beforeImport = await readGame(page, database, "fixture-game");

  await page.getByLabel("Import score sheet JSON").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(page.getByLabel("Category 1 label")).toHaveValue("Unsaved flowers");
  expect(await readGame(page, database, "fixture-game")).toEqual(beforeImport);

  await page.getByLabel("Import score sheet JSON").setInputFiles({ name: "large.json", mimeType: "application/json", buffer: Buffer.alloc(64 * 1024 + 1, 32) });
  await expect(page.getByRole("alert")).toContainText("64 KiB or smaller");
  await expect(page.getByLabel("Category 1 label")).toHaveValue("Unsaved flowers");
  expect(await readGame(page, database, "fixture-game")).toEqual(beforeImport);
});

test("import immediately updates win direction and outcome controls", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.goto(`/collection/fixture-game/template?testDb=${database}`);

  const categoriesBox = await page.getByRole("group", { name: "Categories" }).boundingBox();
  const deleteButton = await page.getByRole("button", { name: "Delete score sheet" }).boundingBox();
  expect(categoriesBox).not.toBeNull();
  expect(deleteButton).not.toBeNull();
  expect(Math.abs((categoriesBox!.x + categoriesBox!.width) - (deleteButton!.x + deleteButton!.width))).toBeLessThanOrEqual(1);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose file" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "flagged-score-sheet.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      slug: "flagged-sheet",
      version: 1,
      winDirection: "low",
      defaultOutcome: "flagged",
      categories: [{ key: "points", label: "Points" }],
    })),
  });

  await expect(page.getByLabel("Win direction")).toHaveValue("low");
  await expect(page.getByLabel("Outcome")).toHaveValue("flagged");
  await expect(page.getByLabel("Outcome")).toContainText("Cooperative / solo (win or lose)");

  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("link", { name: "Add Play" }).click();
  await page.getByLabel(/Use “Fixture Garden” score sheet/).check();
  await expect(page.getByLabel("Win direction")).toHaveValue("low");
  await expect(page.getByLabel("Outcome")).toHaveValue("flagged");
});

test("a read-only account can export but cannot import or create a mutation", async ({ page }) => {
  const session = { accountId: "11111111-1111-4111-8111-111111111111", username: "reader", displayName: "Reader", role: "readonly", capabilities: { write: false, admin: false } };
  const meta = { protocolVersion: 1, installationId: "22222222-2222-4222-8222-222222222222", recoveryEpoch: "33333333-3333-4333-8333-333333333333", registration: { enabled: false, defaultRole: "user" } };
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/auth/session") return route.fulfill({ contentType: "application/json", body: JSON.stringify(session) });
    if (pathname === "/api/v1/meta") return route.fulfill({ contentType: "application/json", body: JSON.stringify(meta) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.goto("/collection");
  await expect(page.getByText("This account is read-only")).toBeVisible();
  const database = await page.evaluate(async () => {
    const name = (await indexedDB.databases()).find((candidate) => candidate.name?.startsWith("meeplemark-account-"))?.name;
    if (!name) throw new Error("account database was not opened");
    const request = indexedDB.open(name);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("games", "readwrite");
    transaction.objectStore("games").put({
      id: "readonly-game", name: "Reader's Game", slug: null, bggThingId: null, origin: "custom", ownedAt: "2026-01-01T00:00:00.000Z", templateVersion: 1,
      localTemplate: { slug: "local:readonly-game", version: 1, winDirection: "high", defaultOutcome: "ranked", categories: [{ key: "points", label: "Points" }] },
    });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
    return name;
  });
  await page.goto("/collection/readonly-game");
  await expect(page.getByRole("link", { name: "Edit score sheet" })).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export score sheet" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("reader-s-game-score-sheet.json");
  expect(await page.evaluate(async (name) => {
    const request = indexedDB.open(name);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const count = await new Promise<number>((resolve, reject) => {
      const operation = db.transaction("outbox").objectStore("outbox").count();
      operation.onsuccess = () => resolve(operation.result); operation.onerror = () => reject(operation.error);
    });
    db.close();
    return count;
  }, database)).toBe(0);
  await page.goto("/collection/readonly-game/template");
  await expect(page.getByRole("heading", { name: "Read-only account" })).toBeVisible();
  await expect(page.getByLabel("Import score sheet JSON")).toHaveCount(0);
});

interface StoredGame {
  templateVersion: number;
  localTemplate: { slug: string; version: number; categories: Array<{ key: string; label: string }> } | null;
  [key: string]: unknown;
}

async function readGame(page: import("@playwright/test").Page, database: string, id: string): Promise<StoredGame> {
  return page.evaluate(async ({ database, id }) => {
    const request = indexedDB.open(database);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("games");
    const get = transaction.objectStore("games").get(id);
    const value = await new Promise<StoredGame>((resolve, reject) => {
      get.onsuccess = () => resolve(get.result as StoredGame);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return value;
  }, { database, id });
}
