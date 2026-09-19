import Decimal from "decimal.js";
import type { EvaluationResult, Play, PlayerScore, TemplateSnapshot } from "./models";
import { standardCompetitionRanks, anomalyWarnings } from "./ranking";

// Ported from Engine/Sources/MeepleNMarkEngine/Engine.swift.
//
// The pure, stateless scoring engine. `evaluate()` takes a play document and
// returns totals, ranks, win flags, and warnings — no I/O, no `Date.now()`,
// no randomness. Evaluating the same document twice always produces
// byte-for-byte identical output.
//
// L1 relies on exactly two Decimal operations: addition and comparison.
// Division and rounding are excluded by design — both are base-10 exact,
// which is the property the golden corpus (`exact-decimal-arithmetic.json`,
// `summing-mixed-signs.json`) leans on.

/**
 * The total the engine uses for ranking: the stored total when overridden;
 * otherwise the exact sum of category values for a templated play, or the
 * stored total as authored in plain mode.
 */
export function total(player: PlayerScore, scoring: TemplateSnapshot | null): Decimal | null {
  if (player.totalIsOverridden) {
    return player.total ?? null;
  }
  if (scoring != null) {
    const values = player.categories ? Object.values(player.categories) : [];
    return values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0));
  }
  return player.total ?? null;
}

/**
 * Explicit recompute: clears the override and resets the total to the sum
 * of categories. The only way a sticky override is ever cleared.
 */
export function recompute(player: PlayerScore): PlayerScore {
  const values = player.categories ? Object.values(player.categories) : [];
  const sum = values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0));
  return { ...player, total: sum, totalIsOverridden: false };
}

export function evaluate(play: Play): EvaluationResult {
  const totals = play.players.map((player) => total(player, play.scoring));
  const names = play.players.map((player) => player.name);

  if (play.outcome === "ranked") {
    const derived = standardCompetitionRanks(totals, play.winDirection);
    const ranks = play.players.map((player, index) =>
      player.rankIsOverridden ? player.rank ?? null : derived[index],
    );
    const warnings = anomalyWarnings(names, totals, ranks);
    const players = play.players.map((_, index) => ({
      name: names[index],
      total: totals[index],
      rank: ranks[index],
      win: null,
    }));
    return { players, warnings };
  }

  // outcome === "flagged": there is no rank at all; win falls back to
  // false, and warnings are always empty.
  const players = play.players.map((player, index) => ({
    name: names[index],
    total: totals[index],
    rank: null,
    win: player.win ?? false,
  }));
  return { players, warnings: [] };
}
