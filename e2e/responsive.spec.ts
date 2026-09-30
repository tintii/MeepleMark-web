import { expect, test } from "@playwright/test";
import { openIsolatedApp, seedExistingFixture, viewports } from "./harness";

const routes = [
  "/",
  "/collection",
  "/collection/fixture-game",
  "/collection/fixture-game/template",
  "/players",
  "/play/new",
  "/play/fixture-plain",
  "/play/fixture-category",
  "/account",
  "/conflicts",
];

test("phone navigation and add actions stay within thumb reach", async ({ page }, testInfo) => {
  await page.setViewportSize(viewports.phone390);
  await openIsolatedApp(page, testInfo);

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const navBox = await nav.boundingBox();
  const addBox = await page.getByRole("link", { name: "Add Play" }).boundingBox();
  expect(navBox).not.toBeNull();
  expect(addBox).not.toBeNull();
  expect(Math.abs((navBox?.y ?? 0) + (navBox?.height ?? 0) - viewports.phone390.height)).toBeLessThan(1);
  expect((addBox?.y ?? 0) + (addBox?.height ?? 0)).toBeLessThan(navBox?.y ?? 0);
  await expect(nav.getByRole("link", { name: "Plays" }).locator("span[aria-hidden]"))
    .toHaveCSS("background-color", "rgb(235, 207, 106)");
  await expect(nav.getByRole("link", { name: "Collection" }).locator("span[aria-hidden]"))
    .toHaveCSS("background-color", "rgb(143, 211, 165)");
  await expect(nav.getByRole("link", { name: "Players" }).locator("span[aria-hidden]"))
    .toHaveCSS("background-color", "rgb(143, 176, 232)");
  await expect(nav.locator('svg[data-icon="dice"]')).toBeVisible();
  await expect(nav.locator('svg[data-icon="game-stack"]')).toBeVisible();
  await expect(nav.locator('svg[data-icon="meeple"]')).toBeVisible();

  const tabWidths = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().width));
  expect(Math.max(...tabWidths) - Math.min(...tabWidths)).toBeLessThan(1);

  await nav.getByRole("link", { name: "Collection" }).click();
  await page.getByRole("button", { name: "Go to add game form" }).click();
  await expect(page.getByLabel("Game name")).toBeFocused();

  await nav.getByRole("link", { name: "Players" }).click();
  await page.getByRole("button", { name: "Go to add player form" }).click();
  await expect(page.getByLabel("Display name")).toBeFocused();
});

test("every route stays within the page viewport at the required widths", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  for (const viewport of Object.values(viewports)) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`${route}?testDb=${database}`);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("enlarged text reflows category scoring and preserves partial entry across layouts", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.setViewportSize(viewports.phone320);
  await page.goto(`/play/fixture-category?testDb=${database}`);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByRole("button", { name: "Single player" })).toHaveAttribute("aria-pressed", "true");
  const field = page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true });
  await field.fill("-");
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true })).toHaveValue("-");
  await page.getByRole("button", { name: "Single player" }).click();
  await expect(page.getByRole("textbox", { name: "Avery at the time, Flowers", exact: true })).toHaveValue("-");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("representative light dark and reduced-motion scorepads match screenshots", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.setViewportSize(viewports.phone390);
  await page.goto(`/play/fixture-category?testDb=${database}`);
  await page.addStyleTag({ content: ".offline-status { display: none !important; }" });
  await expect(page.locator(".page")).toHaveScreenshot("category-phone-light.png");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator(".page")).toHaveScreenshot("category-phone-dark-reduced.png");
  await page.setViewportSize(viewports.desktop1440);
  await page.getByRole("button", { name: "Grid" }).click();
  await expect(page.locator(".page")).toHaveScreenshot("category-desktop-dark.png");
});
