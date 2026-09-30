import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeWorkspaceConnectionsForTests,
  openWorkspaceDb,
  putScopedRecord,
  readWorkspaceSnapshot,
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

const accountA: AccountWorkspace = { kind: "account", origin: "https://example.test", installationId: "install-a", accountId: "account-a", capabilities: { write: true, admin: false } };
const accountB: AccountWorkspace = { kind: "account", origin: "https://example.test", installationId: "install-a", accountId: "account-b", capabilities: { write: true, admin: false } };

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

  it("denies account mutations when write capability is absent without creating local state", async () => {
    const readonly = { ...accountA, accountId: "readonly", capabilities: { write: false, admin: false } };
    setActiveWorkspace(readonly);
    await expect(putScopedRecord("players", { id: "blocked", displayName: "Blocked" })).rejects.toThrow("read-only");
    expect(await (await openWorkspaceDb(readonly)).get("players", "blocked")).toBeUndefined();
  });

  it("reads owned and unowned domain documents in one read-only transaction", async () => {
    setActiveWorkspace({ kind: "guest" });
    const db = await openWorkspaceDb();
    const owned = { id: "owned", name: "Owned", slug: null, bggThingId: null, origin: "custom", ownedAt: "2026-01-01T00:00:00.000Z", localTemplate: null, templateVersion: 0 };
    const unowned = { ...owned, id: "unowned", name: "Unowned", ownedAt: null };
    const player = { id: "player", displayName: "Avery", bggUsername: null, preferredColorIndex: null };
    const play = { id: "play", playedAt: "2026-01-02T00:00:00.000Z", status: "draft", gameName: "Unowned", gameRef: "unowned", winDirection: "high", outcome: "ranked", scoring: null, players: [{ name: "Avery", playerRef: "player", total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false }], notes: null };
    await Promise.all([db.put("games", owned), db.put("games", unowned), db.put("players", player), db.put("plays", { id: "play", playedAt: play.playedAt, status: "draft", gameName: "Unowned", gameRef: "unowned", play })]);
    const transaction = vi.spyOn(db, "transaction");

    const snapshot = await readWorkspaceSnapshot();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(["games", "players", "plays"], "readonly");
    expect(snapshot.games).toEqual(expect.arrayContaining([owned, unowned]));
    expect(snapshot.players).toEqual([player]);
    expect(snapshot.plays).toEqual([play]);
  });

  it("does not touch domain or account-only state while reading an account snapshot", async () => {
    setActiveWorkspace(accountA);
    await putScopedRecord("players", { id: "pending", displayName: "Pending", bggUsername: null, preferredColorIndex: null });
    const db = await openWorkspaceDb(accountA);
    const before = {
      players: await db.getAll("players"),
      outbox: await db.getAll("outbox"),
      shadows: await db.getAll("serverShadows"),
    };

    expect(await readWorkspaceSnapshot()).toMatchObject({ players: before.players, games: [], plays: [] });
    expect(await db.getAll("players")).toEqual(before.players);
    expect(await db.getAll("outbox")).toEqual(before.outbox);
    expect(await db.getAll("serverShadows")).toEqual(before.shadows);
  });
});
