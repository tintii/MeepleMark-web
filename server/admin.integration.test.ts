import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import type { ServerConfig } from "./config";
import { runMigrations } from "./migrate";
import { createAccount, setAccountRole } from "./operator";
import { deleteManagedAccount, setRole } from "./admin";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const config: ServerConfig = { NODE_ENV: "test", HOST: "127.0.0.1", PORT: 8787, DATABASE_URL: databaseUrl ?? "postgres://unused", SESSION_SECRET: "test-session-secret-at-least-32-characters", APP_ORIGIN: "http://localhost:5173", SESSION_IDLE_DAYS: 7, SESSION_ABSOLUTE_DAYS: 30, STATIC_DIR: "dist" };

function cookie(headers: Record<string, string | string[] | number | undefined>): string {
  const raw = headers["set-cookie"]; const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

integration("administration API", () => {
  let pool: Pool; let app: Awaited<ReturnType<typeof buildApp>>; let adminCookie: string; let userCookie: string; let csrf: string; let adminId: string; let userId: string;
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl }); await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public"); await runMigrations(pool); app = await buildApp({ config, pool });
    const admin = await createAccount(pool, "admin-user"); adminId = admin.accountId;
    const setup = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: admin.code, password: "correct horse battery" } });
    adminCookie = cookie(setup.headers); csrf = setup.json().csrfToken; await setAccountRole(pool, "admin-user", "admin");
    const user = await createAccount(pool, "managed-user"); userId = user.accountId;
    const userSetup = await app.inject({ method: "POST", url: "/api/v1/auth/setup", headers: { origin: config.APP_ORIGIN }, payload: { code: user.code, password: "correct horse battery" } }); userCookie = cookie(userSetup.headers);
  });
  afterAll(async () => { await app?.close(); await pool?.end(); });

  it("denies non-admins and returns bounded secret-free datasets", async () => {
    const noAuth = await app.inject({ method: "GET", url: "/api/v1/admin/users" }); expect(noAuth.statusCode).toBe(401);
    const nonAdmin = await app.inject({ method: "GET", url: "/api/v1/admin/users", headers: { cookie: userCookie } }); expect(nonAdmin.statusCode).toBe(403);
    const result = await app.inject({ method: "GET", url: "/api/v1/admin/users?limit=1&page=1", headers: { cookie: adminCookie } });
    expect(result.statusCode).toBe(200); expect(result.json().items).toHaveLength(1); expect(JSON.stringify(result.json())).not.toMatch(/password|token|game/i);
    expect(result.headers["cache-control"]).toBe("no-store");
  });

  it("manages roles, recovery, registration and audit atomically", async () => {
    const headers = { cookie: adminCookie, origin: config.APP_ORIGIN, "x-csrf-token": csrf };
    expect((await app.inject({ method: "PUT", url: `/api/v1/admin/users/${userId}/role`, headers, payload: { role: "readonly" } })).statusCode).toBe(200);
    const recovery = await app.inject({ method: "POST", url: `/api/v1/admin/users/${userId}/recovery`, headers });
    expect(recovery.statusCode).toBe(200); expect(recovery.json().code).toHaveLength(43);
    expect((await app.inject({ method: "PUT", url: "/api/v1/admin/registration", headers, payload: { enabled: true, defaultRole: "admin" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/api/v1/admin/registration", headers, payload: { enabled: true, defaultRole: "user" } })).statusCode).toBe(200);
    const audit = await app.inject({ method: "GET", url: "/api/v1/admin/audit?page=1&limit=100", headers: { cookie: adminCookie } });
    expect(audit.statusCode).toBe(200); expect(JSON.stringify(audit.json())).not.toContain(recovery.json().code); expect(audit.json().items.map((event: { action: string }) => event.action)).toEqual(expect.arrayContaining(["account.role_changed", "account.recovery_issued", "registration.updated"]));
  });

  it("enforces CSRF and protects the last usable administrator", async () => {
    expect((await app.inject({ method: "PUT", url: `/api/v1/admin/users/${userId}/status`, headers: { cookie: adminCookie, origin: config.APP_ORIGIN }, payload: { disabled: true } })).statusCode).toBe(403);
    const headers = { cookie: adminCookie, origin: config.APP_ORIGIN, "x-csrf-token": csrf };
    const demote = await app.inject({ method: "PUT", url: `/api/v1/admin/users/${adminId}/role`, headers, payload: { role: "user" } });
    expect(demote.statusCode).toBe(409); expect(demote.json().error).toBe("last_admin");
  });

  it("rolls back an administrative mutation when its audit write fails and retains deletion history", async () => {
    const created = await createAccount(pool, "audit-target");
    await pool.query("UPDATE users SET password_hash='initialized' WHERE id=$1", [created.accountId]);
    await pool.query(`CREATE FUNCTION reject_role_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='account.role_changed' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`);
    await pool.query("CREATE TRIGGER reject_role_audit BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION reject_role_audit()");
    await expect(setRole(pool, created.accountId, "readonly", { source: "cli" })).rejects.toThrow("audit unavailable");
    expect((await pool.query("SELECT role FROM users WHERE id=$1", [created.accountId])).rows[0].role).toBe("user");
    await pool.query("DROP TRIGGER reject_role_audit ON admin_audit_events; DROP FUNCTION reject_role_audit()");
    await deleteManagedAccount(pool, created.accountId, "audit-target", { source: "cli" });
    expect((await pool.query("SELECT 1 FROM admin_audit_events WHERE target_id=$1 AND action='account.deleted'", [created.accountId])).rowCount).toBe(1);
  });

  it("serializes concurrent removals so one usable administrator remains", async () => {
    const second = await createAccount(pool, "second-admin"); await pool.query("UPDATE users SET password_hash='initialized' WHERE id=$1", [second.accountId]); await setAccountRole(pool, "second-admin", "admin");
    const results = await Promise.allSettled([setRole(pool, adminId, "user", { source: "cli" }), setRole(pool, second.accountId, "user", { source: "cli" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(Number((await pool.query<{ count: string }>("SELECT count(*) FROM users WHERE role='admin' AND disabled_at IS NULL AND password_hash IS NOT NULL")).rows[0].count)).toBe(1);
  });
});
