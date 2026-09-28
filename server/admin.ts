import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, requireAdmin, requireCsrf } from "./auth";
import type { ServerConfig } from "./config";
import { inTransaction } from "./db";
import { HttpError, type AccountRole } from "./permissions";
import { adminAuditQuerySchema, adminDeleteRequestSchema, adminRoleRequestSchema, adminStatusRequestSchema, adminUsersQuerySchema, registrationSettingsSchema } from "./protocol";
import { createHash, randomBytes } from "node:crypto";

export type AuditSource = "web" | "cli";
export interface AuditContext { source: AuditSource; actorId?: string | null }

export async function appendAudit(client: PoolClient, context: AuditContext, action: string, targetId: string | null, before: object = {}, after: object = {}): Promise<void> {
  await client.query(
    "INSERT INTO admin_audit_events(source, actor_id, target_id, action, before_summary, after_summary) VALUES ($1,$2,$3,$4,$5,$6)",
    [context.source, context.actorId ?? null, targetId, action, before, after],
  );
}

async function lockInstallation(client: PoolClient): Promise<void> {
  await client.query("SELECT singleton FROM installation WHERE singleton = TRUE FOR UPDATE");
}

async function usableAdminCount(client: PoolClient): Promise<number> {
  const result = await client.query<{ count: string }>("SELECT count(*) FROM users WHERE role='admin' AND disabled_at IS NULL AND password_hash IS NOT NULL");
  return Number(result.rows[0].count);
}

async function lockedUser(client: PoolClient, accountId: string) {
  const result = await client.query<{ id: string; username: string; display_name: string; role: AccountRole; disabled_at: Date | null; password_hash: string | null }>(
    "SELECT id, username::text, display_name, role, disabled_at, password_hash FROM users WHERE id=$1 FOR UPDATE",
    [accountId],
  );
  if (result.rowCount !== 1) throw new HttpError(404, "account_not_found", "Account not found.");
  return result.rows[0];
}

function removingUsableAdmin(user: Awaited<ReturnType<typeof lockedUser>>, role?: AccountRole, disabled?: boolean): boolean {
  return user.role === "admin" && user.disabled_at === null && user.password_hash !== null && (role !== undefined ? role !== "admin" : disabled !== undefined ? disabled : true);
}

export async function setRole(pool: Pool, accountId: string, role: AccountRole, context: AuditContext): Promise<void> {
  await inTransaction(pool, async (client) => {
    await lockInstallation(client);
    const user = await lockedUser(client, accountId);
    if (role === "admin" && (user.disabled_at !== null || user.password_hash === null)) throw new HttpError(409, "admin_not_usable", "An administrator must be enabled and have an initialized password.");
    if (removingUsableAdmin(user, role) && await usableAdminCount(client) <= 1) throw new HttpError(409, "last_admin", "The last active administrator cannot be demoted.");
    await client.query("UPDATE users SET role=$2, updated_at=now() WHERE id=$1", [accountId, role]);
    await appendAudit(client, context, "account.role_changed", accountId, { role: user.role }, { role });
  });
}

export async function setDisabled(pool: Pool, accountId: string, disabled: boolean, context: AuditContext): Promise<void> {
  await inTransaction(pool, async (client) => {
    await lockInstallation(client);
    const user = await lockedUser(client, accountId);
    if (removingUsableAdmin(user, undefined, disabled) && await usableAdminCount(client) <= 1) throw new HttpError(409, "last_admin", "The last active administrator cannot be disabled.");
    await client.query("UPDATE users SET disabled_at=CASE WHEN $2 THEN now() ELSE NULL END, updated_at=now() WHERE id=$1", [accountId, disabled]);
    if (disabled) await client.query("UPDATE sessions SET revoked_at=now() WHERE owner_id=$1 AND revoked_at IS NULL", [accountId]);
    await appendAudit(client, context, disabled ? "account.disabled" : "account.enabled", accountId, { disabled: user.disabled_at !== null }, { disabled });
  });
}

