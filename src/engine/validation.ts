import { decimalFromString } from "./decimal";

// Ported from Engine/Sources/MeepleNMarkEngine/Validation.swift.
//
// One violation found while validating a play or template document against
// the published JSON Schemas. Validation always reports every violation it
// finds rather than stopping at the first.

export interface ValidationIssue {
  path: string;
  message: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const WIN_DIRECTIONS = new Set(["high", "low"]);
const OUTCOME_MODES = new Set(["ranked", "flagged"]);
const PLAY_STATUSES = new Set(["draft", "complete"]);

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export const TemplateValidation = {
  validate(raw: unknown): ValidationIssue[] {
    if (!isPlainObject(raw)) {
      return [{ path: "", message: "template must be a JSON object" }];
    }
    return validateTemplateObject(raw);
  },
  validateCategories,
};

function validateTemplateObject(json: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowedTopKeys = new Set(["slug", "version", "winDirection", "defaultOutcome", "categories"]);

  for (const key of Object.keys(json)) {
    if (!allowedTopKeys.has(key)) {
      issues.push({ path: key, message: `unexpected property '${key}'` });
    }
  }

  if (typeof json.slug === "string") {
    if (json.slug.length === 0) {
      issues.push({ path: "slug", message: "slug must not be empty" });
    }
  } else {
    issues.push({ path: "slug", message: "slug is required and must be a string" });
  }

  if (isPositiveInteger(json.version)) {
    if (json.version < 1) issues.push({ path: "version", message: "version must be >= 1" });
  } else {
    issues.push({ path: "version", message: "version is required and must be an integer" });
  }

  if (typeof json.winDirection === "string") {
    if (!WIN_DIRECTIONS.has(json.winDirection)) {
      issues.push({ path: "winDirection", message: "winDirection must be 'high' or 'low'" });
    }
  } else {
    issues.push({ path: "winDirection", message: "winDirection is required" });
  }

  if (typeof json.defaultOutcome === "string") {
    if (!OUTCOME_MODES.has(json.defaultOutcome)) {
      issues.push({ path: "defaultOutcome", message: "defaultOutcome must be 'ranked' or 'flagged'" });
    }
  } else {
    issues.push({ path: "defaultOutcome", message: "defaultOutcome is required" });
  }

  issues.push(...validateCategories(json.categories, "categories"));

  return issues;
}

function validateCategories(raw: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(raw) || !raw.every(isPlainObject)) {
    issues.push({ path, message: "categories is required and must be an array" });
    return issues;
  }
  const categories = raw as Record<string, unknown>[];

  if (categories.length === 0) {
    issues.push({ path, message: "at least one category is required" });
  }
  if (categories.length > 10) {
    issues.push({ path, message: `at most 10 categories are allowed, found ${categories.length}` });
  }

  const allowedCategoryKeys = new Set(["key", "label"]);
  const seenKeys = new Map<string, number>();

  categories.forEach((category, index) => {
    const itemPath = `${path}[${index}]`;
    for (const key of Object.keys(category)) {
      if (!allowedCategoryKeys.has(key)) {
        issues.push({
          path: itemPath,
          message: `category declares an L2 field '${key}' (multiplier, formula, or reference are not allowed at L1)`,
        });
      }
    }
    if (typeof category.key === "string" && category.key.length > 0) {
      seenKeys.set(category.key, (seenKeys.get(category.key) ?? 0) + 1);
    } else {
      issues.push({ path: `${itemPath}.key`, message: "key is required and must be a non-empty string" });
    }
    if (!(typeof category.label === "string" && category.label.length > 0)) {
      issues.push({ path: `${itemPath}.label`, message: "label is required and must be a non-empty string" });
    }
  });

  for (const key of [...seenKeys.keys()].sort()) {
    if ((seenKeys.get(key) ?? 0) > 1) {
      issues.push({ path, message: `duplicate category key '${key}'` });
    }
  }

  return issues;
}

export const PlayValidation = {
  validate(raw: unknown): ValidationIssue[] {
    if (!isPlainObject(raw)) {
      return [{ path: "", message: "play must be a JSON object" }];
    }
    return validatePlayObject(raw);
  },
};

