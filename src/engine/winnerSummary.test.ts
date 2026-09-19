import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { winnerNames, winnerSummarySentence } from "./winnerSummary";
import type { EvaluationResult } from "./models";

function result(players: EvaluationResult["players"]): EvaluationResult {
  return { players, warnings: [] };
}

describe("winnerNames", () => {
  it("ranked: players with rank === 1", () => {
    const evaluation = result([
      { name: "Alice", total: new Decimal(10), rank: 1, win: null },
      { name: "Bob", total: new Decimal(5), rank: 2, win: null },
    ]);
    expect(winnerNames(evaluation, "ranked")).toEqual(["Alice"]);
  });

  it("ranked: a tie for first names every rank-1 player", () => {
    const evaluation = result([
      { name: "Alice", total: new Decimal(10), rank: 1, win: null },
      { name: "Bob", total: new Decimal(10), rank: 1, win: null },
      { name: "Cara", total: new Decimal(5), rank: 3, win: null },
    ]);
    expect(winnerNames(evaluation, "ranked")).toEqual(["Alice", "Bob"]);
  });

  it("flagged: players with win === true", () => {
    const evaluation = result([
      { name: "Alice", total: null, rank: null, win: true },
      { name: "Bob", total: null, rank: null, win: false },
    ]);
    expect(winnerNames(evaluation, "flagged")).toEqual(["Alice"]);
  });
});

describe("winnerSummarySentence", () => {
  it("is null when nobody has won yet", () => {
    const evaluation = result([{ name: "Alice", total: null, rank: null, win: null }]);
    expect(winnerSummarySentence(evaluation, "ranked")).toBeNull();
  });

  it("names a single winner", () => {
    const evaluation = result([{ name: "Alice", total: new Decimal(10), rank: 1, win: null }]);
    expect(winnerSummarySentence(evaluation, "ranked")).toBe("Alice won.");
  });

  it("joins tied winners with '&'", () => {
    const evaluation = result([
      { name: "Alice", total: new Decimal(10), rank: 1, win: null },
      { name: "Bob", total: new Decimal(10), rank: 1, win: null },
    ]);
    expect(winnerSummarySentence(evaluation, "ranked")).toBe("Alice & Bob tied for first.");
  });

  it("is null for a flagged play with nothing flagged", () => {
    const evaluation = result([{ name: "Alice", total: null, rank: null, win: false }]);
    expect(winnerSummarySentence(evaluation, "flagged")).toBeNull();
  });
});
