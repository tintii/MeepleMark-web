import { expect, test } from "@playwright/test";
import { openIsolatedApp, setStorageControl, viewports } from "./harness";

test("production preview opens with an independent database", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo);
  await expect(page.getByRole("heading", { name: "Plays" })).toBeVisible();
  await expect(page.getByText("No plays yet")).toBeVisible();
  const repositoryLink = page.getByRole("link", { name: "MeepleMark on GitHub (opens in a new tab)" });
  await expect(repositoryLink).toBeVisible();
  await expect(repositoryLink).toHaveAttribute("href", "https://github.com/tintii/MeepleMark-web");
  await expect(repositoryLink).toHaveAttribute("target", "_blank");
});

test("storage failure and delay controls are available", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/players");
  await setStorageControl(page, { delayMs: 10, failures: 1 });
  await page.getByLabel("Display name").fill("Harness player");
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByRole("alert")).toContainText("display name");
});

test("iPhone Safari offers subtle Home Screen instructions", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 322, height: 584 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
  });
  await openIsolatedApp(page, testInfo);

  const installButton = page.getByRole("button", { name: "Install" });
  await expect(installButton).toBeVisible();
  await installButton.click();
  const instructions = page.locator("#ios-install-instructions");
  await expect(instructions).toBeVisible();
  const bounds = await instructions.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(322);
  await page.keyboard.press("Escape");
  await expect(instructions).toBeHidden();
});

for (const [name, viewport] of Object.entries(viewports)) {
  test(`shell renders at ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openIsolatedApp(page, testInfo);
    await expect(page.locator("body")).toHaveScreenshot(`shell-${name}.png`);
  });
}
