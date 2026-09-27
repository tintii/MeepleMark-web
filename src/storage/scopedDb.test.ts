import { beforeEach, describe, expect, it } from "vitest";
import {
  closeWorkspaceConnectionsForTests,
  openWorkspaceDb,
  putScopedRecord,
  setActiveWorkspace,
  workspaceDatabaseName,
  type AccountWorkspace,
} from "./scopedDb";

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const accountA: AccountWorkspace = { kind: "account", origin: "https://example.test", installationId: "install-a", accountId: "account-a" };
const accountB: AccountWorkspace = { kind: "account", origin: "https://example.test", installationId: "install-a", accountId: "account-b" };

beforeEach(async () => {
  await closeWorkspaceConnectionsForTests();
  await deleteDatabase("meeplemark");
  await deleteDatabase(workspaceDatabaseName(accountA));
  await deleteDatabase(workspaceDatabaseName(accountB));
});

describe("scoped browser repositories", () => {
  it("keeps the existing version-1 database as an outbox-free guest workspace", async () => {
    setActiveWorkspace({ kind: "guest" });
    await putScopedRecord("players", { id: "guest-player", displayName: "Guest", bggUsername: null, preferredColorIndex: null });
    const db = await openWorkspaceDb();
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames]).toEqual(["games", "players", "plays"]);
    expect(await db.get("players", "guest-player")).toMatchObject({ displayName: "Guest" });
  });

  it("isolates two account partitions with independent pending mutations", async () => {
    const sharedId = "shared-player";
    setActiveWorkspace(accountA);
    await putScopedRecord("players", { id: sharedId, displayName: "A", bggUsername: null, preferredColorIndex: null });
    const dbA = await openWorkspaceDb(accountA);
    setActiveWorkspace(accountB);
    await putScopedRecord("players", { id: sharedId, displayName: "B", bggUsername: null, preferredColorIndex: null });
    const dbB = await openWorkspaceDb(accountB);
    expect((await dbA.get("players", sharedId)).displayName).toBe("A");
    expect((await dbB.get("players", sharedId)).displayName).toBe("B");
    expect((await dbA.get("outbox", `player:${sharedId}`)).document.displayName).toBe("A");
    expect((await dbB.get("outbox", `player:${sharedId}`)).document.displayName).toBe("B");
  });

  it("rolls back both entity and outbox state when interrupted between them", async () => {
    setActiveWorkspace(accountA);
    await expect(putScopedRecord(
      "games",
      { id: "interrupted", name: "Interrupted", slug: null, bggThingId: null, origin: "custom", ownedAt: null, localTemplate: null, templateVersion: 0 },
      { failAfterEntityForTest: true },
    )).rejects.toThrow("Simulated interruption");
    const db = await openWorkspaceDb(accountA);
    expect(await db.get("games", "interrupted")).toBeUndefined();
    expect(await db.get("outbox", "game:interrupted")).toBeUndefined();
  });
});

