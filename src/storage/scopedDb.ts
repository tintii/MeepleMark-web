import { openDB, type IDBPDatabase } from "idb";
import type { EntityType } from "../shared/documents";

export type GuestWorkspace = { kind: "guest" };
export type AccountWorkspace = { kind: "account"; origin: string; installationId: string; accountId: string; capabilities?: { write: boolean; admin: boolean } };
export type WorkspaceScope = GuestWorkspace | AccountWorkspace;
export type EntityStore = "games" | "players" | "plays";

export interface OutboxEntry {
  key: string;
  entityType: EntityType;
  entityId: string;
  generation: number;
  operation: "put" | "delete";
  document: Record<string, unknown> | null;
  baseRevision: number;
  state: "pending" | "inflight" | "conflict";
  mutationId: string | null;
  payload: unknown | null;
  inFlightGeneration?: number;
  updatedAt: string;
}

const ACCOUNT_STORES = ["serverShadows", "outbox", "conflicts", "syncMeta", "adoptionMappings"] as const;
const connections = new Map<string, Promise<IDBPDatabase>>();
let activeScope: WorkspaceScope = { kind: "guest" };

export class ReadOnlyWorkspaceError extends Error {
  constructor() { super("This account is read-only. Your existing downloaded records remain available."); this.name = "ReadOnlyWorkspaceError"; }
}

function requireLocalWrite(scope: WorkspaceScope): void {
  if (scope.kind === "account" && scope.capabilities?.write !== true) throw new ReadOnlyWorkspaceError();
}

function configuredGuestDatabaseName(): string {
  if (!import.meta.env.VITE_E2E || typeof window === "undefined") return "meeplemark";
  const requested = new URLSearchParams(window.location.search).get("testDb");
  return requested && /^meeplemark-e2e-[a-z0-9-]+$/i.test(requested) ? requested : "meeplemark";
}

// The E2E harness selects a database on the initial URL. Keep that scope stable
// when client-side navigation subsequently removes the query string.
const GUEST_DATABASE_NAME = configuredGuestDatabaseName();

function safe(value: string): string {
  return encodeURIComponent(value).replaceAll("%", "_");
}

export function workspaceDatabaseName(scope: WorkspaceScope): string {
  if (scope.kind === "guest") return GUEST_DATABASE_NAME;
  const epoch = "recoveryEpoch" in scope && typeof scope.recoveryEpoch === "string" ? scope.recoveryEpoch : "initial";
  return `meeplemark-account-${safe(scope.origin)}-${safe(scope.installationId)}-${safe(epoch)}-${safe(scope.accountId)}`;
}

export function getActiveWorkspace(): WorkspaceScope {
  return activeScope;
}

export function setActiveWorkspace(scope: WorkspaceScope): void {
  activeScope = scope;
}

export function openWorkspaceDb(scope: WorkspaceScope = activeScope): Promise<IDBPDatabase> {
  const name = workspaceDatabaseName(scope);
  let connection = connections.get(name);
  if (!connection) {
    connection = openDB(name, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" });
        if (!db.objectStoreNames.contains("players")) db.createObjectStore("players", { keyPath: "id" });
        if (!db.objectStoreNames.contains("plays")) db.createObjectStore("plays", { keyPath: "id" });
        if (scope.kind === "account") {
          for (const store of ACCOUNT_STORES) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "key" });
        }
      },
    });
    connections.set(name, connection);
  }
  return connection;
}

function entityTypeForStore(store: EntityStore): EntityType {
  return store === "games" ? "game" : store === "players" ? "player" : "play";
}

function wireDocument(store: EntityStore, value: Record<string, unknown>): Record<string, unknown> {
  return store === "plays" ? value.play as Record<string, unknown> : value;
}

export async function putScopedRecord(
  store: EntityStore,
  value: Record<string, unknown>,
  options: { failAfterEntityForTest?: boolean } = {},
): Promise<void> {
  const scope = activeScope;
  requireLocalWrite(scope);
  const db = await openWorkspaceDb(scope);
  if (scope.kind === "guest") {
    await db.put(store, value);
    return;
  }
  const entityId = String(value.id);
  const key = `${entityTypeForStore(store)}:${entityId}`;
  const transaction = db.transaction([store, "outbox", "serverShadows"], "readwrite");
  await transaction.objectStore(store).put(value);
  if (options.failAfterEntityForTest) {
    transaction.abort();
    await transaction.done.catch(() => undefined);
    throw new Error("Simulated interruption after entity write.");
  }
  const prior = await transaction.objectStore("outbox").get(key) as OutboxEntry | undefined;
  const shadow = await transaction.objectStore("serverShadows").get(key) as { revision?: number } | undefined;
  const entry: OutboxEntry = {
    key,
    entityType: entityTypeForStore(store),
    entityId,
    generation: (prior?.generation ?? 0) + 1,
    operation: "put",
    document: wireDocument(store, value),
    baseRevision: shadow?.revision ?? 0,
    state: prior?.state === "inflight" ? "inflight" : "pending",
    mutationId: prior?.state === "inflight" ? prior.mutationId : null,
    payload: prior?.state === "inflight" ? prior.payload : null,
    inFlightGeneration: prior?.state === "inflight" ? prior.inFlightGeneration : undefined,
    updatedAt: new Date().toISOString(),
  };
  await transaction.objectStore("outbox").put(entry);
  await transaction.done;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("meeplemark:local-change", { detail: { key } }));
}

export async function deleteScopedRecord(store: EntityStore, entityId: string): Promise<void> {
  const scope = activeScope;
  requireLocalWrite(scope);
  const db = await openWorkspaceDb(scope);
  if (scope.kind === "guest") {
    await db.delete(store, entityId);
    return;
  }
  const entityType = entityTypeForStore(store);
  const key = `${entityType}:${entityId}`;
  const transaction = db.transaction([store, "outbox", "serverShadows"], "readwrite");
  await transaction.objectStore(store).delete(entityId);
  const prior = await transaction.objectStore("outbox").get(key) as OutboxEntry | undefined;
  const shadow = await transaction.objectStore("serverShadows").get(key) as { revision?: number } | undefined;
  await transaction.objectStore("outbox").put({
    key, entityType, entityId, generation: (prior?.generation ?? 0) + 1, operation: "delete", document: null,
    baseRevision: shadow?.revision ?? 0, state: "pending", mutationId: null, payload: null, updatedAt: new Date().toISOString(),
  } satisfies OutboxEntry);
  await transaction.done;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("meeplemark:local-change", { detail: { key } }));
}

export async function closeWorkspaceConnectionsForTests(): Promise<void> {
  for (const connection of connections.values()) (await connection).close();
  connections.clear();
  activeScope = { kind: "guest" };
}
