import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, requireCsrf } from "./auth";
import type { ServerConfig } from "./config";
import { inTransaction } from "./db";
import {
  changePageQuerySchema,
  mutationRequestSchema,
  PROTOCOL_VERSION,
  type Mutation,
  type SyncContext,
} from "./protocol";
import { decodePlayDocument, validateEntityDocument, type EntityType } from "../src/shared/documents";

const TABLES: Record<EntityType, string> = { game: "user_games", player: "players", play: "plays" };

class SyncHttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

function fingerprint(mutation: Mutation): Buffer {
  return createHash("sha256").update(canonicalJson(mutation)).digest();
}

async function installation(client: PoolClient): Promise<{ installationId: string; recoveryEpoch: string }> {
  const result = await client.query<{ installation_id: string; recovery_epoch: string }>(
    "SELECT installation_id, recovery_epoch FROM installation WHERE singleton = TRUE",
  );
  if (result.rowCount !== 1) throw new SyncHttpError(503, "installation_unavailable", "Installation identity is unavailable.");
  return { installationId: result.rows[0].installation_id, recoveryEpoch: result.rows[0].recovery_epoch };
}

export async function assertSyncContext(client: PoolClient, context: SyncContext, authenticatedAccountId: string): Promise<void> {
  const identity = await installation(client);
  if (context.protocolVersion !== PROTOCOL_VERSION) throw new SyncHttpError(409, "protocol_mismatch", "Client protocol is not supported.");
  if (context.accountId !== authenticatedAccountId) throw new SyncHttpError(403, "account_mismatch", "Sync account does not match the session.");
  if (context.installationId !== identity.installationId) throw new SyncHttpError(409, "installation_mismatch", "Server installation identity changed.");
  if (context.recoveryEpoch !== identity.recoveryEpoch) throw new SyncHttpError(409, "recovery_epoch_mismatch", "Server recovery epoch changed.");
}

async function rejectCrossOwnerReferences(client: PoolClient, ownerId: string, mutation: Mutation): Promise<void> {
  if (mutation.entityType !== "play" || mutation.operation !== "put" || !mutation.document) return;
  const play = decodePlayDocument(mutation.document);
  const references: Array<{ table: string; id: string }> = [];
  if (play.gameRef) references.push({ table: "user_games", id: play.gameRef });
  for (const player of play.players) if (player.playerRef) references.push({ table: "players", id: player.playerRef });
  for (const reference of references) {
    const rows = await client.query<{ owner_id: string }>(`SELECT owner_id FROM ${reference.table} WHERE entity_id = $1`, [reference.id]);
    if (rows.rows.some((row) => row.owner_id === ownerId)) continue;
    if (rows.rowCount && rows.rowCount > 0) throw new SyncHttpError(422, "invalid_reference", "A referenced record is unavailable.");
  }
}

function columns(mutation: Mutation): { names: string[]; values: unknown[] } {
  if (mutation.operation === "delete") {
    if (mutation.entityType === "game") return { names: ["name", "owned_at"], values: [null, null] };
    if (mutation.entityType === "player") return { names: ["display_name"], values: [null] };
    return { names: ["played_at", "status", "game_name", "game_ref"], values: [null, null, null, null] };
  }
  if (!mutation.document) return { names: [], values: [] };
  if (mutation.entityType === "game") {
    return { names: ["name", "owned_at"], values: [mutation.document.name, mutation.document.ownedAt] };
  }
  if (mutation.entityType === "player") return { names: ["display_name"], values: [mutation.document.displayName] };
  return {
    names: ["played_at", "status", "game_name", "game_ref"],
    values: [mutation.document.playedAt, mutation.document.status, mutation.document.gameName, mutation.document.gameRef],
  };
}

export interface MutationResult {
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  revision: number;
  deleted: boolean;
  sequence: number;
}

