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
  sm: 4,
  md: 8,
  lg: 16,
  pill: 9999,
} as const;

// --- Semantic colours (Color/SemanticColors.swift) ---
// Each has a light and dark hex value; component code that needs a
// concrete value (rather than the CSS custom property) should prefer
// `var(--color-x)` in stylesheets. These are provided for non-CSS contexts
// (e.g. canvas, computed contrast checks).
export const SemanticColors = {
  surfaceBase: { light: "#FAFAFA", dark: "#121214" },
  surfaceElevated: { light: "#FFFFFF", dark: "#1E1E22" },
  textPrimary: { light: "#141414", dark: "#F2F2F2" },
  textSecondary: { light: "#5C5C63", dark: "#A8A8B0" },
  border: { light: "#E0E0E5", dark: "#38383E" },
  scoreEmphasis: { light: "#8A6A1E", dark: "#E0C070" },
  warning: { light: "#9A5B00", dark: "#F2B84B" },
} as const;

// --- Player palette (Color/PlayerPalette.swift), in cycle order ---
// index % 8 is the documented overflow rule for a play with more players
// than the palette defines (PlayerPalette.color(forPlayerIndex:)).
export interface AccentPair {
  fill: string;
  foreground: string;
}

export const PlayerPalette: AccentPair[] = [
  { fill: "#EF9FA8", foreground: "#141414" }, // player1CoralRed
  { fill: "#F29306", foreground: "#141414" }, // player2Amber
  { fill: "#23A548", foreground: "#141414" }, // player3MeadowGreen
  { fill: "#1FAEAE", foreground: "#141414" }, // player4Teal
  { fill: "#1C71C1", foreground: "#FAFAFA" }, // player5SkyBlue
  { fill: "#7735B8", foreground: "#FAFAFA" }, // player6GrapePurple
  { fill: "#DE42A0", foreground: "#141414" }, // player7HotPink
  { fill: "#303B59", foreground: "#FAFAFA" }, // player8SlateNavy
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
  displayLarge: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
  title: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
  body: { fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
  caption: { fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
  tableNumeral: { fontSize: 16, fontWeight: 600, lineHeight: 1.3, usesTabularFigures: true },
  tableLabel: { fontSize: 14, fontWeight: 500, lineHeight: 1.3 },
} as const;