export async function revokeAccountSessions(pool: Pool, accountId: string, context: AuditContext): Promise<void> {
  await inTransaction(pool, async (client) => {
    await lockedUser(client, accountId);
    const result = await client.query("UPDATE sessions SET revoked_at=now() WHERE owner_id=$1 AND revoked_at IS NULL", [accountId]);
    await appendAudit(client, context, "account.sessions_revoked", accountId, {}, { revoked: result.rowCount ?? 0 });
  });
}

export async function issueManagedRecoveryCode(pool: Pool, accountId: string, context: AuditContext): Promise<{ accountId: string; code: string }> {
  const code = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(code).digest();
  await inTransaction(pool, async (client) => {
    const user = await lockedUser(client, accountId);
    if (user.disabled_at !== null) throw new HttpError(409, "account_disabled", "Enable this account before issuing recovery.");
    await client.query("UPDATE account_setup_codes SET consumed_at=now() WHERE owner_id=$1 AND consumed_at IS NULL", [accountId]);
    await client.query("INSERT INTO account_setup_codes(owner_id,code_hash,expires_at) VALUES ($1,$2,now()+interval '24 hours')", [accountId, hash]);
    await appendAudit(client, context, "account.recovery_issued", accountId, {}, { expiresInHours: 24 });
  });
  return { accountId, code };
}

export async function deleteManagedAccount(pool: Pool, accountId: string, confirmation: string, context: AuditContext): Promise<void> {
  await inTransaction(pool, async (client) => {
    await lockInstallation(client);
    const user = await lockedUser(client, accountId);
    if (confirmation !== user.username) throw new HttpError(400, "confirmation_mismatch", "Type the exact username to confirm deletion.");
    if (removingUsableAdmin(user) && await usableAdminCount(client) <= 1) throw new HttpError(409, "last_admin", "The last active administrator cannot be deleted.");
    await appendAudit(client, context, "account.deleted", accountId, { username: user.username, role: user.role, disabled: user.disabled_at !== null }, { deleted: true });
    await client.query("DELETE FROM users WHERE id=$1", [accountId]);
  });
}

export async function updateRegistration(pool: Pool, enabled: boolean, defaultRole: "readonly" | "user", context: AuditContext): Promise<void> {
  await inTransaction(pool, async (client) => {
    const before = await client.query<{ registration_enabled: boolean; registration_default_role: string }>("SELECT registration_enabled, registration_default_role FROM installation WHERE singleton=TRUE FOR UPDATE");
    await client.query("UPDATE installation SET registration_enabled=$1, registration_default_role=$2, updated_at=now() WHERE singleton=TRUE", [enabled, defaultRole]);
    await appendAudit(client, context, "registration.updated", null, { enabled: before.rows[0].registration_enabled, defaultRole: before.rows[0].registration_default_role }, { enabled, defaultRole });
  });
}

