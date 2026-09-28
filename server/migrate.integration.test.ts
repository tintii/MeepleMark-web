import { copyFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("real PostgreSQL migrations", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  });
  afterAll(async () => pool?.end());

  it("creates a clean schema and repeats without reapplying", async () => {
    const initialOnly = await mkdtemp(path.join(tmpdir(), "meeplemark-initial-"));
    await copyFile(path.resolve("server/migrations/001_initial.sql"), path.join(initialOnly, "001_initial.sql"));
    expect(await runMigrations(pool, initialOnly)).toEqual(["001_initial.sql"]);
    const existing = await pool.query<{ id: string }>("INSERT INTO users(username,display_name,password_hash) VALUES ('existing','Existing','hash') RETURNING id");
    expect(await runMigrations(pool)).toEqual(["002_registration_admin.sql"]);
    expect(await runMigrations(pool)).toEqual([]);
    const tables = await pool.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    expect(tables.rows.map((row) => row.table_name)).toContain("mutation_receipts");
    expect(tables.rows.map((row) => row.table_name)).toContain("admin_audit_events");
    expect((await pool.query("SELECT role FROM users WHERE id=$1", [existing.rows[0].id])).rows[0].role).toBe("user");
    expect((await pool.query("SELECT registration_enabled,registration_default_role FROM installation")).rows[0]).toEqual({ registration_enabled: false, registration_default_role: "user" });
    await expect(pool.query("UPDATE users SET role='owner' WHERE id=$1", [existing.rows[0].id])).rejects.toMatchObject({ code: "23514" });
  });

  it("rolls back a failed migration without recording it", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "meeplemark-migrations-"));
    await writeFile(path.join(directory, "002_bad.sql"), "CREATE TABLE should_rollback(id int); SELECT missing_column FROM missing_table;");
    await expect(runMigrations(pool, directory)).rejects.toThrow();
    const migration = await pool.query("SELECT 1 FROM schema_migrations WHERE version = '002_bad.sql'");
    const table = await pool.query("SELECT to_regclass('public.should_rollback') AS name");
    expect(migration.rowCount).toBe(0);
    expect(table.rows[0].name).toBeNull();
  });

  it("enforces owner-scoped identities and retains the required query indexes", async () => {
    const users = await pool.query<{ id: string }>(
      "INSERT INTO users(username, display_name) VALUES ('owner-a', 'A'), ('owner-b', 'B') RETURNING id",
    );
    const [ownerA, ownerB] = users.rows.map((row) => row.id);
    const entityId = "11111111-1111-4111-8111-111111111111";
    const document = { id: entityId, name: "Garden" };
    await pool.query(
      "INSERT INTO user_games(owner_id, entity_id, revision, document, name) VALUES ($1, $3, 1, $4, 'Garden'), ($2, $3, 1, $4, 'Garden')",
      [ownerA, ownerB, entityId, document],
    );
    await expect(pool.query(
      "INSERT INTO user_games(owner_id, entity_id, revision, document, name) VALUES ($1, $2, 1, $3, 'Duplicate')",
      [ownerA, entityId, document],
    )).rejects.toMatchObject({ code: "23505" });
    await expect(pool.query(
      "INSERT INTO players(owner_id, entity_id, revision, deleted, document) VALUES ($1, gen_random_uuid(), 1, false, null)",
      [ownerA],
    )).rejects.toMatchObject({ code: "23514" });

    await pool.query("DELETE FROM users WHERE id = $1", [ownerA]);
    const remaining = await pool.query("SELECT owner_id FROM user_games WHERE entity_id = $1", [entityId]);
    expect(remaining.rows).toEqual([{ owner_id: ownerB }]);

    const indexes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      "sessions_owner_active_idx",
      "user_games_owner_name_idx",
      "players_owner_name_idx",
      "plays_owner_played_idx",
      "plays_owner_game_idx",
      "changes_owner_entity_idx",
      "adoption_receipts_target_idx",
    ]));
  });
});
