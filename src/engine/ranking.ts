import type Decimal from "decimal.js";
import type { WinDirection, Warning } from "./models";

// Ported from Engine/Sources/MeepleNMarkEngine/Ranking.swift.

/**
 * Standard competition ranking (1,2,2,4): equal totals share a rank, and the
 * next distinct rank skips the places consumed by the tie.
 */
export function standardCompetitionRanks(
  totals: (Decimal | null)[],
  direction: WinDirection,
): (number | null)[] {
  const result: (number | null)[] = new Array(totals.length).fill(null);

  const ranked = totals.map((_, i) => i).filter((i) => totals[i] !== null);
  const sorted = [...ranked].sort((lhsIndex, rhsIndex) => {
    const a = totals[lhsIndex] as Decimal;
    const b = totals[rhsIndex] as Decimal;
    const cmp = a.comparedTo(b);
    return direction === "high" ? -cmp : cmp;
  });

  let place = 1;
  let index = 0;
  while (index < sorted.length) {
    const value = totals[sorted[index]] as Decimal;
    let tieCount = 0;
    let cursor = index;
    while (cursor < sorted.length && (totals[sorted[cursor]] as Decimal).equals(value)) {
      result[sorted[cursor]] = place;
      tieCount += 1;
      cursor += 1;
    }
    place += tieCount;
    index = cursor;
  }

  return result;
}

function decimalOrNullEquals(a: Decimal | null, b: Decimal | null): boolean {
  if (a === null || b === null) return a === b;
  return a.equals(b);
}

/**
 * Detects rank gaps and duplicates that standard competition ranking would
 * not have produced, without ever blocking the result.
 */
export function anomalyWarnings(
  names: string[],
  totals: (Decimal | null)[],
  ranks: (number | null)[],
): Warning[] {
  const indices = ranks.map((_, i) => i).filter((i) => ranks[i] !== null);
  if (indices.length === 0) return [];

  const sortedIndices = [...indices].sort((a, b) => (ranks[a] as number) - (ranks[b] as number));

  const groups: { rank: number; indices: number[] }[] = [];
  for (const i of sortedIndices) {
    const r = ranks[i] as number;
    const last = groups[groups.length - 1];
    if (last && last.rank === r) {
      last.indices.push(i);
    } else {
      groups.push({ rank: r, indices: [i] });
    }
  }

  const warnings: Warning[] = [];

  for (const group of groups) {
    if (group.indices.length <= 1) continue;
    const groupTotals = group.indices.map((i) => totals[i]);
    const first = groupTotals[0];
    const allEqual = groupTotals.every((t) => decimalOrNullEquals(t, first));
    if (!allEqual) {
      const playerNames = group.indices.map((i) => names[i]);
      warnings.push({
        code: "duplicate-rank-unjustified",
        message: `Players ${playerNames.join(", ")} share rank ${group.rank} but have differing totals`,
        playerNames,
      });
    }
  }

  for (let offset = 0; offset < groups.length; offset++) {
    const nextOffset = offset + 1;
    if (nextOffset >= groups.length) continue;
    const group = groups[offset];
    const expectedNext = group.rank + group.indices.length;
    const next = groups[nextOffset];
    if (next.rank !== expectedNext) {
      const playerNames = next.indices.map((i) => names[i]);
      warnings.push({
        code: "rank-gap-unjustified",
        message: `Rank ${next.rank} follows rank ${group.rank} (${group.indices.length} player(s)) with no tie to justify the gap; expected ${expectedNext}`,
        playerNames,
      });
    }
  }

  return warnings;
}
