import type Decimal from "decimal.js";
import { decimalFromString } from "../engine/decimal";
import { recompute } from "../engine/evaluate";
import type { Play, PlayerScore, Template, TemplateSnapshot } from "../engine/models";

// Pure mutators over a `Play` value, ported from
// Persistence/Sources/MeepleNMarkPersistence/PlayDraft.swift. None of these
// touch storage — `usePlayDraft.ts` wraps them with `writePlay` so every
// mutation still persists, exactly like `PlayDraft.save()`. Kept pure and
// storage-free here so they're trivially testable and so the semantics
// (what a keystroke or override does) are the single source of truth,
// independent of the React/IndexedDB wiring around them.
//
// `evaluation` (rank/total/win) is never computed by hand anywhere in this
// module — that's exclusively `evaluate()`'s job (src/engine/evaluate.ts).

/**
 * The one text-to-`Decimal` boundary, shared by every score/category text
 * input (mirrors `PlayDraft.parseDecimalField`). Three outcomes:
 *  - `null`: the text was empty/whitespace — the field clears.
 *  - `undefined`: the text didn't parse as a plain base-10 decimal — the
 *    edit is rejected outright (the caller must leave the play unchanged).
 *  - a `Decimal`: the text parsed — the field takes this value.
 */
export function parseDecimalField(text: string): Decimal | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = decimalFromString(trimmed);
  return value === null ? undefined : value;
}

function updatePlayerAt(play: Play, index: number, update: (player: PlayerScore) => PlayerScore): Play {
  return { ...play, players: play.players.map((p, i) => (i === index ? update(p) : p)) };
}

/**
 * Plain-mode scoring: sets `total` and `totalIsOverridden = (parsed value
 * is present)`. Returns `null` when the edit is rejected (bad text) —
 * the caller should leave the play as-is, no error state.
 */
export function setScore(play: Play, playerIndex: number, text: string): Play | null {
  const parsed = parseDecimalField(text);
  if (parsed === undefined) return null;
  return updatePlayerAt(play, playerIndex, (p) => ({ ...p, total: parsed, totalIsOverridden: parsed !== null }));
}

/**
 * Mutates `players[i].categories` only — add/update/remove the one key,
 * and an empty categories object becomes `null` (mirrors the Swift
 * `categories.isEmpty ? nil : categories`). Never touches
 * `total`/`totalIsOverridden`: that's what keeps a sticky total override
 * sticky under a later category edit.
 */
export function setCategoryValue(
  play: Play,
  playerIndex: number,
  categoryKey: string,
  text: string,
): Play | null {
  const parsed = parseDecimalField(text);
  if (parsed === undefined) return null;
  return updatePlayerAt(play, playerIndex, (p) => {
    const categories = { ...(p.categories ?? {}) };
    if (parsed !== null) {
      categories[categoryKey] = parsed;
    } else {
      delete categories[categoryKey];
    }
    return { ...p, categories: Object.keys(categories).length > 0 ? categories : null };
  });
}

/**
 * The only sanctioned way to clear a sticky total override — routed
 * through the engine's own `recompute`, never reimplemented here.
 */
export function recomputeTotal(play: Play, playerIndex: number): Play {
  return updatePlayerAt(play, playerIndex, (p) => recompute(p));
}

export class TemplateApplicationError extends Error {}

/**
 * Applies a template to this draft. Throws `TemplateApplicationError` if
 * the play isn't a draft (a completed play is immutable on this axis).
 * Embeds a `TemplateSnapshot`, copies `winDirection` and `outcome` (=
 * the template's `defaultOutcome`) onto the play — both become
 * authoritative on the play from then on, independent of later edits to
 * the game's template. For every player who already has a non-null
 * `total`, sets `totalIsOverridden = true` (preserves a typed total
 * rather than discarding it; their category grid opens empty).
 */
export function applyTemplate(play: Play, template: Template): Play {
  if (play.status !== "draft") {
    throw new TemplateApplicationError("cannot apply a template to a completed play");
  }

  const scoring: TemplateSnapshot = {
    slug: template.slug,
    version: template.version,
    defaultOutcome: template.defaultOutcome,
    categories: template.categories,
  };

  return {
    ...play,
    scoring,
    winDirection: template.winDirection,
    outcome: template.defaultOutcome,
    players: play.players.map((p) => (p.total != null ? { ...p, totalIsOverridden: true } : p)),
  };
}

/**
 * A manual rank override — breaking a tie by hand. Empty text clears the
 * override (`rank = null, rankIsOverridden = false`); a valid integer >= 1
 * sets it; anything else is rejected (returns `null`, no-op).
 */
export function setRank(play: Play, playerIndex: number, text: string): Play | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return updatePlayerAt(play, playerIndex, (p) => ({ ...p, rank: null, rankIsOverridden: false }));
  }
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return null;
  return updatePlayerAt(play, playerIndex, (p) => ({ ...p, rank: value, rankIsOverridden: true }));
}

/** A cooperative/solo play's win flag. */
export function setWin(play: Play, playerIndex: number, won: boolean): Play {
  return updatePlayerAt(play, playerIndex, (p) => ({ ...p, win: won }));
}

export function complete(play: Play): Play {
  return { ...play, status: "complete" };
}
