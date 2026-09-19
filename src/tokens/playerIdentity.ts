// Ported from DesignTokens/Sources/MeepleNMarkDesignTokens/Accessibility/PlayerIdentity.swift.
//
// Every representation of a player must carry a non-colour channel — a
// short text marker, here — so a score grid stays readable in greyscale. A
// single name's initial is not, by itself, enough: two players can share a
// first letter, so the marker is assigned across the whole roster and
// disambiguated on collision, never derived from one name in isolation.

export interface PlayerIdentity {
  name: string;
  marker: string;
  colorIndex: number;
}

/**
 * Builds markers for an entire roster in one pass, so collisions between
 * players (not just within one name) can be disambiguated. Empty names are
 * skipped. Colours cycle via `playerColor(index)` — the documented overflow
 * rule — but marker uniqueness never depends on colour.
 *
 * `preferredColorIndices`, when given, must be the same length as `names`;
 * an entry is that player's stored colour preference. A preference is
 * honoured unless an earlier player in this same roster already claimed
 * that index — colour never becomes load-bearing, so the later player
 * simply falls back to the ordinary roster-index assignment rather than the
 * preference being refused outright.
 */
export function assignRoster(
  names: string[],
  preferredColorIndices: (number | null)[] = [],
): PlayerIdentity[] {
  const usedMarkers = new Set<string>();
  const usedColorIndices = new Set<number>();
  const identities: PlayerIdentity[] = [];

  names.forEach((name, index) => {
    const first = name.charAt(0);
    if (first === "") return; // empty names are skipped

    let marker = first.toUpperCase();
    if (usedMarkers.has(marker)) {
      // Disambiguate by growing the prefix first ("Sa" vs "St"), then by
      // appending a running count as a last resort.
      let prefixLength = 2;
      while (prefixLength <= name.length && usedMarkers.has(marker)) {
        marker = name.slice(0, prefixLength).toUpperCase();
        prefixLength += 1;
      }
      let suffix = 2;
      while (usedMarkers.has(marker)) {
        marker = first.toUpperCase() + String(suffix);
        suffix += 1;
      }
    }
    usedMarkers.add(marker);

    const preferred = index < preferredColorIndices.length ? preferredColorIndices[index] : null;
    let colorIndex: number;
    if (preferred != null && !usedColorIndices.has(preferred)) {
      colorIndex = preferred;
    } else if (!usedColorIndices.has(index)) {
      colorIndex = index;
    } else {
      // This player's own roster index was already taken by an earlier
      // player's preference, so fall through to the first index nobody has
      // claimed.
      let candidate = 0;
      while (usedColorIndices.has(candidate)) candidate += 1;
      colorIndex = candidate;
    }
    usedColorIndices.add(colorIndex);

    identities.push({ name, marker, colorIndex });
  });

  return identities;
}

/**
 * True only if every player's marker is unique — assignRoster guarantees
 * this on its own, so this really just asserts that guarantee held (the
 * greyscale-attributability gate: colour removed, still attributable).
 */
export function isGreyscaleAttributable(players: PlayerIdentity[]): boolean {
  return new Set(players.map((p) => p.marker)).size === players.length;
}
