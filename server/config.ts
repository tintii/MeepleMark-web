import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  DATABASE_URL: z.string().min(1).default("postgres://meeplemark:meeplemark@127.0.0.1:5432/meeplemark"),
  SESSION_SECRET: z.string().min(32).default("development-only-session-secret-change-me"),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_IDLE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  STATIC_DIR: z.string().default("dist"),
});

export type ServerConfig = z.infer<typeof environmentSchema>;

export function readConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) throw new Error(`Invalid server configuration: ${z.prettifyError(result.error)}`);
  if (result.data.NODE_ENV === "production" && result.data.SESSION_SECRET.startsWith("development-only")) {
    throw new Error("Invalid server configuration: SESSION_SECRET must be set in production");
  }
  return result.data;
}

