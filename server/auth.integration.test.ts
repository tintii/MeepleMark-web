import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import type { ServerConfig } from "./config";
import { runMigrations } from "./migrate";
import { createAccount, issueRecoveryCode, setAccountDisabled } from "./operator";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const config: ServerConfig = {
  NODE_ENV: "test", HOST: "127.0.0.1", PORT: 8787, DATABASE_URL: databaseUrl ?? "postgres://unused",
  SESSION_SECRET: "test-session-secret-at-least-32-characters", APP_ORIGIN: "http://localhost:5173",
  SESSION_IDLE_DAYS: 7, SESSION_ABSOLUTE_DAYS: 30, STATIC_DIR: "dist",
};

function sessionCookie(headers: Record<string, string | string[] | number | undefined>): string {
  const raw = headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") throw new Error("missing session cookie");
  return first.split(";", 1)[0];
}

integration("account authentication", () => {
  let pool: Pool;
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await runMigrations(pool);
    app = await buildApp({ config, pool });
  });
  afterAll(async () => { await app?.close(); await pool?.end(); });

  it("allows exactly one browser-created first administrator", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/meta" })).json()).toMatchObject({ setup: { required: true }, registration: { enabled: false } });
    const foreign = await app.inject({ method: "POST", url: "/api/v1/setup/admin", headers: { origin: "https://evil.example" }, payload: { username: "first-admin", password: "correct horse battery" } });
    expect(foreign.statusCode).toBe(403);
    const forged = await app.inject({ method: "POST", url: "/api/v1/setup/admin", headers: { origin: config.APP_ORIGIN }, payload: { username: "first-admin", password: "correct horse battery", role: "user" } });
    expect(forged.statusCode).toBe(400);
    const attempts = await Promise.all(["first-admin", "other-admin"].map((username) => app.inject({
      method: "POST", url: "/api/v1/setup/admin", headers: { origin: config.APP_ORIGIN }, payload: { username, displayName: "First Administrator", password: "correct horse battery" },
    })));
    expect(attempts.map((reply) => reply.statusCode).sort()).toEqual([201, 409]);
    const success = attempts.find((reply) => reply.statusCode === 201)!;
    expect(success.headers["cache-control"]).toBe("no-store");
    expect((await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie: sessionCookie(success.headers) } })).json()).toMatchObject({ role: "admin", capabilities: { write: true, admin: true } });
    expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE role='admin' AND password_hash IS NOT NULL")).rows[0].count).toBe(1);
    expect((await pool.query("SELECT count(*)::int AS count FROM sync_state")).rows[0].count).toBe(1);
    expect((await pool.query("SELECT after_summary FROM admin_audit_events WHERE action='installation.admin_created'")).rows[0].after_summary).toMatchObject({ role: "admin" });
    expect((await app.inject({ method: "GET", url: "/api/v1/meta" })).json()).toMatchObject({ setup: { required: false }, registration: { enabled: false } });
  });

  it("rejects invalid/expired setup codes and consumes a valid code once", async () => {
    const created = await createAccount(pool, "setup-user");
    const bad = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: "x".repeat(32), password: "correct horse battery" } });
    expect(bad.statusCode).toBe(400);
    expect(bad.headers["cache-control"]).toBe("no-store");
    const setup = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: created.code, password: "correct horse battery" } });
    expect(setup.statusCode).toBe(200);
    const replay = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: created.code, password: "correct horse battery" } });
    expect(replay.statusCode).toBe(400);
    const expired = await createAccount(pool, "expired-user");
    await pool.query("UPDATE account_setup_codes SET expires_at = now() - interval '1 minute' WHERE owner_id = $1", [expired.accountId]);
    const expiredReply = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: expired.code, password: "correct horse battery" } });
    expect(expiredReply.statusCode).toBe(400);
  });

  it("uses opaque cookies, generic login errors, CSRF checks, logout, and operator revocation", async () => {
    const failed = await app.inject({ method: "POST", url: "/api/v1/auth/login", headers: { origin: config.APP_ORIGIN }, payload: { username: "setup-user", password: "wrong" } });
    expect(failed.statusCode).toBe(401);
    expect(failed.json().message).toBe("Username or password is incorrect.");
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", headers: { origin: config.APP_ORIGIN }, payload: { username: "setup-user", password: "correct horse battery" } });
    const cookie = sessionCookie(login.headers);
    expect(cookie).not.toContain("setup-user");
    const csrfToken = login.json().csrfToken as string;
    const crossOrigin = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie, origin: "https://evil.example", "x-csrf-token": csrfToken } });
    expect(crossOrigin.statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie } })).statusCode).toBe(200);
    await setAccountDisabled(pool, "setup-user", true);
    expect((await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie } })).statusCode).toBe(401);
  });

  it("registers only under the serialized installation policy and rejects privileged fields", async () => {
    const closed = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: config.APP_ORIGIN }, payload: { username: "PublicUser", password: "correct horse battery" } });
    expect(closed.statusCode).toBe(403);
    expect(closed.json().error).toBe("registration_closed");
    await pool.query("UPDATE installation SET registration_enabled=TRUE, registration_default_role='readonly'");
    const forged = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: config.APP_ORIGIN }, payload: { username: "forged-user", password: "correct horse battery", role: "admin" } });
    expect(forged.statusCode).toBe(400);
    const attempts = await Promise.all(["PublicUser", "publicuser"].map((username) => app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: config.APP_ORIGIN }, payload: { username, displayName: "Public User", password: "correct horse battery" } })));
    expect(attempts.map((reply) => reply.statusCode).sort()).toEqual([201, 409]);
    expect((await pool.query("SELECT role FROM users WHERE username='publicuser'")).rows[0].role).toBe("readonly");
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", headers: { origin: config.APP_ORIGIN }, payload: { username: "PUBLICUSER", password: "correct horse battery" } });
    expect(login.statusCode).toBe(200);
    const session = await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie: sessionCookie(login.headers) } });
    expect(session.json()).toMatchObject({ role: "readonly", capabilities: { write: false, admin: false } });

    const lock = await pool.connect(); await lock.query("BEGIN"); await lock.query("SELECT singleton FROM installation WHERE singleton=TRUE FOR UPDATE");
    const afterClosure = app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: config.APP_ORIGIN, "x-forwarded-for": "203.0.113.7" }, payload: { username: "closed-race", password: "correct horse battery" } });
    await lock.query("UPDATE installation SET registration_enabled=FALSE"); await lock.query("COMMIT"); lock.release();
    expect((await afterClosure).statusCode).toBe(403);
    const limited = await app.inject({ method: "POST", url: "/api/v1/auth/register", headers: { origin: config.APP_ORIGIN, "x-forwarded-for": "198.51.100.9" }, payload: { username: "rate-bypass", password: "correct horse battery" } });
    expect(limited.statusCode).toBe(429); expect(limited.headers["cache-control"]).toBe("no-store");

    const recovery = await issueRecoveryCode(pool, "publicuser");
    const recovered = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: recovery.code, password: "replacement horse battery" } });
    expect(recovered.statusCode).toBe(200); expect((await pool.query("SELECT role FROM users WHERE username='publicuser'")).rows[0].role).toBe("readonly");
  });
});
