import { expect, test } from "@playwright/test";
import { openIsolatedApp, setStorageControl, viewports } from "./harness";

test("production preview opens with an independent database", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo);
  await expect(page.getByRole("heading", { name: "Plays" })).toBeVisible();
  await expect(page.getByText("No plays yet")).toBeVisible();
});

test("storage failure and delay controls are available", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/players");
  await setStorageControl(page, { delayMs: 10, failures: 1 });
  await page.getByLabel("Display name").fill("Harness player");
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("alert")).toContainText("display name");
});

for (const [name, viewport] of Object.entries(viewports)) {
  test(`shell renders at ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openIsolatedApp(page, testInfo);
    await expect(page.locator("body")).toHaveScreenshot(`shell-${name}.png`);
  });
}
