import { openDB, type IDBPDatabase } from "idb";
import type { Category, OutcomeMode, Play, PlayStatus, Template, WinDirection } from "../engine/models";
import { decodePlay, encodePlay } from "../engine/models";
import { PlayValidation, type ValidationIssue } from "../engine/validation";
import { evaluate } from "../engine/evaluate";
import { winnerSummarySentence } from "../engine/winnerSummary";

// Storage, deliberately simplified relative to the Swift Persistence
// package. Reads for shape from Game.swift / PlayRecord.swift / Player.swift
// but drops the SwiftData-only indirection (e.g. `templateJSON` as a
// JSON-string column) — this stores plain nested objects directly, since
// IndexedDB (via `idb`) has no such constraint.

const DB_NAME = "meeplemark";
const DB_VERSION = 1;

export type GameOrigin = "corpus" | "bgg" | "custom";

/** A shared fact ("Wingspan is Wingspan for everyone"), not scoped to a user. */
export interface GameRecord {
  id: string;
  name: string;
  slug: string | null;
  bggThingId: string | null;
  origin: GameOrigin;
  /** Presence means "in the collection" — mirrors Game.swift's `isOwned`. */
  ownedAt: string | null;
  /** A locally authored category set, or null if never authored. */
  localTemplate: Template | null;
  /** 0 means "never authored". */
  templateVersion: number;
}

/** A local address-book entry, not an identity. */
export interface PlayerRecord {
  id: string;
  displayName: string;
  bggUsername: string | null;
  preferredColorIndex: number | null;
}

