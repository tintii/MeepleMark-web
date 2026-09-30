import type { Template } from "../engine/models";
import { TemplateValidation } from "../engine/validation";

export const MAX_SCORE_SHEET_FILE_BYTES = 64 * 1024;

export class ScoreSheetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreSheetImportError";
  }
}

export function serializeScoreSheet(template: Template): string {
  return `${JSON.stringify(template, null, 2)}\n`;
}

export function parseScoreSheet(text: string): Template {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ScoreSheetImportError("The selected file is not valid JSON.");
  }

  const issues = TemplateValidation.validate(value);
  if (issues.length > 0) {
    throw new ScoreSheetImportError(issues.map((issue) => `${issue.path || "score sheet"}: ${issue.message}`).join("; "));
  }
  return value as Template;
}

export async function readScoreSheetFile(file: Pick<File, "size" | "text">): Promise<Template> {
  if (file.size > MAX_SCORE_SHEET_FILE_BYTES) {
    throw new ScoreSheetImportError("The score sheet file must be 64 KiB or smaller.");
  }
  try {
    return parseScoreSheet(await file.text());
  } catch (error) {
    if (error instanceof ScoreSheetImportError) throw error;
    throw new ScoreSheetImportError("The score sheet file could not be read.");
  }
}

export function scoreSheetFilename(gameName: string): string {
  const base = gameName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "game";
  return `${base}-score-sheet.json`;
}
