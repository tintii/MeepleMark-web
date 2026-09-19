import { describe, expect, it } from "vitest";
import { assignRoster, isGreyscaleAttributable } from "./playerIdentity";
import { playerColor } from "./index";

describe("assignRoster", () => {
  it("assigns first-letter markers and roster-index colours by default", () => {
    const roster = assignRoster(["Alice", "Bob", "Cara"]);
    expect(roster.map((p) => p.marker)).toEqual(["A", "B", "C"]);
    expect(roster.map((p) => p.colorIndex)).toEqual([0, 1, 2]);
  });

  it("disambiguates two players sharing a first letter by growing the prefix", () => {
    const roster = assignRoster(["Sarah", "Stacy"]);
    expect(roster.map((p) => p.marker)).toEqual(["S", "ST"]);
  });

  it("grows the prefix to the full name when that's enough to disambiguate", () => {
    const roster = assignRoster(["Sam", "Sam"]);
    expect(roster.map((p) => p.marker)).toEqual(["S", "SA"]);
  });

  it("falls back to a numeric suffix once even the full name is exhausted", () => {
    // Three identical short names: the second exhausts "AL" (its full
    // name) without a free prefix, so the third can't grow a prefix past
    // "AL" either and must fall back to a numeric suffix.
    const roster = assignRoster(["Al", "Al", "Al"]);
    expect(roster.map((p) => p.marker)).toEqual(["A", "AL", "A2"]);
  });

  it("skips empty names", () => {
    const roster = assignRoster(["Alice", ""]);
    expect(roster.map((p) => p.name)).toEqual(["Alice"]);
  });

  it("honours a colour preference unless already claimed", () => {
    const roster = assignRoster(["Alice", "Bob"], [1, null]);
    expect(roster[0].colorIndex).toBe(1);
    // Bob's own roster index (1) was already taken by Alice's preference,
    // so Bob falls back to the first unclaimed index (0).
    expect(roster[1].colorIndex).toBe(0);
  });

  it("cycles colours by index % 8 for rosters larger than the palette", () => {
    // assignRoster hands out unbounded roster-index colour indices; the
    // index % 8 cycling happens when resolving a colour index to a palette
    // entry (PlayerPalette.color(forPlayerIndex:) in the Swift source).
    const names = Array.from({ length: 9 }, (_, i) => `P${i}`);
    const roster = assignRoster(names);
    expect(roster[8].colorIndex).toBe(8);
    expect(playerColor(roster[8].colorIndex)).toEqual(playerColor(0));
  });

  it("stays greyscale-attributable across a mixed roster", () => {
    const roster = assignRoster(["Sarah", "Stacy", "Sam"]);
    expect(isGreyscaleAttributable(roster)).toBe(true);
  });
});
