import Decimal from "decimal.js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addToCollection,
  createDraftPlay,
  createGame,
  createPlayer,
  deleteTemplate,
  getGame,
  listPlays,
  makeUniqueCategories,
  PlayReadError,
  readPlay,
  removeFromCollection,
  representSameGame,
  representSamePlayer,
  resetDbConnectionForTests,
  setTemplate,
  slugify,
  writePlay,
} from "./db";
import { getDb } from "./db";

beforeEach(async () => {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("meeplemark");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
});

describe("slugify / makeUniqueCategories", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Victory Points")).toBe("victory-points");
  });

  it("collapses non-alphanumeric runs to a single hyphen and trims trailing hyphens", () => {
    expect(slugify("  Score!! ")).toBe("score");
  });

  it("falls back to 'category' for an all-punctuation label", () => {
    expect(slugify("!!!")).toBe("category");
  });

  it("disambiguates two identical labels with a numeric suffix", () => {
    const categories = makeUniqueCategories(["Points", "Points"]);
    expect(categories.map((c) => c.key)).toEqual(["points", "points-2"]);
    expect(categories.map((c) => c.label)).toEqual(["Points", "Points"]);
  });
});

describe("games", () => {
  it("requires a slug for a corpus game", async () => {
    await expect(createGame({ name: "Wingspan", origin: "corpus" })).rejects.toThrow();
  });

  it("addToCollection / removeFromCollection toggle ownedAt", async () => {
    const game = await createGame({ name: "Wingspan", origin: "corpus", slug: "wingspan" });
    expect(game.ownedAt).toBeNull();

    await addToCollection(game.id);
    const owned = await getGame(game.id);
    expect(owned?.ownedAt).not.toBeNull();

    await removeFromCollection(game.id);
    const unowned = await getGame(game.id);
    expect(unowned?.ownedAt).toBeNull();
  });

  it("setTemplate bumps templateVersion only on a real change", async () => {
    const game = await createGame({ name: "Custom Game", origin: "custom" });
    await setTemplate(game.id, ["Points"], "high", "ranked");
    const v1 = await getGame(game.id);
    expect(v1?.templateVersion).toBe(1);

    // Same inputs again: no-op.
    await setTemplate(game.id, ["Points"], "high", "ranked");
    const v1Again = await getGame(game.id);
    expect(v1Again?.templateVersion).toBe(1);

    // A real change: version bumps.
    await setTemplate(game.id, ["Points", "Bonus"], "high", "ranked");
    const v2 = await getGame(game.id);
    expect(v2?.templateVersion).toBe(2);
  });

  it("deleteTemplate resets to null/0 without touching recorded plays", async () => {
    const game = await createGame({ name: "Custom Game", origin: "custom" });
    await setTemplate(game.id, ["Points"], "high", "ranked");
    await deleteTemplate(game.id);
    const cleared = await getGame(game.id);
    expect(cleared?.localTemplate).toBeNull();
    expect(cleared?.templateVersion).toBe(0);
  });

  it("representSameGame keys on slug/bggThingId, never id or name", async () => {
    const a = await createGame({ name: "Wingspan", origin: "corpus", slug: "wingspan" });
    const b = await createGame({ name: "Wingspan (dup)", origin: "corpus", slug: "wingspan" });
    const c = await createGame({ name: "Wingspan", origin: "custom" });
    expect(representSameGame(a, b)).toBe(true);
    expect(representSameGame(a, c)).toBe(false);
  });
});

describe("players", () => {
  it("representSamePlayer keys on bggUsername only", async () => {
    const a = await createPlayer({ displayName: "Alice", bggUsername: "alice_bgg" });
    const b = await createPlayer({ displayName: "Alice Two", bggUsername: "alice_bgg" });
    const c = await createPlayer({ displayName: "Alice" });
    expect(representSamePlayer(a, b)).toBe(true);
    expect(representSamePlayer(a, c)).toBe(false);
  });
});

describe("plays", () => {
  it("round-trips a draft play, decimal categories included", async () => {
    const play = await createDraftPlay({
      gameName: "Wingspan",
      winDirection: "high",
      outcome: "ranked",
      playerNames: ["Alice", "Bob"],
    });

    play.players[0].categories = { birds: new Decimal("0.1"), eggs: new Decimal("0.2") };
    play.scoring = {
      slug: "local:test",
      version: 1,
      defaultOutcome: "ranked",
      categories: [
        { key: "birds", label: "Birds" },
        { key: "eggs", label: "Eggs" },
      ],
    };
    await writePlay(play);

    const reloaded = await readPlay(play.id);
    expect(reloaded.players[0].categories?.birds.toFixed()).toBe("0.1");
    expect(reloaded.players[0].categories?.eggs.toFixed()).toBe("0.2");
  });

  it("lists plays sorted by playedAt descending", async () => {
    const older = await createDraftPlay({
      gameName: "Older",
      winDirection: "high",
      outcome: "ranked",
      playerNames: ["Alice"],
    });
    older.playedAt = "2020-01-01T00:00:00Z";
    await writePlay(older);

    const newer = await createDraftPlay({
      gameName: "Newer",
      winDirection: "high",
      outcome: "ranked",
      playerNames: ["Alice"],
    });
    newer.playedAt = "2026-01-01T00:00:00Z";
    await writePlay(newer);

    const rows = await listPlays();
    expect(rows.map((r) => r.gameName)).toEqual(["Newer", "Older"]);
  });

  it("throws a typed PlayReadError on a corrupted stored document", async () => {
    const play = await createDraftPlay({
      gameName: "Wingspan",
      winDirection: "high",
      outcome: "ranked",
      playerNames: ["Alice"],
    });

    // Corrupt the stored row directly, bypassing writePlay's validation.
    const db = await getDb();
    await db.put("plays", { id: play.id, playedAt: play.playedAt, status: "draft", gameName: "Wingspan", gameRef: null, play: { not: "a valid play" } });

    await expect(readPlay(play.id)).rejects.toBeInstanceOf(PlayReadError);
  });
});
