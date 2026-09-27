import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GameDocument, PlayerDocument } from "../src/shared/documents";
import { runMigrations } from "./migrate";
import { applyMutation, readChangePage } from "./sync";
import type { Mutation, SyncContext } from "./protocol";
import { adoptBatch } from "./adoption";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("owner-scoped synchronization", () => {
  let pool: Pool;
  let ownerA: string;
  let ownerB: string;
  let contextA: SyncContext;
  let contextB: SyncContext;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await runMigrations(pool);
    const users = await pool.query<{ id: string }>(
      "INSERT INTO users(username, display_name) VALUES ('sync-a', 'A'), ('sync-b', 'B') RETURNING id",
    );
    [ownerA, ownerB] = users.rows.map((row) => row.id);
    await pool.query("INSERT INTO sync_state(owner_id) VALUES ($1), ($2)", [ownerA, ownerB]);
    const identity = await pool.query<{ installation_id: string; recovery_epoch: string }>("SELECT installation_id, recovery_epoch FROM installation");
    contextA = { protocolVersion: 1, installationId: identity.rows[0].installation_id, recoveryEpoch: identity.rows[0].recovery_epoch, accountId: ownerA };
    contextB = { ...contextA, accountId: ownerB };
  });
  afterAll(async () => pool?.end());

  function game(id: string, name: string): GameDocument {
    return { id, name, slug: null, bggThingId: null, origin: "custom", ownedAt: null, localTemplate: null, templateVersion: 0 };
  }
  function player(id: string, displayName: string): PlayerDocument {
    return { id, displayName, bggUsername: null, preferredColorIndex: null };
  }
  function mutation(entityType: Mutation["entityType"], entityId: string, document: Record<string, unknown>, baseRevision = 0): Mutation {
    return { mutationId: randomUUID(), entityType, entityId, baseRevision, operation: "put", document };
  }

  it("isolates identical entity IDs and rejects forged account context", async () => {
    const id = randomUUID();
    await applyMutation(pool, ownerA, contextA, mutation("game", id, game(id, "A game") as unknown as Record<string, unknown>));
    await applyMutation(pool, ownerB, contextB, mutation("game", id, game(id, "B game") as unknown as Record<string, unknown>));
    const rows = await pool.query<{ owner_id: string; name: string }>("SELECT owner_id, name FROM user_games WHERE entity_id = $1 ORDER BY name", [id]);
    expect(rows.rows).toEqual([{ owner_id: ownerA, name: "A game" }, { owner_id: ownerB, name: "B game" }]);
    await expect(applyMutation(pool, ownerA, contextB, mutation("game", randomUUID(), game(randomUUID(), "Forged") as unknown as Record<string, unknown>))).rejects.toThrow("does not match");
  });

  it("rejects protocol, installation, recovery epoch, and account mismatches before mutation or receipt access", async () => {
    const mismatches = [
      { ...contextA, protocolVersion: 2 } as unknown as SyncContext,
      { ...contextA, installationId: randomUUID() },
      { ...contextA, recoveryEpoch: randomUUID() },
      { ...contextA, accountId: ownerB },
    ];
    for (const context of mismatches) {
      const id = randomUUID();
      const request = mutation("game", id, game(id, "Must not write") as unknown as Record<string, unknown>);
      await expect(applyMutation(pool, ownerA, context, request)).rejects.toThrow();
      expect((await pool.query("SELECT 1 FROM user_games WHERE owner_id = $1 AND entity_id = $2", [ownerA, id])).rowCount).toBe(0);
      expect((await pool.query("SELECT 1 FROM mutation_receipts WHERE owner_id = $1 AND mutation_id = $2", [ownerA, request.mutationId])).rowCount).toBe(0);
    }
  });

  it("replays identical immutable mutations and rejects changed payloads", async () => {
    const id = randomUUID();
    const request = mutation("player", id, player(id, "Avery") as unknown as Record<string, unknown>);
    const first = await applyMutation(pool, ownerA, contextA, request);
    expect(await applyMutation(pool, ownerA, contextA, request)).toEqual(first);
    await expect(applyMutation(pool, ownerA, contextA, { ...request, document: player(id, "Changed") as unknown as Record<string, unknown> })).rejects.toThrow("different content");
    expect((await pool.query("SELECT 1 FROM changes WHERE owner_id = $1 AND entity_id = $2", [ownerA, id])).rowCount).toBe(1);
  });

  it("rejects invalid documents and cross-owner references without partial writes", async () => {
    const foreignPlayerId = randomUUID();
    await applyMutation(pool, ownerB, contextB, mutation("player", foreignPlayerId, player(foreignPlayerId, "Private") as unknown as Record<string, unknown>));
    const playId = randomUUID();
    const invalidReference = {
      id: playId, playedAt: new Date().toISOString(), status: "draft", gameName: "Private game", gameRef: null,
      winDirection: "high", outcome: "ranked", scoring: null,
      players: [{ name: "Private", playerRef: foreignPlayerId, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false }], notes: null,
    };
    await expect(applyMutation(pool, ownerA, contextA, mutation("play", playId, invalidReference))).rejects.toThrow("unavailable");
    const invalidId = randomUUID();
    await expect(applyMutation(pool, ownerA, contextA, mutation("play", invalidId, { id: invalidId, players: [] }))).rejects.toThrow("validation");
    expect((await pool.query("SELECT 1 FROM plays WHERE owner_id = $1 AND entity_id IN ($2, $3)", [ownerA, playId, invalidId])).rowCount).toBe(0);
  });

  it("uses revision conflicts and tombstones to prevent resurrection", async () => {
    const id = randomUUID();
    await applyMutation(pool, ownerA, contextA, mutation("game", id, game(id, "Delete me") as unknown as Record<string, unknown>));
    await expect(applyMutation(pool, ownerA, contextA, mutation("game", id, game(id, "Stale") as unknown as Record<string, unknown>))).rejects.toThrow("revision");
    await applyMutation(pool, ownerA, contextA, { mutationId: randomUUID(), entityType: "game", entityId: id, baseRevision: 1, operation: "delete" });
    await expect(applyMutation(pool, ownerA, contextA, mutation("game", id, game(id, "Resurrected") as unknown as Record<string, unknown>))).rejects.toThrow("revision");
    const row = await pool.query("SELECT revision, deleted, document, name FROM user_games WHERE owner_id = $1 AND entity_id = $2", [ownerA, id]);
    expect(row.rows[0]).toMatchObject({ revision: "2", deleted: true, document: null, name: null });
  });

  it("returns bounded commit-safe pages without skipping concurrent or duplicate entity events", async () => {
    const ids = [randomUUID(), randomUUID()];
    const first = await applyMutation(pool, ownerB, contextB, mutation("game", ids[0], game(ids[0], "First") as unknown as Record<string, unknown>));
    await Promise.all([
      applyMutation(pool, ownerB, contextB, mutation("game", ids[1], game(ids[1], "Second") as unknown as Record<string, unknown>)),
      applyMutation(pool, ownerB, contextB, mutation("game", ids[0], game(ids[0], "First updated") as unknown as Record<string, unknown>, first.revision)),
    ]);
    let cursor = 0;
    const sequences: number[] = [];
    let finalPage;
    do {
      finalPage = await readChangePage(pool, ownerB, contextB, cursor, 1);
      sequences.push(...finalPage.items.map((item) => item.sequence));
      cursor = finalPage.cursor;
    } while (!finalPage.initialSyncComplete);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);
    expect(cursor).toBe(finalPage.highWater);
    expect(sequences.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves play snapshots when directory records change or are deleted", async () => {
    const playerId = randomUUID();
    await applyMutation(pool, ownerA, contextA, mutation("player", playerId, player(playerId, "Original") as unknown as Record<string, unknown>));
    const playId = randomUUID();
    const play = {
      id: playId, playedAt: new Date().toISOString(), status: "complete", gameName: "History", gameRef: null,
      winDirection: "high", outcome: "ranked", scoring: null,
      players: [{ name: "Original at play", playerRef: playerId, categories: null, total: "1.20", totalIsOverridden: true, rank: 1, rankIsOverridden: true }], notes: null,
    };
    await applyMutation(pool, ownerA, contextA, mutation("play", playId, play));
    await applyMutation(pool, ownerA, contextA, mutation("player", playerId, player(playerId, "Renamed") as unknown as Record<string, unknown>, 1));
    await applyMutation(pool, ownerA, contextA, { mutationId: randomUUID(), entityType: "player", entityId: playerId, baseRevision: 2, operation: "delete" });
    const stored = await pool.query<{ document: typeof play }>("SELECT document FROM plays WHERE owner_id = $1 AND entity_id = $2", [ownerA, playId]);
    expect(stored.rows[0].document.players[0]).toMatchObject({ name: "Original at play", total: "1.20", rank: 1 });
  });

  it("adopts collision-safe snapshots idempotently and reports changed sources", async () => {
    const sourceId = randomUUID();
    await applyMutation(pool, ownerA, contextA, mutation("game", sourceId, game(sourceId, "Existing") as unknown as Record<string, unknown>));
    const request = { context: contextA, sourceWorkspaceId: randomUUID(), items: [{ entityType: "game" as const, sourceId, sourceFingerprint: "a".repeat(64), document: game(sourceId, "Guest copy") as unknown as Record<string, unknown> }] };
    const first = await adoptBatch(pool, ownerA, request);
    const replay = await adoptBatch(pool, ownerA, request);
    expect(first).toEqual(replay);
    expect(first.results[0].targetId).not.toBe(sourceId);
    const changed = await adoptBatch(pool, ownerA, { ...request, items: [{ ...request.items[0], sourceFingerprint: "b".repeat(64) }] });
    expect(changed.results[0]).toMatchObject({ status: "changed", targetId: first.results[0].targetId });
    expect((await pool.query("SELECT 1 FROM user_games WHERE owner_id=$1 AND entity_id=$2", [ownerA, first.results[0].targetId])).rowCount).toBe(1);
  });
});
