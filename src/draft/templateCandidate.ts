import type { OutcomeMode, WinDirection } from "../engine/models";

// The template editor's pre-save check. Builds the same shape
// `TemplateValidation` (src/engine/validation.ts) expects, from the raw
// labels a user typed, so a bad shape (too many categories, an empty
// label, ...) surfaces inline before `setTemplate` is ever called.
// Category `key`s here are placeholders — `setTemplate` derives the real
// slugified keys itself (see `makeUniqueCategories` in storage/db.ts);
// this candidate only needs *a* non-empty key per category to exercise
// the bounds/emptiness checks that matter for the editor's own feedback.

export interface TemplateCandidate {
  slug: string;
  version: number;
  winDirection: WinDirection;
  defaultOutcome: OutcomeMode;
  categories: { key: string; label: string }[];
}

export function buildTemplateCandidate(
  gameId: string,
  existingVersion: number,
  labels: string[],
  winDirection: WinDirection,
  defaultOutcome: OutcomeMode,
): TemplateCandidate {
  const trimmed = labels.map((l) => l.trim()).filter((l) => l.length > 0);
  return {
    slug: `local:${gameId}`,
    version: existingVersion + 1,
    winDirection,
    defaultOutcome,
    categories: trimmed.map((label, i) => ({ key: `category-${i}`, label })),
  };
}
