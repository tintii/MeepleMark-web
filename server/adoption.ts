import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, requireCsrf } from "./auth";
import type { ServerConfig } from "./config";
import { adoptionRequestSchema, type Mutation } from "./protocol";
import { applyMutation, assertSyncContext } from "./sync";
import type { EntityType } from "../src/shared/documents";
import { requireWriteAccess } from "./permissions";

const TABLES: Record<EntityType, string> = { game: "user_games", player: "players", play: "plays" };
interface AdoptionResult { sourceId: string; status: "adopted" | "changed"; targetId: string; revision?: number }

function stableUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export async function adoptBatch(pool: Pool, ownerId: string, request: ReturnType<typeof adoptionRequestSchema.parse>) {
  const check = await pool.connect();
  try { await requireWriteAccess(check, ownerId); await assertSyncContext(check, request.context, ownerId); } finally { check.release(); }
  const results: AdoptionResult[] = [];
  for (const item of request.items) {
    const prior = await pool.query<{ source_fingerprint: Buffer; target_id: string; result: AdoptionResult }>(
      "SELECT source_fingerprint, target_id, result FROM adoption_receipts WHERE owner_id=$1 AND source_workspace_id=$2 AND entity_type=$3 AND source_id=$4",
      [ownerId, request.sourceWorkspaceId, item.entityType, item.sourceId],
    );
    const fingerprint = Buffer.from(item.sourceFingerprint, "hex");
    if (prior.rowCount === 1) {
      if (!prior.rows[0].source_fingerprint.equals(fingerprint)) { results.push({ sourceId: item.sourceId, status: "changed", targetId: prior.rows[0].target_id }); continue; }
      results.push(prior.rows[0].result); continue;
    }
    let targetId = isUuid(item.sourceId) ? item.sourceId : stableUuid(`${ownerId}:${request.sourceWorkspaceId}:${item.entityType}:${item.sourceId}`);
    const collision = await pool.query(`SELECT document FROM ${TABLES[item.entityType]} WHERE owner_id=$1 AND entity_id=$2`, [ownerId, targetId]);
    if (collision.rowCount) targetId = stableUuid(`${ownerId}:${request.sourceWorkspaceId}:${item.entityType}:${item.sourceId}:copy`);
    const document = { ...item.document, id: targetId };
    const mutation: Mutation = { mutationId: stableUuid(`${ownerId}:${request.sourceWorkspaceId}:${item.entityType}:${item.sourceId}:${item.sourceFingerprint}`), entityType: item.entityType, entityId: targetId, baseRevision: 0, operation: "put", document };
    const accepted = await applyMutation(pool, ownerId, request.context, mutation);
    const result: AdoptionResult = { sourceId: item.sourceId, status: "adopted", targetId, revision: accepted.revision };
    await pool.query(
      `INSERT INTO adoption_receipts(owner_id, source_workspace_id, entity_type, source_id, source_fingerprint, target_id, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (owner_id,source_workspace_id,entity_type,source_id) DO NOTHING`,
      [ownerId, request.sourceWorkspaceId, item.entityType, item.sourceId, fingerprint, targetId, result],
    );
    results.push(result);
  }
  return { results };
}

export async function registerAdoptionRoutes(app: FastifyInstance, pool: Pool, config: ServerConfig): Promise<void> {
  app.post("/api/v1/adoption", async (request) => {
    const session = await authenticate(request, pool, config);
    requireCsrf(request, session, config);
    return adoptBatch(pool, session.accountId, adoptionRequestSchema.parse(request.body));
  });
}
