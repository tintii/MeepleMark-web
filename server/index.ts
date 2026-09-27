import { buildApp } from "./app";
import { readConfig } from "./config";
import { createPool } from "./db";

const config = readConfig();
const pool = createPool(config);
const app = await buildApp({ config, pool });

const close = async (): Promise<void> => {
  await app.close();
  await pool.end();
};
process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
await app.listen({ host: config.HOST, port: config.PORT });

