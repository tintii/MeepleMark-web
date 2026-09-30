import { describe, expect, it, vi } from "vitest";
import type { Template } from "../engine/models";
import {
  MAX_SCORE_SHEET_FILE_BYTES,
  parseScoreSheet,
  readScoreSheetFile,
  scoreSheetFilename,
  serializeScoreSheet,
} from "./scoreSheetPortability";

const template: Template = {
  slug: "local:source-game",
  version: 9,
  winDirection: "low",
  defaultOutcome: "flagged",
  categories: [
    { key: "flowers", label: "Flowers" },
    { key: "paths", label: "Paths" },
  ],
};

describe("score-sheet JSON portability", () => {
  it("round-trips every standalone template field as readable JSON", () => {
    const text = serializeScoreSheet(template);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "version": 9');
    expect(parseScoreSheet(text)).toEqual(template);
  });

  it.each([
    ["malformed JSON", "{"],
    ["a non-object", "[]"],
    ["an unknown field", JSON.stringify({ ...template, formula: "x2" })],
    ["duplicate category keys", JSON.stringify({ ...template, categories: [{ key: "x", label: "One" }, { key: "x", label: "Two" }] })],
    ["an empty label", JSON.stringify({ ...template, categories: [{ key: "x", label: "" }] })],
    ["more than ten categories", JSON.stringify({ ...template, categories: Array.from({ length: 11 }, (_, i) => ({ key: `c${i}`, label: `Category ${i}` })) })],
  ])("rejects %s", (_name, text) => {
    expect(() => parseScoreSheet(text)).toThrow();
  });

  it("rejects an oversized file before reading it", async () => {
    const text = vi.fn<() => Promise<string>>();
    await expect(readScoreSheetFile({ size: MAX_SCORE_SHEET_FILE_BYTES + 1, text })).rejects.toThrow("64 KiB");
    expect(text).not.toHaveBeenCalled();
  });

  it("reports an unreadable file", async () => {
    await expect(readScoreSheetFile({ size: 1, text: async () => { throw new Error("read failed"); } })).rejects.toThrow("could not be read");
  });

  it("creates a safe, recognizable filename", () => {
    expect(scoreSheetFilename("Café: Cats / Dogs")).toBe("cafe-cats-dogs-score-sheet.json");
    expect(scoreSheetFilename("!!!")).toBe("game-score-sheet.json");
  });
});
