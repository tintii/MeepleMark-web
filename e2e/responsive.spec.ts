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
];

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
