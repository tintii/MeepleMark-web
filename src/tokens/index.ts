/**
 * Design tokens as named TS constants, mirroring src/styles/tokens.css.
 * Component code should import from here rather than hardcoding a literal
 * spacing/radius number or colour hex string — same "no literals in view
 * code, tokens only" discipline the Swift DesignTokens package enforces,
 * just without an automated checker on the web side. See src/tokens/README.md.
 */

// --- Spacing (Layout/Scales.swift Spacing), px ---
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// --- Corner radius (Layout/Scales.swift CornerRadius), px ---
export const CornerRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 20,
  pill: 9999,
} as const;

// --- Semantic colours (Color/SemanticColors.swift) ---
// Each has a light and dark hex value; component code that needs a
// concrete value (rather than the CSS custom property) should prefer
// `var(--color-x)` in stylesheets. These are provided for non-CSS contexts
// (e.g. canvas, computed contrast checks).
export const SemanticColors = {
  surfaceBase: { light: "#FFF8F2", dark: "#1B1416" },
  surfaceElevated: { light: "#FFFEFC", dark: "#281D20" },
  surfaceRaised: { light: "#FFF2EA", dark: "#35262A" },
  surfaceTint: { light: "#FBE2E6", dark: "#422B32" },
  textPrimary: { light: "#352622", dark: "#FFF6F0" },
  textSecondary: { light: "#705B55", dark: "#CDBBB5" },
  border: { light: "#D9C3BA", dark: "#564147" },
  borderStrong: { light: "#9E7E73", dark: "#9C7882" },
  scoreEmphasis: { light: "#7A5911", dark: "#F0D17F" },
  warning: { light: "#8A5600", dark: "#F3C56B" },
  destructive: { light: "#A2323D", dark: "#FF9BA1" },
  success: { light: "#226B45", dark: "#87D3AA" },
  accent: { light: "#B13F5A", dark: "#F08096" },
  accentForeground: { light: "#FFFFFF", dark: "#2B151A" },
  focus: { light: "#5068B8", dark: "#AFC2FF" },
  navBackground: { light: "#432A27", dark: "#120D0F" },
  navForeground: { light: "#FFF4EA", dark: "#FFF6F0" },
  navMuted: { light: "#DDC4BA", dark: "#CDBBB5" },
} as const;

// --- Player palette (Color/PlayerPalette.swift), in cycle order ---
// index % 8 is the documented overflow rule for a play with more players
// than the palette defines (PlayerPalette.color(forPlayerIndex:)).
export interface AccentPair {
  fill: string;
  foreground: string;
}

export const PlayerPalette: AccentPair[] = [
  { fill: "#F3A6A0", foreground: "#352622" }, // coral
  { fill: "#F6BE7A", foreground: "#352622" }, // apricot
  { fill: "#EBCF6A", foreground: "#352622" }, // butter
  { fill: "#8FD3A5", foreground: "#352622" }, // mint
  { fill: "#83CBD1", foreground: "#352622" }, // aqua
  { fill: "#8FB0E8", foreground: "#352622" }, // periwinkle
  { fill: "#B99ADF", foreground: "#352622" }, // lavender
  { fill: "#E7A4C7", foreground: "#352622" }, // pink
];

export function playerColor(index: number): AccentPair {
  if (index < 0) throw new Error("player index must be non-negative");
  return PlayerPalette[index % PlayerPalette.length];
}

// --- Typography (Typography/TypeScale.swift) ---
// The Swift source only names these styles and requires tabular figures on
// tableNumeral; concrete sizes below are new for this web port (see the
// comment in tokens.css), not ported from anywhere.
export const TypeScale = {
  displayLarge: { fontSize: 28, fontWeight: 800, lineHeight: 1.2 },
  title: { fontSize: 20, fontWeight: 750, lineHeight: 1.3 },
  body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  tableNumeral: { fontSize: 16, fontWeight: 600, lineHeight: 1.3, usesTabularFigures: true },
  tableLabel: { fontSize: 14, fontWeight: 500, lineHeight: 1.3 },
} as const;
