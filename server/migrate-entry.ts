import { readConfig } from "./config";
import { createPool } from "./db";
import { runMigrations } from "./migrate";

const pool = createPool(readConfig());
try {
  const applied = await runMigrations(pool);
  process.stdout.write(applied.length === 0 ? "Database schema is current.\n" : `Applied: ${applied.join(", ")}\n`);
} finally {
  await pool.end();
}

