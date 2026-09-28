import { createHash, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction } from "./db";
import { usernameSchema } from "./protocol";
import { appendAudit, deleteManagedAccount, issueManagedRecoveryCode, revokeAccountSessions, setDisabled, setRole } from "./admin";
import type { AccountRole } from "./permissions";

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
    await appendAudit(client, { source: "cli" }, "account.created", accountId, {}, { username, role: "user" });
    return { accountId, code: secret.code };
  });
}

export async function issueRecoveryCode(pool: Pool, usernameInput: string): Promise<{ accountId: string; code: string }> {
  const username = normalizeUsername(usernameInput);
  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE username=$1", [username]);
  if (user.rowCount !== 1) throw new Error("Account not found.");
  return issueManagedRecoveryCode(pool, user.rows[0].id, { source: "cli" });
}

export async function setAccountDisabled(pool: Pool, usernameInput: string, disabled: boolean): Promise<void> {
  const username = normalizeUsername(usernameInput);
  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE username=$1", [username]);
  if (user.rowCount !== 1) throw new Error("Account not found.");
  await setDisabled(pool, user.rows[0].id, disabled, { source: "cli" });
}

export async function revokeSessions(pool: Pool, usernameInput: string): Promise<void> {
  const username = normalizeUsername(usernameInput);
  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE username=$1", [username]);
  if (user.rowCount !== 1) throw new Error("Account not found.");
  await revokeAccountSessions(pool, user.rows[0].id, { source: "cli" });
}

export async function deleteAccount(pool: Pool, usernameInput: string, confirmation: string | undefined): Promise<void> {
  const username = normalizeUsername(usernameInput);
  if (confirmation !== usernameInput) throw new Error(`Deletion requires --confirm ${usernameInput}`);
  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE username=$1", [username]);
  if (user.rowCount !== 1) throw new Error("Account not found.");
  await deleteManagedAccount(pool, user.rows[0].id, username, { source: "cli" });
}

export async function setAccountRole(pool: Pool, usernameInput: string, role: AccountRole): Promise<void> {
  const username = normalizeUsername(usernameInput);
  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE username=$1", [username]);
  if (user.rowCount !== 1) throw new Error("Account not found.");
  await setRole(pool, user.rows[0].id, role, { source: "cli" });
}

export async function rotateRecoveryEpoch(pool: Pool, confirmation: string | undefined): Promise<string> {
  if (confirmation !== "ROTATE") throw new Error("Recovery reset requires --confirm ROTATE");
  return inTransaction(pool, async (client) => {
    const identity = await client.query<{ recovery_epoch: string }>("UPDATE installation SET recovery_epoch = gen_random_uuid(), updated_at = now() WHERE singleton = TRUE RETURNING recovery_epoch");
    await client.query("UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL");
    await appendAudit(client, { source: "cli" }, "installation.recovery_rotated", null, {}, { sessionsRevoked: true });
    return identity.rows[0].recovery_epoch;
  });
}