export async function applyMutation(pool: Pool, ownerId: string, context: SyncContext, mutation: Mutation): Promise<MutationResult> {
  return inTransaction(pool, async (client) => {
    await assertSyncContext(client, context, ownerId);
    await client.query("SELECT current_sequence FROM sync_state WHERE owner_id = $1 FOR UPDATE", [ownerId]);
    const requestFingerprint = fingerprint(mutation);
    const receipt = await client.query<{ request_fingerprint: Buffer; result: MutationResult }>(
      "SELECT request_fingerprint, result FROM mutation_receipts WHERE owner_id = $1 AND mutation_id = $2",
      [ownerId, mutation.mutationId],
    );
    if (receipt.rowCount === 1) {
      if (!receipt.rows[0].request_fingerprint.equals(requestFingerprint)) {
        throw new SyncHttpError(409, "mutation_id_reused", "Mutation ID was already accepted with different content.");
      }
      return receipt.rows[0].result;
    }

    if (mutation.operation === "put") {
      const issues = validateEntityDocument(mutation.entityType, mutation.entityId, mutation.document);
      if (issues.length > 0) throw new SyncHttpError(422, "invalid_document", "Document validation failed.", issues);
      await rejectCrossOwnerReferences(client, ownerId, mutation);
    }

    const table = TABLES[mutation.entityType];
    const current = await client.query<{ revision: string; deleted: boolean; document: unknown }>(
      `SELECT revision, deleted, document FROM ${table} WHERE owner_id = $1 AND entity_id = $2 FOR UPDATE`,
      [ownerId, mutation.entityId],
    );
    const currentRevision = current.rowCount === 1 ? Number(current.rows[0].revision) : 0;
    if (current.rowCount === 1 ? currentRevision !== mutation.baseRevision : mutation.baseRevision !== 0) {
      throw new SyncHttpError(409, "revision_conflict", "Record revision has changed.", current.rowCount === 1 ? current.rows[0] : { revision: 0, deleted: false, document: null });
    }
    if (mutation.operation === "put" && current.rowCount === 1 && current.rows[0].deleted) {
      throw new SyncHttpError(409, "tombstone_conflict", "Deleted record identities cannot be recreated.", current.rows[0]);
    }
    if (mutation.operation === "delete" && current.rowCount === 0) {
      throw new SyncHttpError(409, "revision_conflict", "The record does not exist.", { revision: 0, deleted: false, document: null });
    }

    const revision = currentRevision + 1;
    const derived = columns(mutation);
    if (current.rowCount === 0) {
      const names = derived.names.length ? `, ${derived.names.join(", ")}` : "";
      const placeholders = derived.values.map((_, index) => `$${index + 6}`).join(", ");
      await client.query(
        `INSERT INTO ${table}(owner_id, entity_id, revision, deleted, document${names}) VALUES ($1, $2, $3, $4, $5${placeholders ? `, ${placeholders}` : ""})`,
        [ownerId, mutation.entityId, revision, false, mutation.document, ...derived.values],
      );
    } else {
      const assignments = derived.names.map((name, index) => `${name} = $${index + 6}`);
      await client.query(
        `UPDATE ${table} SET revision = $3, deleted = $4, document = $5${assignments.length ? `, ${assignments.join(", ")}` : ""}, updated_at = now() WHERE owner_id = $1 AND entity_id = $2`,
        [ownerId, mutation.entityId, revision, mutation.operation === "delete", mutation.operation === "delete" ? null : mutation.document, ...derived.values],
      );
    }

    const sequenceRow = await client.query<{ current_sequence: string }>(
      "UPDATE sync_state SET current_sequence = current_sequence + 1 WHERE owner_id = $1 RETURNING current_sequence",
      [ownerId],
    );
    const sequence = Number(sequenceRow.rows[0].current_sequence);
    const result: MutationResult = { mutationId: mutation.mutationId, entityType: mutation.entityType, entityId: mutation.entityId, revision, deleted: mutation.operation === "delete", sequence };
    await client.query(
      "INSERT INTO changes(owner_id, sequence, entity_type, entity_id, revision, deleted) VALUES ($1, $2, $3, $4, $5, $6)",
      [ownerId, sequence, mutation.entityType, mutation.entityId, revision, result.deleted],
    );
    await client.query(
      "INSERT INTO mutation_receipts(owner_id, mutation_id, request_fingerprint, result) VALUES ($1, $2, $3, $4)",
      [ownerId, mutation.mutationId, requestFingerprint, result],
    );
    return result;
  });
}

export async function readChangePage(pool: Pool, ownerId: string, context: SyncContext, after: number, limit: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await assertSyncContext(client, context, ownerId);
    const state = await client.query<{ current_sequence: string }>("SELECT current_sequence FROM sync_state WHERE owner_id = $1", [ownerId]);
    if (state.rowCount !== 1) throw new SyncHttpError(403, "account_unavailable", "Account sync state is unavailable.");
    const highWater = Number(state.rows[0].current_sequence);
    const changes = await client.query<{ sequence: string; entity_type: EntityType; entity_id: string }>(
      "SELECT sequence, entity_type, entity_id FROM changes WHERE owner_id = $1 AND sequence > $2 AND sequence <= $3 ORDER BY sequence LIMIT $4",
      [ownerId, after, highWater, limit],
    );
    const items = [];
    for (const change of changes.rows) {
      const current = await client.query<{ revision: string; deleted: boolean; document: unknown }>(
        `SELECT revision, deleted, document FROM ${TABLES[change.entity_type]} WHERE owner_id = $1 AND entity_id = $2`,
        [ownerId, change.entity_id],
      );
      if (current.rowCount !== 1) throw new Error("Change references missing current state.");
      items.push({ sequence: Number(change.sequence), entityType: change.entity_type, entityId: change.entity_id, revision: Number(current.rows[0].revision), deleted: current.rows[0].deleted, document: current.rows[0].document });
    }
    const cursor = items.length > 0 ? items[items.length - 1].sequence : highWater;
    await client.query("COMMIT");
    return { items, cursor, highWater, initialSyncComplete: cursor >= highWater };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerSyncRoutes(app: FastifyInstance, pool: Pool, config: ServerConfig): Promise<void> {
  app.post("/api/v1/sync/mutations", async (request, reply) => {
    const session = await authenticate(request, pool, config);
    requireCsrf(request, session, config);
    const input = mutationRequestSchema.parse(request.body);
    try {
      return await applyMutation(pool, session.accountId, input.context, input.mutation);
    } catch (error) {
      if (error instanceof SyncHttpError) return reply.status(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
      throw error;
    }
  });

  app.get("/api/v1/sync/changes", async (request, reply) => {
    const session = await authenticate(request, pool, config);
    const query = changePageQuerySchema.parse(request.query);
    const context = { protocolVersion: query.protocolVersion, installationId: query.installationId, recoveryEpoch: query.recoveryEpoch, accountId: query.accountId } as SyncContext;
    try {
      return await readChangePage(pool, session.accountId, context, query.after, query.limit);
    } catch (error) {
      if (error instanceof SyncHttpError) return reply.status(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
      throw error;
    }
  });
}
