import { expect, test } from "@playwright/test";
import { openIsolatedApp, seedExistingFixture, viewports } from "./harness";

async function hideTransientStatus(page: import("@playwright/test").Page) {
  await page.addStyleTag({ content: ".offline-status { display: none !important; }" });
}

test("theme toggle overrides and persists the system appearance", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openIsolatedApp(page, testInfo);

  const root = page.locator("html");
  const useDarkMode = page.getByRole("button", { name: "Use dark mode" });
  await expect(useDarkMode).toBeVisible();
  await expect(root).not.toHaveAttribute("data-theme");

  await useDarkMode.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Use light mode" })).toBeVisible();

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Use light mode" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
});

test("pastel candy surfaces render in light and dark appearances", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.setViewportSize(viewports.desktop1440);
  await page.goto(`/?testDb=${database}`);
  await hideTransientStatus(page);
  await expect(page.getByRole("list", { name: "Play history" })).toBeVisible();
  await expect(page).toHaveScreenshot("theme-populated-light.png");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page).toHaveScreenshot("theme-populated-dark.png");
});

test("forms dialogs and plain scoring retain the shared theme", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.setViewportSize(viewports.phone390);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/play/new?testDb=${database}`);
  await hideTransientStatus(page);
  await expect(page.locator(".page")).toHaveScreenshot("theme-new-play-phone-dark.png");

  await page.goto(`/play/fixture-plain?testDb=${database}`);
  await hideTransientStatus(page);
  await expect(page.getByRole("group", { name: "Player scores" })).toBeVisible();
  await expect(page.locator(".page")).toHaveScreenshot("theme-plain-score-phone-dark.png");

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/?testDb=${database}`);
  await hideTransientStatus(page);
  await page.getByRole("button", { name: /Delete .* play from/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveScreenshot("theme-dialog-phone-light.png");
});

test("focus remains visible and decorative transitions respect reduced motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await openIsolatedApp(page, testInfo, "/play/new");
  const focused = page.getByLabel("Game name");
  await focused.focus();
  await expect(focused).toBeFocused();
  const styles = await focused.evaluate((element) => {
    const computed = getComputedStyle(element);
    const rawDuration = computed.transitionDuration.split(",")[0]?.trim() ?? "0s";
    const durationMs = rawDuration.endsWith("ms") ? Number.parseFloat(rawDuration) : Number.parseFloat(rawDuration) * 1000;
    return { outlineStyle: computed.outlineStyle, outlineWidth: computed.outlineWidth, durationMs };
  });
  expect(styles.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(styles.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(styles.durationMs).toBeLessThanOrEqual(0.01);
});
