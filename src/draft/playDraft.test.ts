import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  complete,
  parseDecimalField,
  recomputeTotal,
  setCategoryValue,
  setRank,
  setScore,
  setWin,
  TemplateApplicationError,
} from "./playDraft";
import type { Play, Template } from "../engine/models";

function makePlay(overrides: Partial<Play> = {}): Play {
  return {
    id: "play-1",
    playedAt: "2026-01-01T00:00:00Z",
    status: "draft",
    gameName: "Wingspan",
    gameRef: null,
    winDirection: "high",
    outcome: "ranked",
    scoring: null,
    players: [
      { name: "Alice", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
    ],
    notes: null,
    ...overrides,
  };
}

describe("parseDecimalField", () => {
  it("clears on empty/whitespace text", () => {
    expect(parseDecimalField("")).toBeNull();
    expect(parseDecimalField("   ")).toBeNull();
  });

  it("parses a plain base-10 decimal", () => {
    expect(parseDecimalField("8.5")?.toFixed()).toBe("8.5");
    expect(parseDecimalField("-3")?.toFixed()).toBe("-3");
  });

  it("rejects anything that isn't a plain decimal", () => {
    expect(parseDecimalField("abc")).toBeUndefined();
    expect(parseDecimalField("1e5")).toBeUndefined();
    expect(parseDecimalField(".5")).toBeUndefined();
    expect(parseDecimalField("8.")).toBeUndefined();
  });
});

describe("setScore", () => {
  it("sets total and marks it overridden", () => {
    const play = makePlay();
    const updated = setScore(play, 0, "12.5");
    expect(updated?.players[0].total?.toFixed()).toBe("12.5");
    expect(updated?.players[0].totalIsOverridden).toBe(true);
  });

  it("clears total and the override on empty text", () => {
    const play = makePlay({
      players: [
        { name: "Alice", playerRef: null, categories: null, total: new Decimal(5), totalIsOverridden: true, rank: null, rankIsOverridden: false, win: null },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = setScore(play, 0, "");
    expect(updated?.players[0].total).toBeNull();
    expect(updated?.players[0].totalIsOverridden).toBe(false);
  });

  it("rejects bad text and leaves the play unchanged (returns null)", () => {
    const play = makePlay();
    expect(setScore(play, 0, "not a number")).toBeNull();
  });
});

describe("setCategoryValue", () => {
  it("adds a category value without touching total/totalIsOverridden", () => {
    const play = makePlay({
      players: [
        { name: "Alice", playerRef: null, categories: null, total: new Decimal(99), totalIsOverridden: true, rank: null, rankIsOverridden: false, win: null },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = setCategoryValue(play, 0, "birds", "3");
    expect(updated?.players[0].categories?.birds.toFixed()).toBe("3");
    // The sticky override survives the category edit untouched — this is
    // the whole point of D5 (overrides-survive-a-score-edit).
    expect(updated?.players[0].total?.toFixed()).toBe("99");
    expect(updated?.players[0].totalIsOverridden).toBe(true);
  });

  it("removes a key on empty text, and collapses to null once empty", () => {
    const play = makePlay({
      players: [
        { name: "Alice", playerRef: null, categories: { birds: new Decimal(3) }, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = setCategoryValue(play, 0, "birds", "");
    expect(updated?.players[0].categories).toBeNull();
  });

  it("rejects bad text (no-op)", () => {
    const play = makePlay();
    expect(setCategoryValue(play, 0, "birds", "nope")).toBeNull();
  });
});

describe("recomputeTotal", () => {
  it("clears the override and sums categories via the engine's recompute", () => {
    const play = makePlay({
      players: [
        {
          name: "Alice",
          playerRef: null,
          categories: { birds: new Decimal(3), eggs: new Decimal(2) },
          total: new Decimal(999),
          totalIsOverridden: true,
          rank: null,
          rankIsOverridden: false,
          win: null,
        },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = recomputeTotal(play, 0);
    expect(updated.players[0].total?.toFixed()).toBe("5");
    expect(updated.players[0].totalIsOverridden).toBe(false);
  });
});

describe("applyTemplate", () => {
  const template: Template = {
    slug: "local:game-1",
    version: 1,
    winDirection: "low",
    defaultOutcome: "flagged",
    categories: [{ key: "birds", label: "Birds" }],
  };

  it("embeds the snapshot and copies winDirection/outcome onto the play", () => {
    const play = makePlay();
    const updated = applyTemplate(play, template);
    expect(updated.scoring?.slug).toBe("local:game-1");
    expect(updated.winDirection).toBe("low");
    expect(updated.outcome).toBe("flagged");
  });

  it("preserves a player's already-typed total as an override rather than discarding it", () => {
    const play = makePlay({
      players: [
        { name: "Alice", playerRef: null, categories: null, total: new Decimal(42), totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = applyTemplate(play, template);
    expect(updated.players[0].total?.toFixed()).toBe("42");
    expect(updated.players[0].totalIsOverridden).toBe(true);
    expect(updated.players[1].totalIsOverridden).toBe(false);
  });

  it("throws if the play is already complete", () => {
    const play = makePlay({ status: "complete" });
    expect(() => applyTemplate(play, template)).toThrow(TemplateApplicationError);
  });
});

describe("setRank", () => {
  it("clears the override on empty text", () => {
    const play = makePlay({
      players: [
        { name: "Alice", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: 2, rankIsOverridden: true, win: null },
        { name: "Bob", playerRef: null, categories: null, total: null, totalIsOverridden: false, rank: null, rankIsOverridden: false, win: null },
      ],
    });
    const updated = setRank(play, 0, "");
    expect(updated?.players[0].rank).toBeNull();
    expect(updated?.players[0].rankIsOverridden).toBe(false);
  });

  it("sets a sticky override for a valid integer >= 1", () => {
    const play = makePlay();
    const updated = setRank(play, 0, "3");
    expect(updated?.players[0].rank).toBe(3);
    expect(updated?.players[0].rankIsOverridden).toBe(true);
  });

  it("rejects 0, negative, decimal, or non-numeric text", () => {
    const play = makePlay();
    expect(setRank(play, 0, "0")).toBeNull();
    expect(setRank(play, 0, "-1")).toBeNull();
    expect(setRank(play, 0, "1.5")).toBeNull();
    expect(setRank(play, 0, "abc")).toBeNull();
  });
});

describe("setWin / complete", () => {
  it("sets a player's win flag", () => {
    const play = makePlay({ outcome: "flagged" });
    const updated = setWin(play, 1, true);
    expect(updated.players[1].win).toBe(true);
    expect(updated.players[0].win).toBeNull();
  });

  it("marks the play complete", () => {
    const play = makePlay();
    expect(complete(play).status).toBe("complete");
  });
});
