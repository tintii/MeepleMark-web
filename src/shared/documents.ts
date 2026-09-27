import type { Play, Template } from "../engine/models";
import { decodePlay, encodePlay } from "../engine/models";
import { PlayValidation, TemplateValidation, type ValidationIssue } from "../engine/validation";

export type EntityType = "game" | "player" | "play";
export type GameOrigin = "corpus" | "bgg" | "custom";

export interface GameDocument {
  id: string;
  name: string;
  slug: string | null;
  bggThingId: string | null;
  origin: GameOrigin;
  ownedAt: string | null;
  localTemplate: Template | null;
  templateVersion: number;
}

export interface PlayerDocument {
  id: string;
  displayName: string;
  bggUsername: string | null;
  preferredColorIndex: number | null;
}

export type EntityDocument = GameDocument | PlayerDocument | Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ path, message: `${path} is required and must be a non-empty string` });
  }
}

function nullableString(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== null && typeof value !== "string") {
    issues.push({ path, message: `${path} must be a string or null` });
  }
}

export function validateGameDocument(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "", message: "game must be a JSON object" }];
  const issues: ValidationIssue[] = [];
  requiredString(value.id, "id", issues);
  requiredString(value.name, "name", issues);
  nullableString(value.slug, "slug", issues);
  nullableString(value.bggThingId, "bggThingId", issues);
  nullableString(value.ownedAt, "ownedAt", issues);
  if (!new Set(["corpus", "bgg", "custom"]).has(String(value.origin))) {
    issues.push({ path: "origin", message: "origin must be 'corpus', 'bgg', or 'custom'" });
  }
  if (!Number.isInteger(value.templateVersion) || Number(value.templateVersion) < 0) {
    issues.push({ path: "templateVersion", message: "templateVersion must be a non-negative integer" });
  }
  if (value.localTemplate !== null) {
    issues.push(...TemplateValidation.validate(value.localTemplate).map((issue) => ({
      path: issue.path ? `localTemplate.${issue.path}` : "localTemplate",
      message: issue.message,
    })));
  }
  return issues;
}

export function validatePlayerDocument(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "", message: "player must be a JSON object" }];
  const issues: ValidationIssue[] = [];
  requiredString(value.id, "id", issues);
  requiredString(value.displayName, "displayName", issues);
  nullableString(value.bggUsername, "bggUsername", issues);
  if (
    value.preferredColorIndex !== null &&
    (!Number.isInteger(value.preferredColorIndex) || Number(value.preferredColorIndex) < 0 || Number(value.preferredColorIndex) > 7)
  ) {
    issues.push({ path: "preferredColorIndex", message: "preferredColorIndex must be null or an integer from 0 through 7" });
  }
  return issues;
}

/** Encode the persisted/API play shape, including required null outcome fields. */
export function encodePlayDocument(play: Play): Record<string, unknown> {
  const encoded = encodePlay(play);
  const players = encoded.players as Record<string, unknown>[];
  const requiredKey = play.outcome === "ranked" ? "rank" : "win";
  for (const player of players) {
    if (!(requiredKey in player)) player[requiredKey] = null;
  }
  return encoded;
}

export class DocumentValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.issues = issues;
  }
}

export function decodePlayDocument(value: unknown): Play {
  const issues = PlayValidation.validate(value);
  if (issues.length > 0) throw new DocumentValidationError(issues);
  return decodePlay(value);
}

export function validateEntityDocument(entityType: EntityType, entityId: string, value: unknown): ValidationIssue[] {
  let issues: ValidationIssue[];
  switch (entityType) {
    case "game":
      issues = validateGameDocument(value);
      break;
    case "player":
      issues = validatePlayerDocument(value);
      break;
    case "play":
      issues = PlayValidation.validate(value);
      break;
  }
  if (isRecord(value) && value.id !== entityId) {
    issues.push({ path: "id", message: "document id must match the mutation entityId" });
  }
  return issues;
}
