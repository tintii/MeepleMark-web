import type { EvaluationResult, OutcomeMode } from "./models";

// Ported from App/Sources/MeepleNMark/Support/WinnerSummary.swift.
//
// "Who won" is answered in exactly one place, shared by the plays list and
// a play's own completion feedback. Never computed by hand elsewhere.

/**
 * The player name(s) an evaluation credits with the win — rank 1 (ties
 * included) for a ranked outcome, or every player flagged `win` for a
 * flagged/cooperative outcome.
 */
export function winnerNames(evaluation: EvaluationResult, outcome: OutcomeMode): string[] {
  if (outcome === "ranked") {
    return evaluation.players.filter((p) => p.rank === 1).map((p) => p.name);
  }
  return evaluation.players.filter((p) => p.win === true).map((p) => p.name);
}

/**
 * A short human sentence for the winner(s), or `null` when nothing has
 * been decided yet (no scores, or a flagged play with nothing flagged).
 */
export function winnerSummarySentence(evaluation: EvaluationResult, outcome: OutcomeMode): string | null {
  const winners = winnerNames(evaluation, outcome);
  if (winners.length === 0) return null;
  return winners.length > 1 ? `${winners.join(" & ")} tied for first.` : `${winners[0]} won.`;
}