export async function registerAdminRoutes(app: FastifyInstance, pool: Pool, config: ServerConfig): Promise<void> {
  const admin = async (request: Parameters<typeof authenticate>[0]) => { const session = await authenticate(request, pool, config); requireAdmin(session); return session; };
  app.get("/api/v1/admin/overview", async (request) => {
    await admin(request);
    const counts = await pool.query<{ total: string; enabled: string; admins: string }>("SELECT count(*) total, count(*) FILTER (WHERE disabled_at IS NULL) enabled, count(*) FILTER (WHERE role='admin' AND disabled_at IS NULL) admins FROM users");
    return { totalAccounts: Number(counts.rows[0].total), enabledAccounts: Number(counts.rows[0].enabled), activeAdmins: Number(counts.rows[0].admins) };
  });
  app.get("/api/v1/admin/users", async (request) => {
    await admin(request); const q = adminUsersQuerySchema.parse(request.query); const offset = (q.page - 1) * q.limit;
    const values: unknown[] = []; const where: string[] = [];
    if (q.search) { values.push(`%${q.search}%`); where.push(`(username ILIKE $${values.length} OR display_name ILIKE $${values.length})`); }
    if (q.role) { values.push(q.role); where.push(`role=$${values.length}`); }
    if (q.status) where.push(q.status === "enabled" ? "disabled_at IS NULL" : "disabled_at IS NOT NULL");
    const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = await pool.query<{ count: string }>(`SELECT count(*) FROM users ${filter}`, values);
    values.push(q.limit, offset);
    const rows = await pool.query(`SELECT id, username::text, display_name, role, disabled_at, created_at FROM users ${filter} ORDER BY username LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    return { items: rows.rows.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name, role: row.role, disabled: row.disabled_at !== null, createdAt: row.created_at })), page: q.page, limit: q.limit, total: Number(total.rows[0].count) };
  });
  app.get("/api/v1/admin/users/:id", async (request) => { await admin(request); const id = (request.params as { id: string }).id; const row = await pool.query("SELECT id, username::text, display_name, role, disabled_at, created_at FROM users WHERE id=$1", [id]); if (row.rowCount !== 1) throw new HttpError(404, "account_not_found", "Account not found."); const u = row.rows[0]; return { id: u.id, username: u.username, displayName: u.display_name, role: u.role, disabled: u.disabled_at !== null, createdAt: u.created_at }; });
  app.get("/api/v1/admin/audit", async (request) => { await admin(request); const q = adminAuditQuerySchema.parse(request.query); const total = await pool.query<{ count: string }>("SELECT count(*) FROM admin_audit_events"); const rows = await pool.query("SELECT id, occurred_at, source, actor_id, target_id, action, before_summary, after_summary FROM admin_audit_events ORDER BY occurred_at DESC, id DESC LIMIT $1 OFFSET $2", [q.limit, (q.page - 1) * q.limit]); return { items: rows.rows, page: q.page, limit: q.limit, total: Number(total.rows[0].count) }; });
  app.get("/api/v1/admin/registration", async (request) => { await admin(request); const row = await pool.query("SELECT registration_enabled, registration_default_role FROM installation WHERE singleton=TRUE"); return { enabled: row.rows[0].registration_enabled, defaultRole: row.rows[0].registration_default_role }; });
  app.put("/api/v1/admin/registration", async (request) => { const s = await admin(request); requireCsrf(request, s, config); const body = registrationSettingsSchema.parse(request.body); await updateRegistration(pool, body.enabled, body.defaultRole, { source: "web", actorId: s.accountId }); return body; });
  app.put("/api/v1/admin/users/:id/role", async (request) => { const s=await admin(request); requireCsrf(request,s,config); const b=adminRoleRequestSchema.parse(request.body); await setRole(pool,(request.params as {id:string}).id,b.role,{source:"web",actorId:s.accountId}); return { role:b.role }; });
  app.put("/api/v1/admin/users/:id/status", async (request) => { const s=await admin(request); requireCsrf(request,s,config); const b=adminStatusRequestSchema.parse(request.body); await setDisabled(pool,(request.params as {id:string}).id,b.disabled,{source:"web",actorId:s.accountId}); return { disabled:b.disabled }; });
  app.post("/api/v1/admin/users/:id/revoke-sessions", async (request,reply) => { const s=await admin(request); requireCsrf(request,s,config); await revokeAccountSessions(pool,(request.params as {id:string}).id,{source:"web",actorId:s.accountId}); return reply.status(204).send(); });
  app.post("/api/v1/admin/users/:id/recovery", async (request) => { const s=await admin(request); requireCsrf(request,s,config); return issueManagedRecoveryCode(pool,(request.params as {id:string}).id,{source:"web",actorId:s.accountId}); });
  app.delete("/api/v1/admin/users/:id", async (request,reply) => { const s=await admin(request); requireCsrf(request,s,config); const b=adminDeleteRequestSchema.parse(request.body); await deleteManagedAccount(pool,(request.params as {id:string}).id,b.confirmation,{source:"web",actorId:s.accountId}); return reply.status(204).send(); });
}
