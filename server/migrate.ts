import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";

const MIGRATION_LOCK_ID = 4_901_947_751;

interface AppliedMigration { version: string; checksum: string }

export async function runMigrations(pool: Pool, directory = path.resolve("server/migrations")): Promise<string[]> {
  const client = await pool.connect();
  const appliedNow: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const entries = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
    const appliedResult = await client.query<AppliedMigration>("SELECT version, checksum FROM schema_migrations");
    const applied = new Map(appliedResult.rows.map((row) => [row.version, row.checksum]));

    for (const filename of entries) {
      const sql = await readFile(path.join(directory, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const prior = applied.get(filename);
      if (prior !== undefined) {
        if (prior !== checksum) throw new Error(`Migration checksum mismatch: ${filename}`);
        continue;
      }
      await applyMigration(client, filename, checksum, sql);
      appliedNow.push(filename);
    }
    return appliedNow;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

async function applyMigration(client: PoolClient, version: string, checksum: string, sql: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)", [version, checksum]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

