import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import { createAccount, revokeSessions } from "../server/operator";

const databaseUrl = process.env.TEST_DATABASE_URL;
test.skip(process.env.ACCOUNT_E2E !== "true" || !databaseUrl, "Run with ACCOUNT_E2E=true and TEST_DATABASE_URL against the local API/PostgreSQL stack.");

const password = "correct horse battery";

async function openPage(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

async function setup(page: Page, code: string): Promise<void> {
  await page.goto("/account");
  await page.getByLabel("Setup code").fill(code);
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
}

async function login(page: Page, username: string): Promise<void> {
  await page.goto("/account");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
}

async function sync(page: Page): Promise<void> {
  await page.goto("/account");
  const status = page.getByRole("status").filter({ hasText: /Saved|Waiting|Syncing|Synced|Needs|Sign in|Offline|recovery|unavailable/i });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expect(status).not.toContainText("Syncing");
    const settled = page.evaluate(() => new Promise<void>((resolve, reject) => {
      let started = false;
      const timeout = window.setTimeout(() => { window.removeEventListener("meeplemark:sync-status", listener); reject(new Error("sync did not settle")); }, 5_000);
      const listener = (event: Event) => {
        const next = (event as CustomEvent<string>).detail;
        if (next === "syncing") started = true;
        else if (started) { window.clearTimeout(timeout); window.removeEventListener("meeplemark:sync-status", listener); resolve(); }
      };
      window.addEventListener("meeplemark:sync-status", listener);
    }));
    const downloaded = page.waitForResponse((response) => response.url().includes("/api/v1/sync/changes?") && response.request().method() === "GET");
    await page.getByRole("button", { name: "Sync now" }).click();
    await Promise.all([downloaded, settled]);
    if ((await status.textContent())?.includes("Synced with server")) return;
  }
  await expect(status).toContainText("Synced with server");
}

async function editPlayer(page: Page, currentName: string, nextName: string, navigate = true): Promise<void> {
  if (navigate) await page.goto("/players");
  const row = page.getByRole("listitem").filter({ hasText: currentName });
  await row.getByRole("button", { name: "Edit" }).click();
  await page.locator(".edit-player-form").getByLabel("Display name").fill(nextName);
  await page.locator(".edit-player-form").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(nextName, { exact: true })).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

async function accountPlayers(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map((database) => database.name).filter((name): name is string => Boolean(name?.startsWith("meeplemark-account-")));
    const players: string[] = [];
    for (const name of names) {
      const request = indexedDB.open(name);
      const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const rows = await new Promise<Array<{ displayName?: string }>>((resolve, reject) => {
        const get = db.transaction("players").objectStore("players").getAll();
        get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error);
      });
      players.push(...rows.map((row) => row.displayName ?? "<missing>"));
      db.close();
    }
    return players;
  });
}

