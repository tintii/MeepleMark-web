import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type Decimal from "decimal.js";
import { decodePlay } from "./models";
import { evaluate } from "./evaluate";

// Runs every fixture in golden/cases/*.json (copied verbatim from the
// MeepleMark Swift repo's golden corpus — see golden/README.md /
// golden/SOURCE.md) through the ported evaluate(), and checks the result
// against each fixture's `expected` block. This is the correctness gate for
// the whole engine port: golden/cases/*.json is a pinned behavioural
// contract, not something to adjust when a case fails.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const casesDir = path.resolve(__dirname, "../../golden/cases");

interface ExpectedPlayer {
  name: string;
  total: string | null;
  rank: number | null;
  win: boolean | null;
}

interface ExpectedWarning {
  code: string;
  playerNames: string[];
}

interface GoldenCase {
  id: string;
  description: string;
  input: unknown;
  expected: {
    players: ExpectedPlayer[];
    warnings: ExpectedWarning[];
  };
}

function decimalOrNullToString(value: Decimal | null): string | null {
  return value === null ? null : value.toFixed();
}

const files = fs
  .readdirSync(casesDir)
  .filter((name) => name.endsWith(".json"))
  .sort();

describe("golden corpus", () => {
  it("has fixtures to run", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`matches expected output for ${file}`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(casesDir, file), "utf-8")) as GoldenCase;
      const play = decodePlay(raw.input);
      const result = evaluate(play);

      expect(result.players.length).toBe(raw.expected.players.length);
      raw.expected.players.forEach((expectedPlayer, index) => {
        const actual = result.players[index];
        expect(actual.name).toBe(expectedPlayer.name);
        expect(decimalOrNullToString(actual.total)).toBe(expectedPlayer.total);
        expect(actual.rank).toBe(expectedPlayer.rank ?? null);
        expect(actual.win).toBe(expectedPlayer.win ?? null);
      });

      const actualWarnings = result.warnings.map((w) => ({ code: w.code, playerNames: w.playerNames }));
      expect(actualWarnings.length).toBe(raw.expected.warnings.length);
      // Warning order is unspecified per golden/README.md; compare as a set.
      for (const expectedWarning of raw.expected.warnings) {
        expect(actualWarnings).toContainEqual(expectedWarning);
      }
    });
  }

  it("evaluating the same play twice produces identical output", () => {
    const file = files.find((f) => f === "repeated-evaluation.json") ?? files[0];
    const raw = JSON.parse(fs.readFileSync(path.join(casesDir, file), "utf-8")) as GoldenCase;
    const play = decodePlay(raw.input);
    const first = evaluate(play);
    const second = evaluate(play);
    expect(first.players.map((p) => decimalOrNullToString(p.total))).toEqual(
      second.players.map((p) => decimalOrNullToString(p.total)),
    );
    expect(first.players.map((p) => p.rank)).toEqual(second.players.map((p) => p.rank));
    expect(first.warnings).toEqual(second.warnings);
  });
});
