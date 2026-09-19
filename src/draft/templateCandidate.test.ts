import { describe, expect, it } from "vitest";
import { buildTemplateCandidate } from "./templateCandidate";
import { TemplateValidation } from "../engine/validation";

// Validation wiring: the template editor's pre-save check builds this
// candidate and runs it through TemplateValidation before ever calling
// setTemplate. These tests exercise that same path.

describe("buildTemplateCandidate + TemplateValidation", () => {
  it("a valid set of labels passes validation", () => {
    const candidate = buildTemplateCandidate("game-1", 0, ["Birds", "Eggs"], "high", "ranked");
    expect(TemplateValidation.validate(candidate)).toEqual([]);
    expect(candidate.version).toBe(1);
  });

  it("drops blank labels before validating", () => {
    const candidate = buildTemplateCandidate("game-1", 0, ["Birds", "  ", ""], "high", "ranked");
    expect(candidate.categories.map((c) => c.label)).toEqual(["Birds"]);
  });

  it("flags no categories at all", () => {
    const candidate = buildTemplateCandidate("game-1", 0, ["", "  "], "high", "ranked");
    const issues = TemplateValidation.validate(candidate);
    expect(issues.some((i) => i.message.includes("at least one category"))).toBe(true);
  });

  it("flags more than 10 categories", () => {
    const labels = Array.from({ length: 11 }, (_, i) => `Category ${i}`);
    const candidate = buildTemplateCandidate("game-1", 0, labels, "high", "ranked");
    const issues = TemplateValidation.validate(candidate);
    expect(issues.some((i) => i.message.includes("at most 10"))).toBe(true);
  });

  it("increments version off the existing template's version", () => {
    const candidate = buildTemplateCandidate("game-1", 3, ["Birds"], "high", "ranked");
    expect(candidate.version).toBe(4);
  });
});
