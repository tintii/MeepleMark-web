import { describe, expect, it } from "vitest";
import { PlayerPalette, SemanticColors } from "./index";

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g);
  if (!channels || channels.length !== 3) throw new Error(`Invalid colour: ${hex}`);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("pastel-candy theme contrast", () => {
  it.each(["light", "dark"] as const)("keeps %s semantic text pairs at WCAG AA", (appearance) => {
    const pairs = [
      [SemanticColors.surfaceBase[appearance], SemanticColors.textPrimary[appearance]],
      [SemanticColors.surfaceBase[appearance], SemanticColors.textSecondary[appearance]],
      [SemanticColors.surfaceElevated[appearance], SemanticColors.textPrimary[appearance]],
      [SemanticColors.accent[appearance], SemanticColors.accentForeground[appearance]],
      [SemanticColors.navBackground[appearance], SemanticColors.navForeground[appearance]],
      [SemanticColors.surfaceBase[appearance], SemanticColors.focus[appearance]],
    ];

    for (const [background, foreground] of pairs) {
      expect(contrast(background, foreground), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every player marker foreground at WCAG AA", () => {
    for (const { fill, foreground } of PlayerPalette) {
      expect(contrast(fill, foreground), `${foreground} on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
