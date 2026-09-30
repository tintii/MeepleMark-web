import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const meta = { protocolVersion: 1, installationId: "22222222-2222-4222-8222-222222222222", recoveryEpoch: "33333333-3333-4333-8333-333333333333", setup: { required: false }, registration: { enabled: false, defaultRole: "user" } };

async function mockWorkspace(page: Page, authenticated = false) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "Cache-Control": "no-store" } });
    if (url.pathname === "/api/v1/meta") return json(meta);
    if (url.pathname === "/api/v1/auth/session") return authenticated
      ? json({ accountId: "11111111-1111-4111-8111-111111111111", username: "member", displayName: "Member", role: "user", capabilities: { write: true, admin: false } })
      : json({ error: "unauthorized" }, 401);
    return json({ error: "not_found" }, 404);
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("administration distinguishes guests from authenticated accounts without permission", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

  await page.unrouteAll();
  await mockWorkspace(page, true);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("403", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access forbidden" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();
});

test("unknown routes and missing games share the 404 presentation and useful recovery", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto("/definitely-not-a-route");
  await expect(page).toHaveURL(/\/definitely-not-a-route$/);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoHorizontalOverflow(page);
  const home = page.getByRole("link", { name: "Home", exact: true });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Plays" })).toBeVisible();

  await page.goto("/collection/not-present");
  await expect(page).toHaveURL(/\/collection\/not-present$/);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Game not found" })).toBeVisible();
  await expect(page.locator("#main-content").getByRole("link", { name: "Collection" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("unexpected render failures show a secret-free 500 fallback with keyboard recovery", async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?e2eRenderFailure=1");
  await expect(page.getByText("500", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("E2E render failure");
  await expectNoHorizontalOverflow(page);

  const home = page.getByRole("link", { name: "Home", exact: true });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Plays" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?e2eRenderFailure=1");
  await expectNoHorizontalOverflow(page);
});
