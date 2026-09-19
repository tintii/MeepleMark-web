import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { standardCompetitionRanks, anomalyWarnings } from "./ranking";

const d = (v: string) => new Decimal(v);

describe("standardCompetitionRanks", () => {
  it("ranks 1,2,2,4 style on ties (high wins)", () => {
    const totals = [d("10"), d("20"), d("20"), d("5")];
    expect(standardCompetitionRanks(totals, "high")).toEqual([3, 1, 1, 4]);
  });

  it("ranks low-wins direction", () => {
    const totals = [d("10"), d("20"), d("5")];
    expect(standardCompetitionRanks(totals, "low")).toEqual([2, 3, 1]);
  });

  it("skips null totals, leaving their rank null", () => {
    const totals = [d("10"), null, d("20")];
    expect(standardCompetitionRanks(totals, "high")).toEqual([2, null, 1]);
  });

  it("all tied gives everyone rank 1", () => {
    const totals = [d("10"), d("10"), d("10")];
    expect(standardCompetitionRanks(totals, "high")).toEqual([1, 1, 1]);
  });
});

describe("anomalyWarnings", () => {
  it("flags a duplicate rank with differing totals", () => {
    const warnings = anomalyWarnings(["Alice", "Bob"], [d("10"), d("20")], [1, 1]);
    expect(warnings).toEqual([
      {
        code: "duplicate-rank-unjustified",
        message: "Players Alice, Bob share rank 1 but have differing totals",
        playerNames: ["Alice", "Bob"],
      },
    ]);
  });

  it("does not flag a duplicate rank when totals genuinely tie", () => {
    const warnings = anomalyWarnings(["Alice", "Bob"], [d("10"), d("10")], [1, 1]);
    expect(warnings).toEqual([]);
  });

  it("flags an unjustified rank gap", () => {
    const warnings = anomalyWarnings(["Alice", "Bob", "Cara"], [d("75"), d("62"), d("51")], [1, 2, 5]);
    expect(warnings).toEqual([
      {
        code: "rank-gap-unjustified",
        message: "Rank 5 follows rank 2 (1 player(s)) with no tie to justify the gap; expected 3",
        playerNames: ["Cara"],
      },
    ]);
  });

  it("does not flag a gap that a tie justifies", () => {
    const warnings = anomalyWarnings(["Alice", "Bob", "Cara"], [d("10"), d("10"), d("5")], [1, 1, 3]);
    expect(warnings).toEqual([]);
  });

  it("returns no warnings when no player has a rank", () => {
    expect(anomalyWarnings(["Alice"], [null], [null])).toEqual([]);
  });
});
