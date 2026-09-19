import { describe, expect, it } from "vitest";
import { PlayValidation, TemplateValidation } from "./validation";

describe("TemplateValidation", () => {
  const validTemplate = {
    slug: "wingspan",
    version: 1,
    winDirection: "high",
    defaultOutcome: "ranked",
    categories: [{ key: "birds", label: "Birds" }],
  };

  it("accepts a valid template", () => {
    expect(TemplateValidation.validate(validTemplate)).toEqual([]);
  });

  it("rejects more than 10 categories", () => {
    const categories = Array.from({ length: 11 }, (_, i) => ({ key: `c${i}`, label: `C${i}` }));
    const issues = TemplateValidation.validate({ ...validTemplate, categories });
    expect(issues.some((i) => i.path === "categories")).toBe(true);
  });

  it("rejects duplicate category keys", () => {
    const issues = TemplateValidation.validate({
      ...validTemplate,
      categories: [
        { key: "a", label: "A" },
        { key: "a", label: "A again" },
      ],
    });
    expect(issues.some((i) => i.message.includes("duplicate category key"))).toBe(true);
  });

  it("rejects an L2 field on a category", () => {
    const issues = TemplateValidation.validate({
      ...validTemplate,
      categories: [{ key: "a", label: "A", multiplier: 2 }],
    });
    expect(issues.some((i) => i.message.includes("L2 field"))).toBe(true);
  });

  it("reports every violation, not just the first", () => {
    const issues = TemplateValidation.validate({});
    expect(issues.length).toBeGreaterThan(1);
  });
});

describe("PlayValidation", () => {
  const validRankedPlay = {
    id: "p1",
    playedAt: "2026-01-01T00:00:00Z",
    status: "complete",
    gameName: "Wingspan",
    gameRef: null,
    winDirection: "high",
    outcome: "ranked",
    scoring: null,
    players: [
      { name: "Alice", total: "10", totalIsOverridden: false, rank: 1, rankIsOverridden: false },
    ],
    notes: null,
  };

  it("accepts a valid ranked play", () => {
    expect(PlayValidation.validate(validRankedPlay)).toEqual([]);
  });

  it("requires rank when outcome is ranked", () => {
    const player = { name: "Alice", total: "10", totalIsOverridden: false, rankIsOverridden: false };
    const issues = PlayValidation.validate({ ...validRankedPlay, players: [player] });
    expect(issues.some((i) => i.path === "players[0].rank")).toBe(true);
  });

  it("forbids win when outcome is ranked", () => {
    const player = {
      name: "Alice",
      total: "10",
      totalIsOverridden: false,
      rank: 1,
      rankIsOverridden: false,
      win: true,
    };
    const issues = PlayValidation.validate({ ...validRankedPlay, players: [player] });
    expect(issues.some((i) => i.path === "players[0].win")).toBe(true);
  });

  it("requires win (not rank) when outcome is flagged", () => {
    const player = { name: "Alice", total: "10", totalIsOverridden: false, rankIsOverridden: false };
    const issues = PlayValidation.validate({ ...validRankedPlay, outcome: "flagged", players: [player] });
    expect(issues.some((i) => i.path === "players[0].win")).toBe(true);
  });

  it("rejects a category value that is a JSON number, not a decimal string", () => {
    const player = {
      name: "Alice",
      categories: { birds: 5 },
      total: "10",
      totalIsOverridden: false,
      rank: 1,
      rankIsOverridden: false,
    };
    const issues = PlayValidation.validate({ ...validRankedPlay, players: [player] });
    expect(issues.some((i) => i.path === "players[0].categories.birds")).toBe(true);
  });

  it("rejects a malformed decimal string", () => {
    const player = {
      name: "Alice",
      total: "1e5",
      totalIsOverridden: false,
      rank: 1,
      rankIsOverridden: false,
    };
    const issues = PlayValidation.validate({ ...validRankedPlay, players: [player] });
    expect(issues.some((i) => i.path === "players[0].total")).toBe(true);
  });

  it("requires at least one player", () => {
    const issues = PlayValidation.validate({ ...validRankedPlay, players: [] });
    expect(issues.some((i) => i.path === "players")).toBe(true);
  });

  it("rejects a non-object payload", () => {
    expect(PlayValidation.validate("not an object")).toEqual([
      { path: "", message: "play must be a JSON object" },
    ]);
  });
});