test("two clients adopt, sync offline work, resolve conflicts, isolate accounts, and retain expired-session work", async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  const pool = new Pool({ connectionString: databaseUrl });
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const firstUsername = `sync-${suffix}`;
  const secondUsername = `switch-${suffix}`;
  const first = await createAccount(pool, firstUsername, `Sync ${testInfo.project.name}`);
  const second = await createAccount(pool, secondUsername, `Switch ${testInfo.project.name}`);
  const firstContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string });
  const secondContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string });
  const firstPage = await openPage(firstContext, "/players");
  const secondPage = await openPage(secondContext, "/account");

  try {
    await firstPage.getByLabel("Display name").fill("Guest Avery");
    await firstPage.getByRole("button", { name: "Add player" }).click();
    await expect(firstPage.getByText("Guest Avery", { exact: true })).toBeVisible();

    await firstPage.setViewportSize({ width: 390, height: 844 });
    await firstPage.goto("/account");
    await firstPage.getByLabel("Setup code").focus();
    await firstPage.keyboard.press("Tab");
    await expect(firstPage.getByLabel("New password")).toBeFocused();
    await firstPage.keyboard.press("Tab");
    await expect(firstPage.getByRole("button", { name: "Set password and sign in" })).toBeFocused();
    await setup(firstPage, first.code);
    await expect(firstPage.getByText(/1 players, 0 plays/)).toBeVisible();
    await firstPage.getByRole("button", { name: "Copy guest data" }).click();
    await expect(firstPage.getByRole("status").filter({ hasText: "Server acknowledged 1 of 1" })).toBeVisible();
    await firstPage.setViewportSize({ width: 1440, height: 1000 });
    await sync(firstPage);

    await login(secondPage, firstUsername);
    await sync(secondPage);
    expect(await accountPlayers(secondPage)).toContain("Guest Avery");
    await secondPage.goto("/players");
    await expect(secondPage.getByText("Guest Avery", { exact: true })).toBeVisible();

    await firstPage.goto("/");
    await firstContext.setOffline(true);
    await firstPage.getByRole("link", { name: "Add Play" }).click();
    await firstPage.getByLabel("Game name").fill("Offline Garden");
    await firstPage.getByRole("textbox", { name: "Player 1", exact: true }).fill("Guest Avery");
    await firstPage.getByRole("button", { name: "Start play" }).click();
    await firstPage.getByRole("textbox", { name: "Guest Avery's score", exact: true }).fill("7.25");
    await firstPage.getByRole("button", { name: "Complete" }).click();
    await firstPage.getByRole("button", { name: "Not now" }).click();
    await firstPage.getByRole("button", { name: "View Plays" }).click();
    await expect(firstPage.getByText("Offline Garden", { exact: true })).toBeVisible();
    await firstContext.setOffline(false);
    await sync(firstPage);

    await sync(secondPage);
    await secondPage.goto("/");
    await expect(secondPage.getByText("Offline Garden", { exact: true })).toBeVisible();

    await firstPage.goto("/players");
    await firstContext.setOffline(true);
    await editPlayer(firstPage, "Guest Avery", "Mine Avery", false);
    await editPlayer(secondPage, "Guest Avery", "Server Avery");
    await sync(secondPage);
    await firstContext.setOffline(false);

    await firstPage.goto("/account");
    await firstPage.getByRole("button", { name: "Sync now" }).click();
    await expect(firstPage.getByRole("status").filter({ hasText: "Needs conflict review" })).toBeVisible();
    await firstPage.getByRole("link", { name: "Review conflicts" }).click();
    await firstPage.getByRole("button", { name: "Keep mine" }).click();
    await expect(firstPage.getByRole("status")).toContainText("retry");
    await sync(firstPage);
    await sync(secondPage);
    await secondPage.goto("/players");
    await expect(secondPage.getByText("Mine Avery", { exact: true })).toBeVisible();

    await firstPage.goto("/account");
    await signOut(firstPage);
    await setup(firstPage, second.code);
    await firstPage.goto("/players");
    await expect(firstPage.getByText("Mine Avery", { exact: true })).toHaveCount(0);
    await firstContext.clearCookies();
    await firstPage.evaluate(() => localStorage.removeItem("meeplemark:active-workspace"));
    await firstPage.reload();
    await expect(firstPage.getByRole("heading", { name: "Players" })).toBeVisible();
    await login(firstPage, firstUsername);

    await firstPage.goto("/players");
    await firstContext.setOffline(true);
    await editPlayer(firstPage, "Mine Avery", "Pending Avery", false);
    await revokeSessions(pool, firstUsername);
    await firstContext.setOffline(false);
    await firstPage.goto("/account");
    await firstPage.getByRole("button", { name: "Sync now" }).click();
    await expect(firstPage.getByRole("status").filter({ hasText: "Sign in again" })).toBeVisible();
    await firstPage.goto("/players");
    await expect(firstPage.getByText("Pending Avery", { exact: true })).toBeVisible();
  } finally {
    await firstContext.close();
    await secondContext.close();
    await pool.end();
  }
});
