import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction } from "./db";
import { usernameSchema } from "./protocol";

const SETUP_CODE_LIFETIME_HOURS = 24;

export function normalizeUsername(value: string): string {
  return usernameSchema.parse(value.normalize("NFKC").toLocaleLowerCase("en-US"));
}

function setupSecret(): { code: string; hash: Buffer } {
  const code = randomBytes(32).toString("base64url");
  return { code, hash: createHash("sha256").update(code).digest() };
}

export async function createAccount(pool: Pool, usernameInput: string, displayNameInput?: string): Promise<{ accountId: string; code: string }> {
  const username = normalizeUsername(usernameInput);
  const displayName = (displayNameInput ?? usernameInput).trim();
  if (!displayName || displayName.length > 128) throw new Error("Display name must contain 1 to 128 characters.");
  const secret = setupSecret();
  return inTransaction(pool, async (client) => {
    const user = await client.query<{ id: string }>(
      "INSERT INTO users(username, display_name) VALUES ($1, $2) RETURNING id",
      [username, displayName],
    );
    const accountId = user.rows[0].id;
    await client.query("INSERT INTO sync_state(owner_id) VALUES ($1)", [accountId]);
    await client.query(
      "INSERT INTO account_setup_codes(owner_id, code_hash, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 hour'))",
      [accountId, secret.hash, SETUP_CODE_LIFETIME_HOURS],
    );
    return { accountId, code: secret.code };
  });
}

export async function issueRecoveryCode(pool: Pool, usernameInput: string): Promise<{ accountId: string; code: string }> {
  const username = normalizeUsername(usernameInput);
  const secret = setupSecret();
  return inTransaction(pool, async (client) => {
    const user = await client.query<{ id: string }>("SELECT id FROM users WHERE username = $1 FOR UPDATE", [username]);
    if (user.rowCount !== 1) throw new Error("Account not found.");
    const accountId = user.rows[0].id;
    await client.query("UPDATE account_setup_codes SET consumed_at = now() WHERE owner_id = $1 AND consumed_at IS NULL", [accountId]);
    await client.query(
      "INSERT INTO account_setup_codes(owner_id, code_hash, expires_at) VALUES ($1, $2, now() + ($3 * interval '1 hour'))",
      [accountId, secret.hash, SETUP_CODE_LIFETIME_HOURS],
    );
    return { accountId, code: secret.code };
  });
}

export async function setAccountDisabled(pool: Pool, usernameInput: string, disabled: boolean): Promise<void> {
  const username = normalizeUsername(usernameInput);
  await inTransaction(pool, async (client) => {
    const result = await client.query<{ id: string }>(
      "UPDATE users SET disabled_at = CASE WHEN $2 THEN now() ELSE NULL END, updated_at = now() WHERE username = $1 RETURNING id",
      [username, disabled],
    );
    if (result.rowCount !== 1) throw new Error("Account not found.");
    if (disabled) await client.query("UPDATE sessions SET revoked_at = now() WHERE owner_id = $1 AND revoked_at IS NULL", [result.rows[0].id]);
  });
}

export async function revokeSessions(pool: Pool, usernameInput: string): Promise<void> {
  const username = normalizeUsername(usernameInput);
  const result = await pool.query(
    "UPDATE sessions SET revoked_at = now() WHERE owner_id = (SELECT id FROM users WHERE username = $1) AND revoked_at IS NULL",
    [username],
  );
  const exists = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
  if (exists.rowCount !== 1) throw new Error("Account not found.");
  void result;
}

export async function deleteAccount(pool: Pool, usernameInput: string, confirmation: string | undefined): Promise<void> {
  const username = normalizeUsername(usernameInput);
  if (confirmation !== usernameInput) throw new Error(`Deletion requires --confirm ${usernameInput}`);
  const result = await pool.query("DELETE FROM users WHERE username = $1", [username]);
  if (result.rowCount !== 1) throw new Error("Account not found.");
}

export async function rotateRecoveryEpoch(pool: Pool, confirmation: string | undefined): Promise<string> {
  if (confirmation !== "ROTATE") throw new Error("Recovery reset requires --confirm ROTATE");
  return inTransaction(pool, async (client) => {
    const identity = await client.query<{ recovery_epoch: string }>("UPDATE installation SET recovery_epoch = gen_random_uuid(), updated_at = now() WHERE singleton = TRUE RETURNING recovery_epoch");
    await client.query("UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL");
    return identity.rows[0].recovery_epoch;
  });
}
