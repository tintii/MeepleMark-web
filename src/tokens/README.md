# Token convention

Component code (`.tsx`/`.css`) never hardcodes a spacing number, corner
radius, or colour hex literal. Use:

- CSS: the custom properties in `src/styles/tokens.css` (`var(--spacing-md)`,
  `var(--color-text-primary)`, etc).
- TS (non-CSS contexts — canvas, computed values): the named constants in
  `src/tokens/index.ts` (`Spacing.md`, `SemanticColors.textPrimary`, etc).

This mirrors the Swift `DesignTokens` package's "no raw literals in view
code" rule. There is no automated checker for it here (the Swift package
enforces it with closed enums); this is a discipline, not a guarantee.
