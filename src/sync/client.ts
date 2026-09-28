import type { IDBPDatabase } from "idb";
import { csrfToken } from "../account/api";
import { isCurrentGeneration, workspaceGeneration, type RememberedAccount } from "../account/workspaceCoordinator";
import { openWorkspaceDb, type OutboxEntry } from "../storage/scopedDb";

export type SyncStatus = "idle" | "pending" | "syncing" | "synced" | "conflicted" | "reauthenticate" | "offline" | "recovery" | "readonly" | "error";
export interface FrozenMutation { context: object; mutation: { mutationId: string; entityType: string; entityId: string; baseRevision: number; operation: string; document?: Record<string, unknown> }; generation: number }
interface ChangeItem { sequence: number; entityType: "game" | "player" | "play"; entityId: string; revision: number; deleted: boolean; document: Record<string, unknown> | null }
interface ChangePage { items: ChangeItem[]; cursor: number; highWater: number; initialSyncComplete: boolean }

let currentStatus: SyncStatus = "idle";
export function syncStatus(): SyncStatus { return currentStatus; }
export function setSyncStatus(status: SyncStatus): void {
  currentStatus = status;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("meeplemark:sync-status", { detail: status }));
}

function context(account: RememberedAccount) {
  return { protocolVersion: account.protocolVersion, installationId: account.installationId, recoveryEpoch: account.recoveryEpoch, accountId: account.accountId };
}

export async function freezeMutation(db: IDBPDatabase, key: string, account: RememberedAccount): Promise<FrozenMutation | null> {
  const tx = db.transaction("outbox", "readwrite");
  const entry = await tx.store.get(key) as OutboxEntry | undefined;
  if (!entry) { await tx.done; return null; }
  if (entry.state === "conflict") { await tx.done; return null; }
  if (entry.state === "inflight" && entry.payload) { await tx.done; return entry.payload as FrozenMutation; }
  const mutation = {
    mutationId: crypto.randomUUID(), entityType: entry.entityType, entityId: entry.entityId,
    baseRevision: entry.baseRevision, operation: entry.operation,
    ...(entry.document ? { document: entry.document } : {}),
  };
  const frozen: FrozenMutation = { context: context(account), mutation, generation: entry.generation };
  await tx.store.put({ ...entry, state: "inflight", mutationId: mutation.mutationId, payload: frozen, inFlightGeneration: entry.generation });
  await tx.done;
  return frozen;
}

export async function acknowledgeMutation(db: IDBPDatabase, key: string, generation: number, revision: number, document: Record<string, unknown> | null): Promise<void> {
  const tx = db.transaction(["outbox", "serverShadows"], "readwrite");
  const entry = await tx.objectStore("outbox").get(key) as OutboxEntry | undefined;
  await tx.objectStore("serverShadows").put({ key, revision, document, deleted: document === null });
  if (entry && entry.inFlightGeneration === generation) {
    if (entry.generation === generation) await tx.objectStore("outbox").delete(key);
    else await tx.objectStore("outbox").put({ ...entry, state: "pending", baseRevision: revision, mutationId: null, payload: null, inFlightGeneration: undefined });
  }
  await tx.done;
}

function entityStore(type: ChangeItem["entityType"]): "games" | "players" | "plays" {
  return type === "game" ? "games" : type === "player" ? "players" : "plays";
}

function localRow(change: ChangeItem): Record<string, unknown> | null {
  if (change.deleted || !change.document) return null;
  if (change.entityType !== "play") return change.document;
  return { id: change.entityId, playedAt: change.document.playedAt, status: change.document.status, gameName: change.document.gameName, gameRef: change.document.gameRef, play: change.document };
}

export async function applyChangePage(db: IDBPDatabase, page: ChangePage, failBeforeCommitForTest = false): Promise<void> {
  const stores = ["games", "players", "plays", "serverShadows", "outbox", "syncMeta"];
  const tx = db.transaction(stores, "readwrite");
  for (const change of page.items) {
    const key = `${change.entityType}:${change.entityId}`;
    const shadow = await tx.objectStore("serverShadows").get(key) as { revision?: number } | undefined;
    if ((shadow?.revision ?? 0) >= change.revision) continue;
    await tx.objectStore("serverShadows").put({ key, revision: change.revision, document: change.document, deleted: change.deleted });
    const pending = await tx.objectStore("outbox").get(key);
    if (!pending) {
      const store = tx.objectStore(entityStore(change.entityType));
      const row = localRow(change);
      if (row) await store.put(row); else await store.delete(change.entityId);
    }
  }
  await tx.objectStore("syncMeta").put({ key: "cursor", cursor: page.cursor, highWater: page.highWater, initialSyncComplete: page.initialSyncComplete });
  if (failBeforeCommitForTest) tx.abort();
  await tx.done;
}

