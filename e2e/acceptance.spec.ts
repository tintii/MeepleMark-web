import { expect, test } from "@playwright/test";
import { openIsolatedApp, seedExistingFixture, setStorageControl } from "./harness";

async function addPlayer(page: import("@playwright/test").Page, name: string, username: string) {
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel(/BGG username/).fill(username);
  await page.getByRole("button", { name: "Add player" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test("plain journey preserves identities, overrides, metadata, history, and deletion", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/players");
  await addPlayer(page, "Avery", "avery_one");
  await addPlayer(page, "Blake", "blake_two");

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Plays", exact: true }).click();
  await page.getByRole("link", { name: "Add Play" }).click();
  await page.getByLabel("Game name").fill("Parity Plain");
  await page.getByRole("button", { name: /Avery.*Saved/ }).click();
  await page.getByRole("button", { name: /Blake.*Saved/ }).click();
  await expect(page.getByText("Saved player selected")).toHaveCount(2);
  await page.getByRole("button", { name: "Start play" }).click();

  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("10.5");
  await page.getByRole("textbox", { name: "Blake's score", exact: true }).fill("2.25");
  await page.getByRole("button", { name: "Toggle sign for Blake's score" }).click();
  await page.getByRole("textbox", { name: "Avery's rank", exact: true }).fill("2");
  await expect(page.getByText("Manual rank")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("dialog", { name: /Add Parity Plain/ })).toBeVisible();
  await page.getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "View Plays" }).click();
  await expect(page.getByText("Parity Plain", { exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Players", exact: true }).click();
  const averyRow = page.getByRole("listitem").filter({ hasText: "Avery" });
  await averyRow.getByRole("button", { name: "Edit" }).click();
  const editForm = page.locator(".edit-player-form");
  await editForm.getByLabel("BGG username").fill("");
  await editForm.getByRole("button", { name: "Automatic colour" }).click();
  await editForm.getByRole("button", { name: "Save changes" }).click();
  const blakeRow = page.getByRole("listitem").filter({ hasText: "Blake" });
  await blakeRow.getByRole("button", { name: "Edit" }).click();
  await page.locator(".edit-player-form").getByRole("button", { name: "Delete player" }).click();
  await page.getByRole("dialog", { name: "Delete Blake?" }).getByRole("button", { name: "Delete player" }).click();

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Plays", exact: true }).click();
  await expect(page.getByText("Parity Plain", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Delete Parity Plain play/ }).click();
  await page.getByRole("dialog", { name: /Delete Parity Plain play/ }).getByRole("button", { name: "Delete play" }).click();
  await expect(page.getByText("No plays yet")).toBeVisible();
});

test("templated flagged journey reorders categories and keeps its snapshot", async ({ page }, testInfo) => {
  await openIsolatedApp(page, testInfo, "/collection");
  await page.getByLabel("Game name").fill("Co-op Garden");
  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByRole("link", { name: "Co-op Garden" }).click();
  await page.getByRole("link", { name: "Add a score sheet" }).click();
  await page.getByLabel("Category 1 label").fill("A very long flower category label");
  await page.getByLabel("Category 2 label").fill("Paths");
  await page.getByRole("button", { name: "Move category 2 up" }).click();
  await page.getByLabel("Outcome").selectOption("flagged");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Paths, A very long flower category label")).toBeVisible();

  await page.getByRole("link", { name: "Add Play" }).click();
  await page.getByLabel(/Use “Co-op Garden” score sheet/).check();
  await page.getByRole("textbox", { name: "Player 1", exact: true }).fill("Avery with a long name");
  await page.getByRole("textbox", { name: "Player 2", exact: true }).fill("Blake");
  await page.getByRole("button", { name: "Start play" }).click();
  await expect(page.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Single player" }).click();
  await page.getByRole("textbox", { name: "Avery with a long name, Paths", exact: true }).fill("0.1");
  await page.getByRole("textbox", { name: "Avery with a long name, A very long flower category label", exact: true }).fill("0.2");
  await page.getByRole("button", { name: "Won" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("textbox", { name: "Blake, Paths", exact: true }).fill("1");
  await page.getByRole("button", { name: "Lost" }).click();
  await page.getByRole("button", { name: "Complete" }).click();
  await page.getByRole("button", { name: "View Plays" }).click();
  await page.getByText("Co-op Garden", { exact: true }).click();
  await expect(page.getByText("Paths", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Won" }).first()).toHaveAttribute("aria-pressed", "true");
});

test("failed and delayed scoring writes recover without losing the latest value", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo, "/play/new");
  await page.getByLabel("Game name").fill("Reliable");
  await page.getByRole("textbox", { name: "Player 1", exact: true }).fill("Avery");
  await page.getByRole("button", { name: "Start play" }).click();
  await expect(page.getByRole("heading", { name: "Reliable" })).toBeVisible();
  await setStorageControl(page, { failures: 1 });
  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("1");
  await expect(page.getByRole("alert")).toContainText("not saved");
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await setStorageControl(page, { delayMs: 50, failures: 0 });
  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("2");
  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("3");
  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("4");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.goto(`${new URL(page.url()).pathname}?testDb=${database}`);
  await expect(page.getByRole("textbox", { name: "Avery's score", exact: true })).toHaveValue("4");

  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("");
  await page.getByRole("button", { name: "Toggle sign for Avery's score" }).click();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("alert")).toContainText("incomplete number");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Players", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Changes are not ready to leave" })).toBeVisible();
  await page.getByRole("button", { name: "Stay" }).click();

  await page.getByRole("textbox", { name: "Avery's score", exact: true }).fill("5");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await setStorageControl(page, { delayMs: 100, failures: 1 });
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(page.getByText(/completed play was not saved/)).toBeVisible();
  await setStorageControl(page, { delayMs: 0, failures: 0 });
  await page.getByRole("button", { name: "Retry completion" }).click();
  await expect(page.getByRole("dialog", { name: /Add Reliable/ })).toBeVisible();
  await setStorageControl(page, { failures: 1 });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not added");
  await setStorageControl(page, { failures: 0 });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Play recorded" })).toBeVisible();
});

test("existing data, corrupt rows, direct links, and history navigation remain usable", async ({ page }, testInfo) => {
  const database = await openIsolatedApp(page, testInfo);
  await seedExistingFixture(page);
  await page.evaluate(async () => {
    const name = new URLSearchParams(location.search).get("testDb")!;
    const request = indexedDB.open(name);
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("plays", "readwrite");
        tx.objectStore("plays").put({ id: "corrupt", playedAt: "2028-01-01T00:00:00Z", status: "complete", gameName: "Corrupt", gameRef: null, play: { broken: true } });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  await page.reload();
  await expect(page.getByText("Unreadable")).toBeVisible();
  await page.goto(`/play/fixture-category?testDb=${database}`);
  await expect(page.getByRole("heading", { name: "Fixture Garden" })).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Fixture Garden" })).toBeVisible();
});
