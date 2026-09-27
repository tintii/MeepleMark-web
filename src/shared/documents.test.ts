import { readFile } from "node:fs/promises";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { evaluate } from "../engine/evaluate";
import { decodePlayDocument, encodePlayDocument, validateGameDocument, validatePlayerDocument } from "./documents";

describe("shared document codecs", () => {
  it("accepts every version-1 fixture record without changing exact score values", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../../tests/fixtures/existing-indexeddb.json", import.meta.url), "utf8"),
    ) as { games: unknown[]; players: unknown[]; plays: Array<{ play: unknown }> };

    expect(fixture.games.flatMap(validateGameDocument)).toEqual([]);
    expect(fixture.players.flatMap(validatePlayerDocument)).toEqual([]);
    const category = decodePlayDocument(fixture.plays[1].play);
    expect(category.players[0].categories?.flowers).toEqual(new Decimal("0.1"));
    expect(category.players[0].categories?.paths).toEqual(new Decimal("0.2"));
    expect(category.players[0].total?.toFixed()).toBe("4");
    expect(category.players[0]).toMatchObject({ totalIsOverridden: true, rank: 1, rankIsOverridden: true });
    expect(encodePlayDocument(category)).toEqual(fixture.plays[1].play);
  });

  it("round-trips a golden evaluation through the server-safe wire codec", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../../golden/cases/exact-decimal-arithmetic.json", import.meta.url), "utf8"),
    ) as { input: unknown };
    const before = evaluate(decodePlayDocument(fixture.input));
    const after = evaluate(decodePlayDocument(encodePlayDocument(decodePlayDocument(fixture.input))));
    expect(after).toEqual(before);
  });
});