async function saveConflict(db: IDBPDatabase, entry: OutboxEntry, details: unknown): Promise<void> {
  const tx = db.transaction(["outbox", "conflicts"], "readwrite");
  await tx.objectStore("conflicts").put({ key: entry.key, entityType: entry.entityType, entityId: entry.entityId, localDocument: entry.document, baseRevision: entry.baseRevision, server: details, updatedAt: new Date().toISOString() });
  await tx.objectStore("outbox").put({ ...entry, state: "conflict" });
  await tx.done;
}

export async function uploadPending(account: RememberedAccount, fetcher: typeof fetch = fetch): Promise<void> {
  const db = await openWorkspaceDb(account);
  const entries = await db.getAll("outbox") as OutboxEntry[];
  if (!account.capabilities.write) { if (entries.length) setSyncStatus("readonly"); return; }
  for (const original of entries) {
    if (original.state === "conflict") continue;
    const frozen = await freezeMutation(db, original.key, account);
    if (!frozen) continue;
    const generation = workspaceGeneration();
    const csrf = csrfToken();
    if (!csrf) { setSyncStatus("reauthenticate"); return; }
    const response = await fetcher("/api/v1/sync/mutations", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ context: frozen.context, mutation: frozen.mutation }) });
    if (!isCurrentGeneration(generation)) return;
    if (response.status === 401) { setSyncStatus("reauthenticate"); return; }
    if (response.status === 403) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (body.error === "write_forbidden") {
        const current = await db.get("outbox", original.key) as OutboxEntry | undefined;
        if (current) await db.put("outbox", { ...current, state: "pending", mutationId: null, payload: null, inFlightGeneration: undefined });
        setSyncStatus("readonly");
        if (typeof window !== "undefined") window.dispatchEvent(new Event("meeplemark:permission-denied"));
        return;
      }
    }
    if (response.status === 409) {
      const body = await response.json();
      if (["installation_mismatch", "recovery_epoch_mismatch", "protocol_mismatch"].includes(body.error)) setSyncStatus("recovery");
      else { await saveConflict(db, (await db.get("outbox", original.key)) as OutboxEntry, body.details); setSyncStatus("conflicted"); }
      continue;
    }
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    const result = await response.json() as { revision: number };
    await acknowledgeMutation(db, original.key, frozen.generation, result.revision, frozen.mutation.operation === "delete" ? null : frozen.mutation.document ?? null);
  }
}

export async function downloadChanges(account: RememberedAccount, fetcher: typeof fetch = fetch): Promise<void> {
  const db = await openWorkspaceDb(account);
  let cursor = Number((await db.get("syncMeta", "cursor") as { cursor?: number } | undefined)?.cursor ?? 0);
  for (;;) {
    const query = new URLSearchParams({ after: String(cursor), limit: "100", protocolVersion: String(account.protocolVersion), installationId: account.installationId, recoveryEpoch: account.recoveryEpoch, accountId: account.accountId });
    const response = await fetcher(`/api/v1/sync/changes?${query}`, { credentials: "same-origin" });
    if (response.status === 401) { setSyncStatus("reauthenticate"); return; }
    if (response.status === 409) { setSyncStatus("recovery"); return; }
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const page = await response.json() as ChangePage;
    await applyChangePage(db, page);
    cursor = page.cursor;
    if (page.initialSyncComplete) return;
  }
}

let activeRun: Promise<void> | null = null;
async function confirmCapabilities(account: RememberedAccount): Promise<boolean> {
  const response = await fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) { setSyncStatus("reauthenticate"); return false; }
  if (!response.ok) throw new Error(`Permission refresh failed (${response.status})`);
  const session = await response.json() as { role: RememberedAccount["role"]; capabilities: RememberedAccount["capabilities"] };
  if (session.role !== account.role || session.capabilities.write !== account.capabilities.write || session.capabilities.admin !== account.capabilities.admin) {
    window.dispatchEvent(new Event("meeplemark:permission-denied"));
    return false;
  }
  return session.capabilities.write;
}

export function syncNow(account: RememberedAccount): Promise<void> {
  if (activeRun) return activeRun;
  activeRun = (async () => {
    setSyncStatus("syncing");
    try {
      const canUpload = await confirmCapabilities(account);
      if (canUpload) await uploadPending(account);
      await downloadChanges(account);
      if (currentStatus === "reauthenticate" || currentStatus === "recovery" || currentStatus === "conflicted" || currentStatus === "readonly") return;
      const outbox = await (await openWorkspaceDb(account)).getAll("outbox") as OutboxEntry[];
      setSyncStatus(!account.capabilities.write && outbox.length > 0 ? "readonly" : outbox.some((entry) => entry.state === "conflict") ? "conflicted" : outbox.length > 0 ? "pending" : "synced");
    }
    catch { setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error"); }
    finally { activeRun = null; }
  })();
  return activeRun;
}
