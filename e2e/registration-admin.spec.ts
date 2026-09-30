import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { createAccount, setAccountRole } from "../server/operator";

test.use({ serviceWorkers: "block" });

const adminSession = { accountId: "11111111-1111-4111-8111-111111111111", username: "admin", displayName: "Administrator", role: "admin", capabilities: { write: true, admin: true } };
const meta = { protocolVersion: 1, installationId: "22222222-2222-4222-8222-222222222222", recoveryEpoch: "33333333-3333-4333-8333-333333333333", setup: { required: false }, registration: { enabled: true, defaultRole: "user" } };
const managed = { id: "44444444-4444-4444-8444-444444444444", username: "avery", displayName: "Avery", role: "user", disabled: false, createdAt: "2026-09-28T00:00:00.000Z" };

async function mockAdmin(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/v1/auth/session") return json(adminSession);
    if (url.pathname === "/api/v1/meta") return json(meta);
    if (url.pathname === "/api/v1/admin/overview") return json({ totalAccounts: 2, enabledAccounts: 2, activeAdmins: 1 });
    if (url.pathname === "/api/v1/admin/users") return json({ items: [managed], page: 1, limit: 25, total: 1 });
    if (url.pathname === "/api/v1/admin/registration") return json(meta.registration);
    if (url.pathname === "/api/v1/admin/audit") return json({ items: [{ id: "1", occurred_at: "2026-09-28T00:00:00.000Z", source: "cli", actor_id: null, target_id: adminSession.accountId, action: "account.role_changed", before_summary: { role: "user" }, after_summary: { role: "admin" } }], total: 1 });
    return json({}, route.request().method() === "DELETE" ? 204 : 200);
  });
}

test("fresh installations create their first administrator in the browser", async ({ page }) => {
  let setupRequired = true;
  let signedIn = false;
  let setupRequests = 0;
  let setupPayload: Record<string, unknown> = {};
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/v1/meta") return json({ ...meta, setup: { required: setupRequired }, registration: { enabled: false, defaultRole: "user" } });
    if (url.pathname === "/api/v1/auth/session") return signedIn ? json(adminSession) : json({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/v1/setup/admin" && route.request().method() === "POST") {
      setupRequests += 1;
      setupPayload = route.request().postDataJSON();
      setupRequired = false;
      signedIn = true;
      return json({ accountId: adminSession.accountId, csrfToken: "test-csrf" }, 201);
    }
    if (url.pathname === "/api/v1/admin/overview") return json({ totalAccounts: 1, enabledAccounts: 1, activeAdmins: 1 });
    if (url.pathname === "/api/v1/admin/users") return json({ items: [], page: 1, limit: 25, total: 0 });
    if (url.pathname === "/api/v1/admin/registration") return json({ enabled: false, defaultRole: "user" });
    if (url.pathname === "/api/v1/admin/audit") return json({ items: [], total: 0 });
    return json({}, 404);
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const setupNotice = page.getByRole("complementary", { name: "Installation setup reminder" });
  await expect(setupNotice).toBeVisible();
  await setupNotice.getByRole("link", { name: "Set up now" }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.goto("/");
  await setupNotice.getByRole("button", { name: "Dismiss" }).click();
  await expect(setupNotice).toBeHidden();
  await page.reload();
  await expect(setupNotice).toBeHidden();
  await page.goto("/account");
  await page.getByRole("link", { name: "Create first administrator" }).click();
  await expect(page.getByRole("heading", { name: "Create the first administrator" })).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Display name").fill("Administrator");
  await page.locator('input[name="password"]').fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("different horse battery");
  await page.getByRole("button", { name: "Create administrator" }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(setupRequests).toBe(0);
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create administrator" }).click();
  await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
  expect(setupRequests).toBe(1);
  expect(setupPayload).toEqual({ username: "admin", displayName: "Administrator", password: "correct horse battery" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Setup complete" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("registration and administration reflow at phone and desktop widths with keyboard-safe deletion", async ({ page }) => {
  await mockAdmin(page);
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    await expect(page.locator('a[href="/admin"]')).toHaveCount(1);
    await expect(page.getByText("Avery", { exact: true })).toBeVisible();
    const listGap = await page.locator(".admin-user-card").evaluate((card) => card.getBoundingClientRect().top - document.querySelector(".admin-filters")!.getBoundingClientRect().bottom);
    expect(listGap).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  const deleteButton = page.getByRole("button", { name: "Delete", exact: true });
  await deleteButton.focus(); await deleteButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Type avery to confirm")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(deleteButton).toBeFocused();
});

test("open registration is usable at 375px and direct non-admin access is denied", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/meta") return route.fulfill({ contentType: "application/json", body: JSON.stringify(meta) });
    if (url.pathname === "/api/v1/auth/session") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.unrouteAll();
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/session") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...adminSession, role: "user", capabilities: { write: true, admin: false } }) });
    if (url.pathname === "/api/v1/meta") return route.fulfill({ contentType: "application/json", body: JSON.stringify(meta) });
    return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "admin_forbidden" }) });
  });
  await page.goto("/admin"); await expect(page.getByRole("heading", { name: "Access forbidden" })).toBeVisible(); await expect(page.getByText("403", { exact: true })).toBeVisible(); await expect(page.locator('a[href="/admin"]')).toHaveCount(0);
});

