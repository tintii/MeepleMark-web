import { beforeEach, describe, expect, it } from "vitest";
import { activateWorkspace, type RememberedAccount } from "../account/workspaceCoordinator";
import { closeWorkspaceConnectionsForTests, openWorkspaceDb, putScopedRecord } from "../storage/scopedDb";
import { acknowledgeMutation, applyChangePage, freezeMutation, syncStatus, uploadPending } from "./client";
import { keepLocalVersion, useServerVersion, type ConflictRecord } from "./conflicts";

const account: RememberedAccount = { kind: "account", origin: "https://example.test", installationId: "11111111-1111-4111-8111-111111111111", recoveryEpoch: "22222222-2222-4222-8222-222222222222", accountId: "33333333-3333-4333-8333-333333333333", protocolVersion: 1, username: "a", displayName: "A", role: "user", capabilities: { write: true, admin: false }, registration: { enabled: false, defaultRole: "user" } };
beforeEach(async () => { await closeWorkspaceConnectionsForTests(); await activateWorkspace(account, false); });

describe("browser synchronization transactions", () => {
  it("freezes in-flight payloads and retains a newer generation after acknowledgement and restart", async () => {
    await putScopedRecord("players", { id: "p", displayName: "First", bggUsername: null, preferredColorIndex: null });
    const db = await openWorkspaceDb(account);
    const first = await freezeMutation(db, "player:p", account);
    await putScopedRecord("players", { id: "p", displayName: "Second", bggUsername: null, preferredColorIndex: null });
    expect(await freezeMutation(db, "player:p", account)).toEqual(first);
    await acknowledgeMutation(db, "player:p", first!.generation, 1, first!.mutation.document ?? null);
    const pending = await db.get("outbox", "player:p");
    expect(pending).toMatchObject({ generation: 2, state: "pending", baseRevision: 1, document: { displayName: "Second" } });
    expect((await freezeMutation(db, "player:p", account))!.mutation.document).toMatchObject({ displayName: "Second" });
  });

  it("commits a download page and cursor atomically while preserving pending working data", async () => {
    await putScopedRecord("players", { id: "p", displayName: "Local", bggUsername: null, preferredColorIndex: null });
    const db = await openWorkspaceDb(account);
    const page = { items: [{ sequence: 1, entityType: "player" as const, entityId: "p", revision: 2, deleted: false, document: { id: "p", displayName: "Server", bggUsername: null, preferredColorIndex: null } }], cursor: 1, highWater: 1, initialSyncComplete: true };
    await expect(applyChangePage(db, page, true)).rejects.toThrow();
    expect(await db.get("syncMeta", "cursor")).toBeUndefined();
    await applyChangePage(db, page);
    expect((await db.get("players", "p")).displayName).toBe("Local");
    expect((await db.get("serverShadows", "player:p")).document.displayName).toBe("Server");
    expect(await db.get("syncMeta", "cursor")).toMatchObject({ cursor: 1 });
  });

  it("resolves one conflict without changing unrelated pending records", async () => {
    await putScopedRecord("players", { id: "conflict", displayName: "Mine", bggUsername: null, preferredColorIndex: null });
    await putScopedRecord("players", { id: "unrelated", displayName: "Other", bggUsername: null, preferredColorIndex: null });
    const db = await openWorkspaceDb(account);
    const conflict: ConflictRecord = { key: "player:conflict", entityType: "player", entityId: "conflict", localDocument: { id: "conflict", displayName: "Mine", bggUsername: null, preferredColorIndex: null }, baseRevision: 1, server: { revision: 2, deleted: false, document: { id: "conflict", displayName: "Server", bggUsername: null, preferredColorIndex: null } }, updatedAt: new Date().toISOString() };
    await db.put("conflicts", conflict);
    await useServerVersion(db, conflict);
    expect((await db.get("players", "conflict")).displayName).toBe("Server");
    expect(await db.get("outbox", "player:conflict")).toBeUndefined();
    expect(await db.get("outbox", "player:unrelated")).toBeDefined();

    const deleted = { ...conflict, key: "player:copy", entityId: "copy", localDocument: { ...conflict.localDocument!, id: "copy" }, server: { revision: 3, deleted: true, document: null } };
    await db.put("conflicts", deleted);
    const copyId = await keepLocalVersion(account, deleted);
    expect(copyId).not.toBe("copy");
    expect(await db.get("outbox", `player:${copyId}`)).toBeDefined();
  });

  it("preserves and pauses a pending edit when the server denies write permission", async () => {
    await putScopedRecord("players", { id: "held", displayName: "Held", bggUsername: null, preferredColorIndex: null });
    Object.defineProperty(globalThis, "document", { value: { cookie: "meeplemark_csrf=test-token" }, configurable: true });
    await uploadPending(account, async () => new Response(JSON.stringify({ error: "write_forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } }));
    const entry = await (await openWorkspaceDb(account)).get("outbox", "player:held");
    expect(entry).toMatchObject({ state: "pending", mutationId: null, payload: null });
    expect(syncStatus()).toBe("readonly");
  });
});
