import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { ServerConfig } from "./config";
import { inTransaction } from "./db";
import { loginRequestSchema, passwordChangeSchema, setupRequestSchema } from "./protocol";

const COOKIE_NAME = "meeplemark_session";
const CSRF_COOKIE_NAME = "meeplemark_csrf";
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

interface AuthenticatedSession {
  accountId: string;
  username: string;
  displayName: string;
  sessionId: string;
  csrfHash: Buffer;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
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

async function createSession(client: PoolClient, ownerId: string, config: ServerConfig): Promise<{ token: string; csrfToken: string }> {
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
    session_id: string; owner_id: string; csrf_hash: Buffer; username: string; display_name: string;
  }>(
    `UPDATE sessions s SET last_seen_at = now(), idle_expires_at = LEAST(s.absolute_expires_at, now() + ($2 * interval '1 day'))
     FROM users u
     WHERE s.owner_id = u.id AND s.token_hash = $1 AND s.revoked_at IS NULL
       AND s.idle_expires_at > now() AND s.absolute_expires_at > now() AND u.disabled_at IS NULL
     RETURNING s.id AS session_id, s.owner_id, s.csrf_hash, u.username::text, u.display_name`,
    [digest(token), config.SESSION_IDLE_DAYS],
  );
  if (result.rowCount !== 1) throw httpError(401, "Authentication required.");
  return { accountId: result.rows[0].owner_id, username: result.rows[0].username, displayName: result.rows[0].display_name, sessionId: result.rows[0].session_id, csrfHash: result.rows[0].csrf_hash };
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
      await client.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 AND disabled_at IS NULL", [code.rows[0].owner_id, passwordHash]);
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
      [input.username.normalize("NFKC").toLocaleLowerCase("en-US")],
    );
    const valid = user.rowCount === 1 && await argon2.verify(user.rows[0].password_hash, input.password).catch(() => false);
    if (!valid) throw httpError(401, "Username or password is incorrect.");
    const session = await inTransaction(pool, (client) => createSession(client, user.rows[0].id, config));
    setSessionCookies(reply, config, session);
    return reply.send({ accountId: user.rows[0].id, csrfToken: session.csrfToken });
  });

  app.get("/api/v1/auth/session", async (request) => {
    const session = await authenticate(request, pool, config);
    return { accountId: session.accountId, username: session.username, displayName: session.displayName };
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
