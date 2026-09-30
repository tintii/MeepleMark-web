import type { ValidationIssue } from "../engine/validation";
import {
  validateGameDocument,
  validatePlayerDocument,
  validatePlayDocument,
  type GameDocument,
  type PlayerDocument,
} from "../shared/documents";

export interface WorkspaceSnapshot {
  games: unknown[];
  players: unknown[];
  plays: unknown[];
}

export interface WorkspaceExportDocument {
  format: "meeplemark-workspace";
  version: 1;
  exportedAt: string;
  games: GameDocument[];
  players: PlayerDocument[];
  plays: Record<string, unknown>[];
}

export interface WorkspaceExportFailure {
  entityType: "game" | "player" | "play";
  id: string;
  issues: ValidationIssue[];
}

const FAILURE_DETAIL_LIMIT = 5;

export class WorkspaceExportValidationError extends Error {
  readonly failures: WorkspaceExportFailure[];
  readonly totalFailures: number;

  constructor(failures: WorkspaceExportFailure[]) {
    const shown = failures.slice(0, FAILURE_DETAIL_LIMIT);
    const details = shown.map(({ entityType, id }) => `${entityType} '${id}'`).join(", ");
    const remainder = failures.length - shown.length;
    super(`Nothing was exported because ${failures.length} record${failures.length === 1 ? " is" : "s are"} unreadable: ${details}${remainder > 0 ? `, and ${remainder} more` : ""}.`);
    this.name = "WorkspaceExportValidationError";
    this.failures = shown;
    this.totalFailures = failures.length;
  }
}

export function workspaceExportFilename(date = new Date()): string {
  return `meeplemark-workspace-${date.toISOString().slice(0, 10)}.json`;
}

function idOf(value: unknown): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>).id === "string") {
    return (value as Record<string, unknown>).id as string;
  }
  return "unknown";
}

export function serializeWorkspace(snapshot: WorkspaceSnapshot, exportedAt = new Date()): string {
  const failures: WorkspaceExportFailure[] = [];
  const groups = [
    ["game", snapshot.games, validateGameDocument],
    ["player", snapshot.players, validatePlayerDocument],
    ["play", snapshot.plays, validatePlayDocument],
  ] as const;
  for (const [entityType, records, validate] of groups) {
    for (const record of records) {
      const issues = validate(record);
      if (issues.length > 0) failures.push({ entityType, id: idOf(record), issues });
    }
  }
  if (failures.length > 0) throw new WorkspaceExportValidationError(failures);

  const document: WorkspaceExportDocument = {
    format: "meeplemark-workspace",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    games: [...snapshot.games].sort((a, b) => idOf(a).localeCompare(idOf(b))) as GameDocument[],
    players: [...snapshot.players].sort((a, b) => idOf(a).localeCompare(idOf(b))) as PlayerDocument[],
    plays: [...snapshot.plays].sort((a, b) => {
      const left = a as Record<string, unknown>;
      const right = b as Record<string, unknown>;
      return String(left.playedAt).localeCompare(String(right.playedAt)) || idOf(a).localeCompare(idOf(b));
    }) as Record<string, unknown>[],
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}
