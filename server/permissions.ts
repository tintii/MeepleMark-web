import type { PoolClient } from "pg";

export const ACCOUNT_ROLES = ["readonly", "user", "admin"] as const;
export type AccountRole = typeof ACCOUNT_ROLES[number];
export interface Capabilities { write: boolean; admin: boolean }

export function capabilitiesFor(role: AccountRole): Capabilities {
  return { write: role === "user" || role === "admin", admin: role === "admin" };
}

export class HttpError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = code;
  }
}

export function forbidden(code: string, message: string): HttpError {
  return new HttpError(403, code, message);
}

export async function requireWriteAccess(client: PoolClient, accountId: string): Promise<AccountRole> {
  const result = await client.query<{ role: AccountRole }>(
    "SELECT role FROM users WHERE id = $1 AND disabled_at IS NULL FOR UPDATE",
    [accountId],
  );
  if (result.rowCount !== 1) throw forbidden("account_unavailable", "Account is unavailable.");
  if (!capabilitiesFor(result.rows[0].role).write) throw forbidden("write_forbidden", "This account is read-only.");
  return result.rows[0].role;
}