test("real registration, demotion with held offline work, and restoration", async ({ browser }, testInfo) => {
  test.skip(process.env.ACCOUNT_E2E !== "true" || !process.env.TEST_DATABASE_URL, "Requires the real local API and PostgreSQL.");
  test.setTimeout(60_000);
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const adminName = `admin-${suffix}`;
  const userName = `member-${suffix}`;
  const created = await createAccount(pool, adminName, "Test Administrator");
  const adminContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string });
  const userContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL as string });
  const adminPage = await adminContext.newPage(); const userPage = await userContext.newPage();
  try {
    await adminPage.goto("/account"); await adminPage.getByRole("button", { name: "Use a recovery or activation code" }).click();
    await adminPage.getByLabel("Setup code").fill(created.code); await adminPage.getByLabel("New password").fill("correct horse battery");
    await adminPage.getByRole("button", { name: "Set password and sign in" }).click(); await expect(adminPage.getByRole("heading", { name: "Workspace" })).toBeVisible(); await setAccountRole(pool, adminName, "admin");
    await adminPage.goto("/admin"); await expect(adminPage.getByRole("heading", { name: "Administration", exact: true })).toBeVisible();
    await adminPage.getByLabel("Open public registration").check(); await adminPage.getByRole("button", { name: "Save registration" }).click();
    await expect(adminPage.getByRole("status")).toContainText(/saved/i);

    await userPage.goto("/account"); await userPage.getByRole("heading", { name: "Create account" }).waitFor();
    const registrationForm = userPage.locator("form").filter({ has: userPage.getByRole("button", { name: "Create account" }) });
    await registrationForm.getByLabel("Username").fill(userName); await registrationForm.getByLabel("Password").fill("correct horse battery"); await registrationForm.getByRole("button", { name: "Create account" }).click();
    await expect(userPage.getByText("user", { exact: true })).toBeVisible();

    await userPage.goto("/players"); await userContext.setOffline(true); await userPage.getByLabel("Display name").fill("Held Offline"); await userPage.getByRole("button", { name: "Add player" }).click();
    await adminPage.goto(`/admin`); const card = adminPage.locator(".admin-user-card").filter({ hasText: `@${userName}` }); await card.getByLabel(`Role for ${userName}`).selectOption("readonly");
    await expect(adminPage.getByRole("status")).toContainText("readonly");
    await userContext.setOffline(false); await userPage.goto("/account"); await expect(userPage.getByText("readonly", { exact: true })).toBeVisible(); await expect(userPage.locator(".save-status").filter({ hasText: "held locally" })).toBeVisible();

    await card.getByLabel(`Role for ${userName}`).selectOption("user"); await userPage.reload(); await expect(userPage.getByText("user", { exact: true })).toBeVisible();
    await userPage.getByRole("button", { name: "Sync now" }).click(); await expect(userPage.getByRole("status").filter({ hasText: "Synced with server" })).toBeVisible();
  } finally { await adminContext.close(); await userContext.close(); await pool.end(); }
});
