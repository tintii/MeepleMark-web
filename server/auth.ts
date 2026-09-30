import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { ServerConfig } from "./config";
import { inTransaction } from "./db";
import { initialAdminSetupRequestSchema, loginRequestSchema, passwordChangeSchema, setupRequestSchema } from "./protocol";
import { capabilitiesFor, HttpError, type AccountRole, type Capabilities } from "./permissions";
import { normalizeUsername } from "./operator";
import { registerRequestSchema } from "./protocol";

const COOKIE_NAME = "meeplemark_session";
const CSRF_COOKIE_NAME = "meeplemark_csrf";
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export interface AuthenticatedSession {
  accountId: string;
  username: string;
  displayName: string;
  sessionId: string;
  csrfHash: Buffer;
  role: AccountRole;
  capabilities: Capabilities;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function httpError(statusCode: number, message: string, code = "request_rejected"): HttpError {
  return new HttpError(statusCode, code, message);
}

function requireOrigin(request: FastifyRequest, config: ServerConfig): void {
  if (request.headers.origin !== config.APP_ORIGIN) throw httpError(403, "Request origin is not allowed.");
}

function cookieOptions(config: ServerConfig) {
  return { path: "/", httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "strict" as const };
}

function setSessionCookies(reply: FastifyReply, config: ServerConfig, session: { token: string; csrfToken: string }): void {
  reply.setCookie(COOKIE_NAME, session.token, cookieOptions(config));
  reply.setCookie(CSRF_COOKIE_NAME, session.csrfToken, { path: "/", httpOnly: false, secure: config.NODE_ENV === "production", sameSite: "strict" });
}

export async function createSession(client: PoolClient, ownerId: string, config: ServerConfig): Promise<{ token: string; csrfToken: string }> {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  await client.query(
    `INSERT INTO sessions(owner_id, token_hash, csrf_hash, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 day'), now() + ($5 * interval '1 day'))`,
    [ownerId, digest(token), digest(csrfToken), config.SESSION_IDLE_DAYS, config.SESSION_ABSOLUTE_DAYS],
  );
  return { token, csrfToken };
}

export async function authenticate(request: FastifyRequest, pool: Pool, config: ServerConfig): Promise<AuthenticatedSession> {
  const token = request.cookies[COOKIE_NAME];
  if (!token) throw httpError(401, "Authentication required.");
  const result = await pool.query<{
    session_id: string; owner_id: string; csrf_hash: Buffer; username: string; display_name: string; role: AccountRole;
  }>(
    `UPDATE sessions s SET last_seen_at = now(), idle_expires_at = LEAST(s.absolute_expires_at, now() + ($2 * interval '1 day'))
     FROM users u
     WHERE s.owner_id = u.id AND s.token_hash = $1 AND s.revoked_at IS NULL
       AND s.idle_expires_at > now() AND s.absolute_expires_at > now() AND u.disabled_at IS NULL
     RETURNING s.id AS session_id, s.owner_id, s.csrf_hash, u.username::text, u.display_name, u.role`,
    [digest(token), config.SESSION_IDLE_DAYS],
  );
  if (result.rowCount !== 1) throw httpError(401, "Authentication required.");
  const row = result.rows[0];
  return { accountId: row.owner_id, username: row.username, displayName: row.display_name, sessionId: row.session_id, csrfHash: row.csrf_hash, role: row.role, capabilities: capabilitiesFor(row.role) };
}

export function requireAdmin(session: AuthenticatedSession): void {
  if (!session.capabilities.admin) throw httpError(403, "Administrator access is required.", "admin_forbidden");
}

export function requireCsrf(request: FastifyRequest, session: AuthenticatedSession, config: ServerConfig): void {
  requireOrigin(request, config);
  const token = request.headers["x-csrf-token"];
  if (typeof token !== "string") throw httpError(403, "CSRF authorization is required.");
  const actual = digest(token);
  if (actual.length !== session.csrfHash.length || !timingSafeEqual(actual, session.csrfHash)) {
    throw httpError(403, "CSRF authorization is required.");
  }
}

export async function registerAuthRoutes(app: FastifyInstance, pool: Pool, config: ServerConfig): Promise<void> {
  app.post("/api/v1/setup/admin", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    requireOrigin(request, config);
    const input = initialAdminSetupRequestSchema.parse(request.body);
    const username = normalizeUsername(input.username);
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const result = await inTransaction(pool, async (client) => {
      await client.query("SELECT singleton FROM installation WHERE singleton = TRUE FOR UPDATE");
      const existing = await client.query("SELECT 1 FROM users LIMIT 1");
      if (existing.rowCount) throw httpError(409, "Installation setup is already complete.", "setup_complete");
      const created = await client.query<{ id: string }>(
        "INSERT INTO users(username, display_name, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
        [username, input.displayName?.trim() || input.username.trim(), passwordHash],
      );
      await client.query("INSERT INTO sync_state(owner_id) VALUES ($1)", [created.rows[0].id]);
      await client.query(
        "INSERT INTO admin_audit_events(source, actor_id, target_id, action, before_summary, after_summary) VALUES ('web', $1, $1, 'installation.admin_created', '{}', $2)",
        [created.rows[0].id, { username, role: "admin" }],
      );
      const session = await createSession(client, created.rows[0].id, config);
      return { accountId: created.rows[0].id, ...session };
    });
    setSessionCookies(reply, config, result);
    return reply.status(201).send({ accountId: result.accountId, csrfToken: result.csrfToken });
  });

  app.post("/api/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    requireOrigin(request, config);
    const input = registerRequestSchema.parse(request.body);
    const username = normalizeUsername(input.username);
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const result = await inTransaction(pool, async (client) => {
      const policy = await client.query<{ registration_enabled: boolean; registration_default_role: "readonly" | "user" }>(
        "SELECT registration_enabled, registration_default_role FROM installation WHERE singleton = TRUE FOR UPDATE",
      );
      if (!policy.rows[0]?.registration_enabled) throw httpError(403, "Registration is closed.", "registration_closed");
      const created = await client.query<{ id: string }>(
        `INSERT INTO users(username, display_name, password_hash, role) VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING RETURNING id`,
        [username, input.displayName?.trim() || input.username.trim(), passwordHash, policy.rows[0].registration_default_role],
      );
      if (created.rowCount !== 1) throw httpError(409, "Username is unavailable.", "username_unavailable");
      await client.query("INSERT INTO sync_state(owner_id) VALUES ($1)", [created.rows[0].id]);
      const session = await createSession(client, created.rows[0].id, config);
      return { accountId: created.rows[0].id, ...session };
    });
    setSessionCookies(reply, config, result);
    return reply.status(201).send({ accountId: result.accountId, csrfToken: result.csrfToken });
  });

  app.post("/api/v1/auth/setup", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    requireOrigin(request, config);
    const input = setupRequestSchema.parse(request.body);
    const codeHash = digest(input.code);
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const result = await inTransaction(pool, async (client) => {
      const code = await client.query<{ id: string; owner_id: string }>(
        `SELECT id, owner_id FROM account_setup_codes
         WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`,
        [codeHash],
      );
      if (code.rowCount !== 1) throw httpError(400, "Setup or recovery code is invalid or expired.");
      const updated = await client.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 AND disabled_at IS NULL RETURNING id", [code.rows[0].owner_id, passwordHash]);
      if (updated.rowCount !== 1) throw httpError(400, "Setup or recovery code is invalid or expired.");
      await client.query("UPDATE account_setup_codes SET consumed_at = now() WHERE id = $1", [code.rows[0].id]);
      await client.query("UPDATE sessions SET revoked_at = now() WHERE owner_id = $1 AND revoked_at IS NULL", [code.rows[0].owner_id]);
      const session = await createSession(client, code.rows[0].owner_id, config);
      return { accountId: code.rows[0].owner_id, ...session };
    });
    setSessionCookies(reply, config, result);
    return reply.send({ accountId: result.accountId, csrfToken: result.csrfToken });
  });

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    requireOrigin(request, config);
    const input = loginRequestSchema.parse(request.body);
    const user = await pool.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE username = $1 AND disabled_at IS NULL AND password_hash IS NOT NULL",
      [normalizeUsername(input.username)],
    );
    const valid = user.rowCount === 1 && await argon2.verify(user.rows[0].password_hash, input.password).catch(() => false);
    if (!valid) throw httpError(401, "Username or password is incorrect.");
    const session = await inTransaction(pool, (client) => createSession(client, user.rows[0].id, config));
    setSessionCookies(reply, config, session);
    return reply.send({ accountId: user.rows[0].id, csrfToken: session.csrfToken });
  });

  app.get("/api/v1/auth/session", async (request) => {
    const session = await authenticate(request, pool, config);
    return { accountId: session.accountId, username: session.username, displayName: session.displayName, role: session.role, capabilities: session.capabilities };
  });

  app.post("/api/v1/auth/password", async (request, reply) => {
    const session = await authenticate(request, pool, config);
    requireCsrf(request, session, config);
    const input = passwordChangeSchema.parse(request.body);
    const current = await pool.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [session.accountId]);
    if (current.rowCount !== 1 || !await argon2.verify(current.rows[0].password_hash, input.currentPassword).catch(() => false)) {
      throw httpError(401, "Current password is incorrect.");
    }
    const passwordHash = await argon2.hash(input.newPassword, ARGON2_OPTIONS);
    const replacement = await inTransaction(pool, async (client) => {
      await client.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [session.accountId, passwordHash]);
      await client.query("UPDATE sessions SET revoked_at = now() WHERE owner_id = $1 AND revoked_at IS NULL", [session.accountId]);
      return createSession(client, session.accountId, config);
    });
    setSessionCookies(reply, config, replacement);
    return { csrfToken: replacement.csrfToken };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const session = await authenticate(request, pool, config);
    requireCsrf(request, session, config);
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.sessionId]);
    reply.clearCookie(COOKIE_NAME, cookieOptions(config));
    reply.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
    return reply.status(204).send();
  });
}
