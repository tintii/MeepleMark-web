import type { PlayerIdentity } from "../tokens/playerIdentity";

/**
 * The colour+letter marker badge for one roster seat (see
 * `assignRoster()`/PlayerIdentity.swift). The letter is the load-bearing,
 * greyscale-safe channel — colour is decoration on top of it, never the
 * only signal.
 */
export function MarkerBadge({ identity }: { identity: PlayerIdentity }) {
  const paletteIndex = (identity.colorIndex % 8) + 1;
  return (
    <span
      className="marker-badge"
      style={{
        background: `var(--color-player-${paletteIndex}-fill)`,
        color: `var(--color-player-${paletteIndex}-foreground)`,
      }}
      aria-hidden="true"
    >
      {identity.marker}
    </span>
  );
}
