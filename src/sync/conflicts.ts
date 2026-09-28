import type { IDBPDatabase } from "idb";
import { openWorkspaceDb, putScopedRecord, type WorkspaceScope } from "../storage/scopedDb";

function requireConflictWrite(scope: WorkspaceScope): void {
  if (scope.kind === "account" && scope.capabilities?.write !== true) throw new Error("This account is read-only. The pending edit is still held on this device.");
}

export interface ConflictRecord {
  key: string; entityType: "game" | "player" | "play"; entityId: string;
  localDocument: Record<string, unknown> | null; baseRevision: number;
  server: { revision: number | string; deleted: boolean; document: Record<string, unknown> | null };
  updatedAt: string;
}

function store(type: ConflictRecord["entityType"]): "games" | "players" | "plays" { return type === "game" ? "games" : type === "player" ? "players" : "plays"; }
function row(conflict: ConflictRecord, document: Record<string, unknown>): Record<string, unknown> {
  return conflict.entityType === "play" ? { id: conflict.entityId, playedAt: document.playedAt, status: document.status, gameName: document.gameName, gameRef: document.gameRef, play: document } : document;
}

export async function listConflicts(scope: WorkspaceScope): Promise<ConflictRecord[]> {
  return (await (await openWorkspaceDb(scope)).getAll("conflicts")) as ConflictRecord[];
}

export async function useServerVersion(db: IDBPDatabase, conflict: ConflictRecord): Promise<void> {
  const tx = db.transaction([store(conflict.entityType), "outbox", "conflicts", "serverShadows"], "readwrite");
  const entityStore = tx.objectStore(store(conflict.entityType));
  if (conflict.server.deleted || !conflict.server.document) await entityStore.delete(conflict.entityId);
  else await entityStore.put(row(conflict, conflict.server.document));
  await tx.objectStore("serverShadows").put({ key: conflict.key, revision: Number(conflict.server.revision), deleted: conflict.server.deleted, document: conflict.server.document });
  await tx.objectStore("outbox").delete(conflict.key);
  await tx.objectStore("conflicts").delete(conflict.key);
  await tx.done;
}

export async function keepLocalVersion(scope: WorkspaceScope, conflict: ConflictRecord): Promise<string> {
  requireConflictWrite(scope);
  const db = await openWorkspaceDb(scope);
  if (conflict.server.deleted && conflict.localDocument) {
    const copyId = crypto.randomUUID();
    const copy = { ...conflict.localDocument, id: copyId };
    const tx = db.transaction(["outbox", "conflicts"], "readwrite");
    await tx.objectStore("outbox").delete(conflict.key);
    await tx.objectStore("conflicts").delete(conflict.key);
    await tx.done;
    await putScopedRecord(store(conflict.entityType), conflict.entityType === "play" ? row({ ...conflict, entityId: copyId }, copy) : copy);
    return copyId;
  }
  const outbox = await db.get("outbox", conflict.key);
  const tx = db.transaction(["outbox", "conflicts"], "readwrite");
  await tx.objectStore("outbox").put({ ...outbox, state: "pending", baseRevision: Number(conflict.server.revision), mutationId: null, payload: null, inFlightGeneration: undefined });
  await tx.objectStore("conflicts").delete(conflict.key);
  await tx.done;
  return conflict.entityId;
}
