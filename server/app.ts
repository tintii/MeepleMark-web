import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { ZodError } from "zod";
import type { ServerConfig } from "./config";
import { MAX_JSON_BODY_BYTES, PROTOCOL_VERSION } from "./protocol";
import { registerAuthRoutes } from "./auth";
import { registerSyncRoutes } from "./sync";
import { registerAdoptionRoutes } from "./adoption";
import { registerAdminRoutes } from "./admin";
import staticFiles from "@fastify/static";
import path from "node:path";

export interface AppDependencies { config: ServerConfig; pool: Pool }

export async function buildApp({ config, pool }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { redact: ["req.headers.cookie", "req.headers.authorization", "req.body.password", "req.body.currentPassword", "req.body.newPassword", "req.body.code", "res.body.code"] },
    bodyLimit: MAX_JSON_BODY_BYTES,
    trustProxy: false,
  });
  await app.register(cookie, { secret: config.SESSION_SECRET, hook: "onRequest" });
  await app.register(rateLimit, { global: false, max: 100, timeWindow: "1 minute" });

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      const field = first?.path.length ? `${first.path.join(".")}: ` : "";
      return reply.status(400).send({ error: "invalid_request", message: `${field}${first?.message ?? "Request is invalid."}`, issues: error.issues });
    }
    const status = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : "Request failed";
    return reply.status(status).send({ error: status >= 500 ? "internal_error" : name, message: status >= 500 ? "Request failed" : message });
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    const result = await pool.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").catch(() => null);
    if (!result || result.rows[0]?.version !== "002_registration_admin.sql") return reply.status(503).send({ status: "unready" });
    return { status: "ready", schema: result.rows[0].version };
  });
  app.get("/api/v1/meta", async () => {
    const result = await pool.query<{ installation_id: string; recovery_epoch: string; registration_enabled: boolean; registration_default_role: "readonly" | "user"; setup_required: boolean }>(
      "SELECT installation_id, recovery_epoch, registration_enabled, registration_default_role, NOT EXISTS (SELECT 1 FROM users) AS setup_required FROM installation WHERE singleton = TRUE",
    );
    if (result.rowCount !== 1) throw new Error("installation identity is unavailable");
    return { protocolVersion: PROTOCOL_VERSION, installationId: result.rows[0].installation_id, recoveryEpoch: result.rows[0].recovery_epoch, setup: { required: result.rows[0].setup_required }, registration: { enabled: result.rows[0].registration_enabled, defaultRole: result.rows[0].registration_default_role } };
  });
  await registerAuthRoutes(app, pool, config);
  await registerSyncRoutes(app, pool, config);
  await registerAdoptionRoutes(app, pool, config);
  await registerAdminRoutes(app, pool, config);
  await app.register(staticFiles, { root: path.resolve(config.STATIC_DIR), wildcard: false, index: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.status(404).send({ error: "not_found", message: "API route not found." });
    if (request.url.startsWith("/assets/") || /\.[a-z0-9]+(?:\?|$)/i.test(request.url)) return reply.status(404).send("Not found");
    if (request.method === "GET") return reply.type("text/html").sendFile("index.html");
    return reply.status(404).send("Not found");
  });
  return app;
}
