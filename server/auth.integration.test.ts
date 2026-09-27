import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import type { ServerConfig } from "./config";
import { runMigrations } from "./migrate";
import { createAccount, setAccountDisabled } from "./operator";

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
});
