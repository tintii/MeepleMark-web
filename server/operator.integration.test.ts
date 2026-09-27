import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";
import { createAccount, deleteAccount, issueRecoveryCode, revokeSessions, setAccountDisabled } from "./operator";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("operator account lifecycle", () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await runMigrations(pool);
  });
  afterAll(async () => pool?.end());

  it("creates one-use expiring codes without storing the plaintext", async () => {
    const created = await createAccount(pool, "Alice", "Alice A");
    expect(created.code.length).toBeGreaterThanOrEqual(40);
    const row = await pool.query<{ code_hash: Buffer; expires_at: Date }>(
      "SELECT code_hash, expires_at FROM account_setup_codes WHERE owner_id = $1",
      [created.accountId],
    );
    expect(row.rows[0].code_hash.toString()).not.toContain(created.code);
    expect(row.rows[0].expires_at.getTime()).toBeGreaterThan(Date.now());
    const recovery = await issueRecoveryCode(pool, "ALICE");
    expect(recovery.code).not.toBe(created.code);
    const codes = await pool.query<{ consumed_at: Date | null }>(
      "SELECT consumed_at FROM account_setup_codes WHERE owner_id = $1 ORDER BY created_at",
      [created.accountId],
    );
    expect(codes.rows[0].consumed_at).not.toBeNull();
  });

  it("disables, revokes, and refuses unconfirmed deletion", async () => {
    await setAccountDisabled(pool, "alice", true);
    expect((await pool.query("SELECT disabled_at FROM users WHERE username = 'alice'")).rows[0].disabled_at).not.toBeNull();
    await revokeSessions(pool, "alice");
    await expect(deleteAccount(pool, "alice", undefined)).rejects.toThrow("--confirm");
    expect((await pool.query("SELECT 1 FROM users WHERE username = 'alice'")).rowCount).toBe(1);
    await deleteAccount(pool, "alice", "alice");
    expect((await pool.query("SELECT 1 FROM users WHERE username = 'alice'")).rowCount).toBe(0);
  });
});