function validatePlayObject(json: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!(typeof json.id === "string" && json.id.length > 0)) {
    issues.push({ path: "id", message: "id is required and must be a non-empty string" });
  }
  if (typeof json.playedAt !== "string") {
    issues.push({ path: "playedAt", message: "playedAt is required and must be a string" });
  }

  let status: string | undefined;
  if (typeof json.status === "string") {
    status = json.status;
    if (!PLAY_STATUSES.has(status)) {
      issues.push({ path: "status", message: "status must be 'draft' or 'complete'" });
    }
  } else {
    issues.push({ path: "status", message: "status is required" });
  }

  if (!(typeof json.gameName === "string" && json.gameName.length > 0)) {
    issues.push({ path: "gameName", message: "gameName is required and must be a non-empty string" });
  }

  if (json.gameRef !== undefined && json.gameRef !== null && typeof json.gameRef !== "string") {
    issues.push({ path: "gameRef", message: "gameRef must be a string or null" });
  }

  if (typeof json.winDirection === "string") {
    if (!WIN_DIRECTIONS.has(json.winDirection)) {
      issues.push({ path: "winDirection", message: "winDirection must be 'high' or 'low'" });
    }
  } else {
    issues.push({ path: "winDirection", message: "winDirection is required" });
  }

  let outcome: string | undefined;
  if (typeof json.outcome === "string") {
    outcome = json.outcome;
    if (!OUTCOME_MODES.has(outcome)) {
      issues.push({ path: "outcome", message: "outcome must be 'ranked' or 'flagged'" });
    }
  } else {
    issues.push({ path: "outcome", message: "outcome is required" });
  }

  if (json.scoring !== undefined && json.scoring !== null) {
    if (!isPlainObject(json.scoring)) {
      issues.push({ path: "scoring", message: "scoring must be an object or null" });
      return issues;
    }
    const scoringObject = json.scoring;
    const allowedScoringKeys = new Set(["slug", "version", "defaultOutcome", "categories"]);
    for (const key of Object.keys(scoringObject)) {
      if (!allowedScoringKeys.has(key)) {
        issues.push({
          path: `scoring.${key}`,
          message: `unexpected property '${key}' on an embedded template snapshot`,
        });
      }
    }
    if (!(typeof scoringObject.slug === "string" && scoringObject.slug.length > 0)) {
      issues.push({ path: "scoring.slug", message: "slug is required and must be a non-empty string" });
    }
    if (isPositiveInteger(scoringObject.version)) {
      if (scoringObject.version < 1) {
        issues.push({ path: "scoring.version", message: "version must be >= 1" });
      }
    } else {
      issues.push({ path: "scoring.version", message: "version is required and must be an integer" });
    }
    if (typeof scoringObject.defaultOutcome === "string") {
      if (!OUTCOME_MODES.has(scoringObject.defaultOutcome)) {
        issues.push({ path: "scoring.defaultOutcome", message: "defaultOutcome must be 'ranked' or 'flagged'" });
      }
    } else {
      issues.push({ path: "scoring.defaultOutcome", message: "defaultOutcome is required" });
    }
    issues.push(...validateCategories(scoringObject.categories, "scoring.categories"));
  }

  if (Array.isArray(json.players)) {
    const players = json.players;
    if (players.length === 0) {
      issues.push({ path: "players", message: "at least one player is required" });
    }
    players.forEach((player: unknown, index: number) => {
      issues.push(...validatePlayer(player, `players[${index}]`, outcome));
    });
  } else {
    issues.push({ path: "players", message: "players is required and must be an array" });
  }

  return issues;
}

function validatePlayer(player: unknown, path: string, outcome: string | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(player)) {
    issues.push({ path, message: "player must be an object" });
    return issues;
  }

  if (!(typeof player.name === "string" && player.name.length > 0)) {
    issues.push({ path: `${path}.name`, message: "name is required and must be a non-empty string" });
  }

  if (player.categories !== undefined && player.categories !== null) {
    if (!isPlainObject(player.categories)) {
      issues.push({ path: `${path}.categories`, message: "categories must be an object or null" });
      return issues;
    }
    for (const [key, value] of Object.entries(player.categories)) {
      if (typeof value === "string") {
        if (decimalFromString(value) === null) {
          issues.push({ path: `${path}.categories.${key}`, message: `'${value}' is not a valid decimal string` });
        }
      } else {
        issues.push({
          path: `${path}.categories.${key}`,
          message: "category values must be decimal-formatted strings, not JSON numbers",
        });
      }
    }
  }

  if (player.total !== undefined && player.total !== null) {
    if (typeof player.total === "string") {
      if (decimalFromString(player.total) === null) {
        issues.push({ path: `${path}.total`, message: `'${player.total}' is not a valid decimal string` });
      }
    } else {
      issues.push({ path: `${path}.total`, message: "total must be a decimal-formatted string, not a JSON number" });
    }
  } else if (player.total === undefined) {
    issues.push({ path: `${path}.total`, message: "total is required (use null if not yet scored)" });
  }

  if (typeof player.totalIsOverridden !== "boolean") {
    issues.push({ path: `${path}.totalIsOverridden`, message: "totalIsOverridden is required and must be a boolean" });
  }
  if (typeof player.rankIsOverridden !== "boolean") {
    issues.push({ path: `${path}.rankIsOverridden`, message: "rankIsOverridden is required and must be a boolean" });
  }

  const hasRankKey = player.rank !== undefined;
  const hasWinKey = player.win !== undefined;

  if (outcome === "ranked") {
    if (!hasRankKey) issues.push({ path: `${path}.rank`, message: "rank is required when outcome is 'ranked'" });
    if (hasWinKey) issues.push({ path: `${path}.win`, message: "win must not be present when outcome is 'ranked'" });
  } else if (outcome === "flagged") {
    if (!hasWinKey) issues.push({ path: `${path}.win`, message: "win is required when outcome is 'flagged'" });
    if (hasRankKey) issues.push({ path: `${path}.rank`, message: "rank must not be present when outcome is 'flagged'" });
  }

  if (player.rank !== undefined && player.rank !== null) {
    if (isPositiveInteger(player.rank)) {
      if (player.rank < 1) issues.push({ path: `${path}.rank`, message: "rank must be >= 1" });
    } else {
      issues.push({ path: `${path}.rank`, message: "rank must be an integer or null" });
    }
  }

  if (player.win !== undefined && player.win !== null && typeof player.win !== "boolean") {
    issues.push({ path: `${path}.win`, message: "win must be a boolean or null" });
  }

  return issues;
}
