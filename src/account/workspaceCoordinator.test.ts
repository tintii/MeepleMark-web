import { beforeEach, describe, expect, it } from "vitest";
import { closeWorkspaceConnectionsForTests, openWorkspaceDb, putScopedRecord, setActiveWorkspace, workspaceDatabaseName } from "../storage/scopedDb";
import { activateWorkspace, isCurrentGeneration, lockWorkspace, workspaceGeneration, type RememberedAccount } from "./workspaceCoordinator";

const accountA: RememberedAccount = {
  kind: "account", origin: "https://example.test", installationId: "install", recoveryEpoch: "epoch", accountId: "a",
  protocolVersion: 1, username: "a", displayName: "A", role: "user", capabilities: { write: true, admin: false }, setup: { required: false }, registration: { enabled: false, defaultRole: "user" },
};
const accountB: RememberedAccount = { ...accountA, accountId: "b", username: "b", displayName: "B" };

beforeEach(closeWorkspaceConnectionsForTests);

describe("workspace coordination", () => {
  it("locks an offline-logout partition and leaves its pending records isolated", async () => {
    await activateWorkspace(accountA, false);
    await putScopedRecord("players", { id: "pending-a", displayName: "A", bggUsername: null, preferredColorIndex: null });
    await lockWorkspace(accountA, true, false);
    const dbA = await openWorkspaceDb(accountA);
    expect(await dbA.get("syncMeta", "workspace-lock")).toMatchObject({ locked: true, revokePending: true });
    expect(await dbA.get("outbox", "player:pending-a")).toBeDefined();

    await activateWorkspace(accountB, false);
    const dbB = await openWorkspaceDb(accountB);
    expect(await dbB.get("players", "pending-a")).toBeUndefined();
    expect(await dbB.get("outbox", "player:pending-a")).toBeUndefined();

    await activateWorkspace(accountA, false);
    await expect((await openWorkspaceDb(accountA)).get("outbox", "player:pending-a")).resolves.toBeDefined();
  });

  it("invalidates late callbacks when the active workspace changes", async () => {
    await activateWorkspace(accountA, false);
    const requestGeneration = workspaceGeneration();
    expect(isCurrentGeneration(requestGeneration)).toBe(true);
    setActiveWorkspace(accountB);
    await activateWorkspace(accountB, false);
    expect(isCurrentGeneration(requestGeneration)).toBe(false);
  });

  it("preserves an older recovery epoch beside a restored server workspace", async () => {
    await activateWorkspace(accountA, false);
    await putScopedRecord("players", { id: "newer-local", displayName: "Newer", bggUsername: null, preferredColorIndex: null });
    const restored = { ...accountA, recoveryEpoch: "restored-epoch" };
    expect(workspaceDatabaseName(accountA)).not.toBe(workspaceDatabaseName(restored));
    await activateWorkspace(restored, false);
    expect(await (await openWorkspaceDb(restored)).get("players", "newer-local")).toBeUndefined();
    expect(await (await openWorkspaceDb(accountA)).get("outbox", "player:newer-local")).toBeDefined();
  });
});
