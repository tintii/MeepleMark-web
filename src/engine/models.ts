import Decimal from "decimal.js";
import { decimalFromString, decimalToString } from "./decimal";

// Ported from Engine/Sources/MeepleNMarkEngine/Models.swift and
// EvaluationResult.swift. In-memory, score values are `Decimal` instances;
// on the wire (JSON persisted to IndexedDB, or the golden corpus fixtures)
// they are always decimal strings, never bare numbers — see decode/encode
// below, which mirror the Swift `Codable` extension on `PlayerScore`.

export type PlayStatus = "draft" | "complete";
export type WinDirection = "high" | "low";
export type OutcomeMode = "ranked" | "flagged";

/**
 * A single flat (L1) scoring category: a key and a human-readable label.
 * Categories never carry a multiplier, formula, or cross-reference.
 */
export interface Category {
  key: string;
  label: string;
}

/**
 * An immutable copy of the template a play was scored with, embedded on the
 * play itself. `winDirection` is deliberately absent here — it lives on
 * `Play.winDirection`, copied at apply time and authoritative from then on.
 */
export interface TemplateSnapshot {
  slug: string;
  version: number;
  defaultOutcome: OutcomeMode;
  categories: Category[];
}

/**
 * A standalone scoring template document, as authored in the corpus. Unlike
 * `TemplateSnapshot`, this carries `winDirection` — the source declaration
 * that gets copied onto a play when the template is applied.
 */
export interface Template {
  slug: string;
  version: number;
  winDirection: WinDirection;
  defaultOutcome: OutcomeMode;
  categories: Category[];
}

/** One player's recorded score on a play. */
export interface PlayerScore {
  name: string;
  playerRef: string | null;
  categories: Record<string, Decimal> | null;
  total: Decimal | null;
  totalIsOverridden: boolean;
  rank: number | null;
  rankIsOverridden: boolean;
  win: boolean | null;
}

/**
 * A recorded play. Self-sufficient: renders in full from its own fields,
 * with no dependency on any catalogue, template store, or player account.
 */
export interface Play {
  id: string;
  /**
   * Kept as an opaque ISO-8601 string rather than a Date — the engine never
   * reads the clock and has no reason to parse it.
   */
  playedAt: string;
  status: PlayStatus;
  gameName: string;
  gameRef: string | null;
  winDirection: WinDirection;
  outcome: OutcomeMode;
  scoring: TemplateSnapshot | null;
  players: PlayerScore[];
  notes: string | null;
}

// --- EvaluationResult.swift ---

export interface Warning {
  code: string;
  message: string;
  playerNames: string[];
}

export interface PlayerResult {
  name: string;
  total: Decimal | null;
  rank: number | null;
  win: boolean | null;
}

export interface EvaluationResult {
  players: PlayerResult[];
  warnings: Warning[];
}

// --- decode/encode: decimal-string wire format <-> Decimal in-memory ---

export class PlayDecodeError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodePlayerScore(json: unknown): PlayerScore {
  if (!isPlainObject(json)) {
    throw new PlayDecodeError("player must be an object");
  }

  const name = json.name;
  if (typeof name !== "string") {
    throw new PlayDecodeError("name is required and must be a string");
  }

  const playerRef = typeof json.playerRef === "string" ? json.playerRef : null;

  let categories: Record<string, Decimal> | null = null;
  if (json.categories != null) {
    if (!isPlainObject(json.categories)) {
      throw new PlayDecodeError("categories must be an object");
    }
    categories = {};
    for (const [key, rawValue] of Object.entries(json.categories)) {
      if (typeof rawValue !== "string") {
        throw new PlayDecodeError(`Category '${key}' value is not a decimal string`);
      }
      const value = decimalFromString(rawValue);
      if (value === null) {
        throw new PlayDecodeError(`Category '${key}' value '${rawValue}' is not a valid decimal string`);
      }
      categories[key] = value;
    }
  }

  let total: Decimal | null = null;
  if (json.total != null) {
    if (typeof json.total !== "string") {
      throw new PlayDecodeError("total is not a decimal string");
    }
    const value = decimalFromString(json.total);
    if (value === null) {
      throw new PlayDecodeError(`total '${json.total}' is not a valid decimal string`);
    }
    total = value;
  }

  const totalIsOverridden = Boolean(json.totalIsOverridden);
  const rank = typeof json.rank === "number" ? json.rank : null;
  const rankIsOverridden = Boolean(json.rankIsOverridden);
  const win = typeof json.win === "boolean" ? json.win : null;

  return { name, playerRef, categories, total, totalIsOverridden, rank, rankIsOverridden, win };
}

export function encodePlayerScore(player: PlayerScore): Record<string, unknown> {
  const out: Record<string, unknown> = { name: player.name };
  if (player.playerRef != null) out.playerRef = player.playerRef;

  if (player.categories != null) {
    const encoded: Record<string, string> = {};
    for (const [key, value] of Object.entries(player.categories)) {
      encoded[key] = decimalToString(value);
    }
    out.categories = encoded;
  }

  out.total = player.total != null ? decimalToString(player.total) : null;
  out.totalIsOverridden = player.totalIsOverridden;
  if (player.rank != null) out.rank = player.rank;
  out.rankIsOverridden = player.rankIsOverridden;
  if (player.win != null) out.win = player.win;

  return out;
}

export function decodePlay(json: unknown): Play {
  if (!isPlainObject(json)) {
    throw new PlayDecodeError("play must be an object");
  }
  if (!Array.isArray(json.players)) {
    throw new PlayDecodeError("players is required and must be an array");
  }

  return {
    id: String(json.id),
    playedAt: String(json.playedAt),
    status: json.status as PlayStatus,
    gameName: String(json.gameName),
    gameRef: typeof json.gameRef === "string" ? json.gameRef : null,
    winDirection: json.winDirection as WinDirection,
    outcome: json.outcome as OutcomeMode,
    scoring: (json.scoring as TemplateSnapshot | null | undefined) ?? null,
    players: json.players.map(decodePlayerScore),
    notes: typeof json.notes === "string" ? json.notes : null,
  };
}

export function encodePlay(play: Play): Record<string, unknown> {
  return {
    id: play.id,
    playedAt: play.playedAt,
    status: play.status,
    gameName: play.gameName,
    gameRef: play.gameRef ?? null,
    winDirection: play.winDirection,
    outcome: play.outcome,
    scoring: play.scoring ?? null,
    players: play.players.map(encodePlayerScore),
    notes: play.notes ?? null,
  };
}
