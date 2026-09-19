import Decimal from "decimal.js";

// Ported from Engine/Sources/MeepleNMarkEngine/DecimalCoding.swift.
//
// The play and template JSON Schemas require every score value to be a
// decimal-formatted string ("8.5", never 8.5) so values round-trip
// identically across Swift, Python, and this TS port. These are the single
// place string <-> Decimal conversion happens on the web side.

// Matches the Swift regex exactly: optional leading '-', 1+ digits, an
// optional '.' followed by 1+ digits. No exponents, no '+', no whitespace,
// no bare ".5" or "8.".
const DECIMAL_STRING_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;

/** Parses a base-10 decimal string exactly, or returns null. */
export function decimalFromString(value: string): Decimal | null {
  if (!DECIMAL_STRING_PATTERN.test(value)) return null;
  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}

/**
 * The canonical string form of a decimal value for JSON serialisation.
 * `toFixed()` with no arguments returns full precision without ever
 * switching to exponential notation — the web equivalent of Swift's
 * `Decimal.description`, which also never emits exponents.
 */
export function decimalToString(value: Decimal): string {
  return value.toFixed();
}