/** The stored shape for a play: indexed columns plus the full document. */
interface PlayRow {
  id: string;
  playedAt: string;
  status: PlayStatus;
  gameName: string;
  gameRef: string | null;
  /** Wire-shaped: decimal strings, not Decimal instances (structured-clone safe). */
  play: unknown;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "id" });
        if (!db.objectStoreNames.contains("players")) db.createObjectStore("players", { keyPath: "id" });
        if (!db.objectStoreNames.contains("plays")) db.createObjectStore("plays", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/** Test-only: closes and forgets the current connection, so a fresh test can delete the database. */
export async function resetDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

// --- Plays ---

/**
 * `PlayerScore.encode()` omits `rank`/`win` entirely when null, but the play
 * schema requires that key be *present* (its value may still be null)
 * whenever `outcome` requires it — see PlayRecord.swift's
 * `schemaCompliantJSON` comment. A player who hasn't been ranked/flagged
 * yet is the ordinary case while a play is still being scored, and would
 * otherwise round-trip as "corrupted" on every read. This patches the
 * encoded JSON to add the key back as an explicit null before storage.
 */
function schemaCompliantJSON(play: Play): Record<string, unknown> {
  const encoded = encodePlay(play);
  const players = encoded.players as Record<string, unknown>[];
  const requiredKey = play.outcome === "ranked" ? "rank" : play.outcome === "flagged" ? "win" : null;
  if (requiredKey) {
    for (const player of players) {
      if (!(requiredKey in player)) player[requiredKey] = null;
    }
  }
  return encoded;
}

export class PlayReadError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(`stored play failed validation: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
    this.issues = issues;
  }
}

/** Validates against PlayValidation on read; throws PlayReadError on corruption. */
export async function readPlay(id: string): Promise<Play> {
  const db = await getDb();
  const row = (await db.get("plays", id)) as PlayRow | undefined;
  if (!row) throw new Error(`no play with id '${id}'`);
  const issues = PlayValidation.validate(row.play);
  if (issues.length > 0) throw new PlayReadError(issues);
  return decodePlay(row.play);
}

/** Validates before writing, so a corrupt document is never persisted. */
export async function writePlay(play: Play): Promise<void> {
  const db = await getDb();
  const encoded = schemaCompliantJSON(play);
  const issues = PlayValidation.validate(encoded);
  if (issues.length > 0) throw new PlayReadError(issues);

  const row: PlayRow = {
    id: play.id,
    playedAt: play.playedAt,
    status: play.status,
    gameName: play.gameName,
    gameRef: play.gameRef,
    play: encoded,
  };
  await db.put("plays", row);
}

/** All plays, sorted by playedAt descending (most recent first). */
export async function listPlays(): Promise<PlayRow[]> {
  const db = await getDb();
  const rows = (await db.getAll("plays")) as PlayRow[];
  return rows.sort((a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : 0));
}

/**
 * A row-ready summary of a play: what the play list and a game's play
 * history both need to render one row, including the winner line (only
 * ever populated for a `complete` play — see WinnerRow.swift's rule that a
 * draft never claims a result). `playerCount`/`winnerLine` are `null` and
 * `unreadable` is `true` when the stored document fails to decode — this
 * mirrors PlayRowView.swift's "Unreadable" row rather than throwing, since
 * one corrupted play must never take down the whole list.
 */
export interface PlaySummary {
  id: string;
  gameName: string;
  playedAt: string;
  status: PlayStatus;
  playerCount: number | null;
  winnerLine: string | null;
  unreadable: boolean;
}

function summaryFromPlay(play: Play): PlaySummary {
  const winnerLine = play.status === "complete" ? winnerSummarySentence(evaluate(play), play.outcome) : null;
  return {
    id: play.id,
    gameName: play.gameName,
    playedAt: play.playedAt,
    status: play.status,
    playerCount: play.players.length,
    winnerLine,
    unreadable: false,
  };
}

function unreadableSummary(row: PlayRow): PlaySummary {
  return {
    id: row.id,
    gameName: row.gameName,
    playedAt: row.playedAt,
    status: row.status,
    playerCount: null,
    winnerLine: null,
    unreadable: true,
  };
}

/** Every play as a row-ready summary, most recent first. */
export async function listPlaySummaries(): Promise<PlaySummary[]> {
  const rows = await listPlays();
  return rows.map((row) => {
    try {
      return summaryFromPlay(decodePlay(row.play));
    } catch {
      return unreadableSummary(row);
    }
  });
}

/**
 * A game's plays, most recent first — a filter over `listPlays()`, not a
 * stored relationship (mirrors `PlayQuery.plays(forGame:)`). A play that
 * fails to decode is skipped rather than thrown: this is a listing
 * surface, not a read path that must surface corruption.
 */
export async function playsForGame(gameRef: string): Promise<Play[]> {
  const rows = (await listPlays()).filter((row) => row.gameRef === gameRef);
  const plays: Play[] = [];
  for (const row of rows) {
    try {
      plays.push(decodePlay(row.play));
    } catch {
      // skip — see the doc comment above.
    }
  }
  return plays;
}

/**
 * Distinct `gameRef` values from plays, most-recent-`playedAt` first.
 * Mirrors `PlayQuery.recentGameRefs`.
 */
export async function recentGameRefs(): Promise<string[]> {
  const rows = await listPlays(); // already sorted descending by playedAt
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of rows) {
    if (!row.gameRef || seen.has(row.gameRef)) continue;
    seen.add(row.gameRef);
    ordered.push(row.gameRef);
  }
  return ordered;
}

/**
 * Distinct player names drawn from the `limit` most recent plays' decoded
 * documents. A suggestion list, not a read path that must surface
 * corruption — a play that fails to decode is skipped rather than thrown
 * (mirrors `PlayQuery.recentPlayerNames`).
 */
export async function recentPlayerNames(limit = 20): Promise<string[]> {
  const rows = (await listPlays()).slice(0, limit);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of rows) {
    let play: Play;
    try {
      play = decodePlay(row.play);
    } catch {
      continue;
    }
    for (const player of play.players) {
      if (!seen.has(player.name)) {
        seen.add(player.name);
        names.push(player.name);
      }
    }
  }
  return names;
}

export interface NewPlayInput {
  gameName: string;
  gameRef?: string | null;
  winDirection: WinDirection;
  outcome: OutcomeMode;
  playerNames: string[];
}

/** Creates and persists a new draft play — plain mode only (no template). */
export async function createDraftPlay(input: NewPlayInput): Promise<Play> {
  const play: Play = {
    id: crypto.randomUUID(),
    playedAt: new Date().toISOString(),
    status: "draft",
    gameName: input.gameName,
    gameRef: input.gameRef ?? null,
    winDirection: input.winDirection,
    outcome: input.outcome,
    scoring: null,
    players: input.playerNames.map((name) => ({
      name,
      playerRef: null,
      categories: null,
      total: null,
      totalIsOverridden: false,
      rank: null,
      rankIsOverridden: false,
      win: null,
    })),
    notes: null,
  };
  await writePlay(play);
  return play;
}

// --- Games ---

export async function getGame(id: string): Promise<GameRecord | undefined> {
  const db = await getDb();
  return (await db.get("games", id)) as GameRecord | undefined;
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await getDb();
  return (await db.getAll("games")) as GameRecord[];
}

export interface NewGameInput {
  name: string;
  origin: GameOrigin;
  slug?: string | null;
  bggThingId?: string | null;
}

export async function createGame(input: NewGameInput): Promise<GameRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("name must not be empty");

  switch (input.origin) {
    case "corpus":
      if (!input.slug?.trim()) throw new Error("corpus games require a slug");
      break;
    case "bgg":
      if (!input.bggThingId?.trim()) throw new Error("bgg games require a bggThingId");
      break;
    case "custom":
      if (input.slug || input.bggThingId) throw new Error("custom games permit no external identifier");
      break;
  }

  const game: GameRecord = {
    id: crypto.randomUUID(),
    name,
    slug: input.slug ?? null,
    bggThingId: input.bggThingId ?? null,
    origin: input.origin,
    ownedAt: null,
    localTemplate: null,
    templateVersion: 0,
  };
  const db = await getDb();
  await db.put("games", game);
  return game;
}

/** Adds a game to the collection. Never called by play recording. */
export async function addToCollection(gameId: string): Promise<void> {
  const db = await getDb();
  const game = (await db.get("games", gameId)) as GameRecord | undefined;
  if (!game) throw new Error(`no game with id '${gameId}'`);
  await db.put("games", { ...game, ownedAt: new Date().toISOString() });
}

/** Removes a game from the collection. The Game record and its plays are untouched. */
export async function removeFromCollection(gameId: string): Promise<void> {
  const db = await getDb();
  const game = (await db.get("games", gameId)) as GameRecord | undefined;
  if (!game) throw new Error(`no game with id '${gameId}'`);
  await db.put("games", { ...game, ownedAt: null });
}

/** D3: never a bare corpus-shaped slug, so a future corpus template can be offered alongside it. */
export function localTemplateSlug(gameId: string): string {
  return `local:${gameId}`;
}

function isAlphanumeric(ch: string): boolean {
  return /^[\p{L}\p{N}]$/u.test(ch);
}

/** A stable, lowercase, hyphenated key derived from a category label. Never empty. */
export function slugify(label: string): string {
  let result = "";
  let lastWasSeparator = true;
  for (const ch of label.toLowerCase()) {
    if (isAlphanumeric(ch)) {
      result += ch;
      lastWasSeparator = false;
    } else if (!lastWasSeparator) {
      result += "-";
      lastWasSeparator = true;
    }
  }
  while (result.endsWith("-")) result = result.slice(0, -1);
  return result === "" ? "category" : result;
}

/** Derives unique category keys from user-typed labels, in order. Collisions get a `-2`, `-3`... suffix. */
export function makeUniqueCategories(labels: string[]): Category[] {
  const usedKeys = new Set<string>();
  const categories: Category[] = [];
  for (const label of labels) {
    const base = slugify(label);
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${base}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);
    categories.push({ key, label });
  }
  return categories;
}

function categoriesEqual(a: Category[], b: Category[]): boolean {
  return a.length === b.length && a.every((c, i) => c.key === b[i].key && c.label === b[i].label);
}

/**
 * Authors or edits a game's locally authored category set. Validates 1-10
 * non-empty labels, derives unique slugified keys, and bumps
 * `templateVersion` only on a real change — calling this again with the
 * same inputs is a no-op.
 */
export async function setTemplate(
  gameId: string,
  categoryLabels: string[],
  winDirection: WinDirection,
  defaultOutcome: OutcomeMode,
): Promise<void> {
  const trimmedLabels = categoryLabels.map((label) => label.trim());
  if (trimmedLabels.length === 0) throw new Error("at least one category is required");
  if (trimmedLabels.length > 10) throw new Error("at most 10 categories are allowed");
  if (trimmedLabels.some((label) => label.length === 0)) throw new Error("category labels must not be empty");

  const db = await getDb();
  const game = (await db.get("games", gameId)) as GameRecord | undefined;
  if (!game) throw new Error(`no game with id '${gameId}'`);

  const categories = makeUniqueCategories(trimmedLabels);

  if (
    game.localTemplate &&
    categoriesEqual(game.localTemplate.categories, categories) &&
    game.localTemplate.winDirection === winDirection &&
    game.localTemplate.defaultOutcome === defaultOutcome
  ) {
    return;
  }

  const newVersion = game.templateVersion + 1;
  const template: Template = {
    slug: localTemplateSlug(gameId),
    version: newVersion,
    winDirection,
    defaultOutcome,
    categories,
  };
  await db.put("games", { ...game, localTemplate: template, templateVersion: newVersion });
}

/**
 * Clears the local template entirely. Never touches any already-recorded
 * play — plays hold their own embedded `scoring` snapshot.
 */
export async function deleteTemplate(gameId: string): Promise<void> {
  const db = await getDb();
  const game = (await db.get("games", gameId)) as GameRecord | undefined;
  if (!game) throw new Error(`no game with id '${gameId}'`);
  await db.put("games", { ...game, localTemplate: null, templateVersion: 0 });
}

/**
 * A read-only lookup by typed name, for offering a game's local template
 * (if any) before the play — and therefore the Game row itself — is
 * created. Exact match first, then a case-insensitive scan. Never creates
 * anything: a name nobody has typed before simply has no template to
 * offer. Mirrors `GameQuery.existingGame(named:)`.
 */
export async function existingGameByName(name: string): Promise<GameRecord | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const games = await listGames();
  const exact = games.find((g) => g.name === trimmed);
  if (exact) return exact;
  return games.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
}

/**
 * Ensures a Game exists for a typed name, reusing a trimmed,
 * case-insensitive name match rather than creating a duplicate on every
 * retype. A new name creates exactly one `custom` Game; an existing name
 * is reused as-is, whatever its origin and whatever case it was originally
 * stored in. Never touches the collection — creating or reusing a Game
 * here must not add it to the collection. Mirrors
 * `GameQuery.findOrCreateGame(named:)`.
 */
export async function findOrCreateGame(name: string): Promise<GameRecord> {
  const trimmed = name.trim();
  const existing = await existingGameByName(trimmed);
  if (existing) return existing;
  return createGame({ name: trimmed, origin: "custom" });
}

/**
 * Quick-pick: the union of most-recently-played games (most recent first,
 * de-duplicated) followed by owned-but-never-played games (alphabetical).
 * Mirrors `GameQuery.quickPick`'s ordering exactly.
 */
export async function quickPickGames(): Promise<GameRecord[]> {
  const seen = new Set<string>();
  const ordered: GameRecord[] = [];

  for (const ref of await recentGameRefs()) {
    const game = await getGame(ref);
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    ordered.push(game);
  }

  const neverPlayedOwned = (await listGames())
    .filter((g) => g.ownedAt != null && !seen.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  ordered.push(...neverPlayedOwned);

  return ordered;
}

/** Keys on `slug`/`bggThingId` only — `id` never enters this comparison. */
export function representSameGame(a: GameRecord, b: GameRecord): boolean {
  if (a.slug != null && b.slug != null && a.slug === b.slug) return true;
  if (a.bggThingId != null && b.bggThingId != null && a.bggThingId === b.bggThingId) return true;
  return false;
}

// --- Players ---

export async function getPlayer(id: string): Promise<PlayerRecord | undefined> {
  const db = await getDb();
  return (await db.get("players", id)) as PlayerRecord | undefined;
}

export async function listPlayers(): Promise<PlayerRecord[]> {
  const db = await getDb();
  return (await db.getAll("players")) as PlayerRecord[];
}

export interface NewPlayerInput {
  displayName: string;
  bggUsername?: string | null;
  preferredColorIndex?: number | null;
}

export async function createPlayer(input: NewPlayerInput): Promise<PlayerRecord> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("displayName must not be empty");

  const player: PlayerRecord = {
    id: crypto.randomUUID(),
    displayName,
    bggUsername: input.bggUsername?.trim() || null,
    preferredColorIndex: input.preferredColorIndex ?? null,
  };
  const db = await getDb();
  await db.put("players", player);
  return player;
}

/** Keys on `bggUsername` only — never `id`, never `displayName`. */
export function representSamePlayer(a: PlayerRecord, b: PlayerRecord): boolean {
  if (a.bggUsername == null || b.bggUsername == null) return false;
  return a.bggUsername === b.bggUsername;
}

export async function renamePlayer(id: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("displayName must not be empty");
  const db = await getDb();
  const player = (await db.get("players", id)) as PlayerRecord | undefined;
  if (!player) throw new Error(`no player with id '${id}'`);
  await db.put("players", { ...player, displayName: trimmed });
}
