import { expect, test } from "@playwright/test";
import { openIsolatedApp, seedExistingFixture } from "./harness";

// These checks intentionally replace/control the same origin-wide worker.
test.describe.configure({ mode: "serial" });

test("cached root and nested play reload offline while data stays in IndexedDB", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "webkit", "Playwright WebKit on this Linux host fails internally on offline reload; Chromium covers the production worker path.");
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await expect(page.getByText("Ready for offline use")).toBeVisible({ timeout: 15_000 });
  await page.goto(`/play/fixture-category?testDb=${database}`);
  await expect(page.getByRole("heading", { name: "Fixture Garden" })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Fixture Garden" })).toBeVisible();
    await page.getByRole("button", { name: "Single player" }).click();
    await page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true }).fill("2.5");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true })).toHaveValue("2.5");

    const missingAsset = await page.evaluate(async () => {
      try {
        const response = await fetch("/assets/definitely-missing.js");
        return { ok: response.ok, contentType: response.headers.get("content-type"), body: await response.text() };
      } catch {
        return { ok: false, contentType: null, body: "" };
      }
    });
    expect(missingAsset.ok).toBe(false);
    expect(missingAsset.contentType ?? "").not.toContain("text/html");
    expect(missingAsset.body).not.toContain('<div id="root">');
  } finally {
    await context.setOffline(false);
  }
});

test("fresh production-preview deep links render without a pre-existing worker", async ({ page }, testInfo) => {
  const database = `meeplemark-e2e-${testInfo.project.name}-fresh-deep-link-${testInfo.retry}`;
  const response = await page.goto(`/collection/not-present?testDb=${database}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("alert")).toContainText("Game not found");
});

test("account and conflict routes use the offline shell without caching API data", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "webkit", "Playwright WebKit on this Linux host fails internally on offline reload; Chromium covers the production worker path.");
  const database = await openIsolatedApp(page, testInfo, "/account");
  await expect(page.getByText("Ready for offline use")).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

  await page.goto(`/conflicts?testDb=${database}`);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole("heading", { name: "Conflicts" })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Conflicts" })).toBeVisible();
    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/v1/auth/session");
        return { ok: response.ok, body: await response.text() };
      } catch {
        return { ok: false, body: "" };
      }
    });
    expect(apiResult.ok).toBe(false);
    expect(apiResult.body).not.toContain('<div id="root">');

    await page.goto(`/account?testDb=${database}`);
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("a waiting worker does not reload an active scoring client or touch IndexedDB", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "webkit", "Covered in Chromium because the Linux WebKit harness cannot reliably drive worker lifecycle transitions.");
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await expect(page.getByText("Ready for offline use")).toBeVisible({ timeout: 15_000 });
  await page.goto(`/play/fixture-category?testDb=${database}`);
  await page.getByRole("button", { name: "Single player" }).click();
  const field = page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true });
  await field.fill("-");

  const result = await page.evaluate(async () => {
    const navigationCount = performance.getEntriesByType("navigation").length;
    const registration = await navigator.serviceWorker.register("/e2e-update-sw.js", { scope: "/" });
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (registration.waiting) return resolve();
        if (Date.now() - started > 10_000) return reject(new Error("update worker did not enter waiting"));
        setTimeout(poll, 25);
      };
      poll();
    });
    const dbHasFixture = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open(new URLSearchParams(location.search).get("testDb")!);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction("plays").objectStore("plays").get("fixture-category");
        get.onsuccess = () => { db.close(); resolve(Boolean(get.result)); };
        get.onerror = () => reject(get.error);
      };
    });
    return { navigationCount, dbHasFixture, waiting: Boolean(registration.waiting) };
  });

  expect(result).toEqual({ navigationCount: 1, dbHasFixture: true, waiting: true });
  await expect(field).toHaveValue("-");
});
