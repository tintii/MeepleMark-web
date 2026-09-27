import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { ServerConfig } from "./config";

export function createPool(config: Pick<ServerConfig, "DATABASE_URL">): Pool {
  return new Pool({ connectionString: config.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
}

export async function inTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function oneOrNone<T extends QueryResultRow>(client: PoolClient, text: string, values: unknown[]): Promise<T | null> {
  const result = await client.query<T>(text, values);
  if (result.rowCount === 0) return null;
  if (result.rowCount !== 1) throw new Error(`Expected zero or one row, received ${result.rowCount}`);
  return result.rows[0];
}

