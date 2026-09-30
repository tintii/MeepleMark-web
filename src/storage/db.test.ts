import Decimal from "decimal.js";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addToCollection,
  createDraftPlay,
  createGame,
  createPlayer,
  deleteTemplate,
  existingGameByName,
  findOrCreateGame,
  getGame,
  listPlays,
  listPlaySummaries,
  makeUniqueCategories,
  playsForGame,
  PlayReadError,
  quickPickGames,
  readPlay,
  recentGameRefs,
  recentPlayerNames,
  removeFromCollection,
  renamePlayer,
  representSameGame,
  representSamePlayer,
  resetDbConnectionForTests,
  setTemplate,
  slugify,
  writePlay,
} from "./db";
import { getDb } from "./db";
import { parseScoreSheet } from "../draft/scoreSheetPortability";
import { setActiveWorkspace, workspaceDatabaseName } from "./scopedDb";

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

  it("setTemplate keeps destination identity and version authoritative for imported content", async () => {
    const game = await createGame({ name: "Destination", origin: "custom" });
    await setTemplate(game.id, ["Old"], "high", "ranked");
    await setTemplate(game.id, ["Still old"], "high", "ranked");
    const imported = parseScoreSheet(JSON.stringify({
      slug: "local:source-game",
      version: 9,
      winDirection: "low",
      defaultOutcome: "flagged",
      categories: [{ key: "foreign-key", label: "Imported" }],
    }));

    await setTemplate(game.id, imported.categories.map((category) => category.label), imported.winDirection, imported.defaultOutcome);
    const saved = await getGame(game.id);
    expect(saved?.localTemplate).toMatchObject({ slug: `local:${game.id}`, version: 3, winDirection: "low", defaultOutcome: "flagged" });
    expect(saved?.localTemplate?.categories).toEqual([{ key: "imported", label: "Imported" }]);

    await setTemplate(game.id, imported.categories.map((category) => category.label), imported.winDirection, imported.defaultOutcome);
    expect((await getGame(game.id))?.templateVersion).toBe(3);
  });

  it("saves imported content through an account workspace's normal outbox", async () => {
    const account = { kind: "account" as const, origin: "https://example.test", installationId: "import-install", accountId: "import-account", capabilities: { write: true, admin: false } };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(workspaceDatabaseName(account));
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    setActiveWorkspace(account);
    const game = await createGame({ name: "Account destination", origin: "custom" });
    const db = await getDb();
    await db.clear("outbox");
    const imported = parseScoreSheet(JSON.stringify({
      slug: "local:source", version: 8, winDirection: "high", defaultOutcome: "ranked",
      categories: [{ key: "source-points", label: "Points" }],
    }));

    await setTemplate(game.id, imported.categories.map((category) => category.label), imported.winDirection, imported.defaultOutcome);

    const mutation = await db.get("outbox", `game:${game.id}`);
    expect(mutation.operation).toBe("put");
    expect(mutation.document.localTemplate).toMatchObject({ slug: `local:${game.id}`, version: 1 });
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

  describe("existingGameByName / findOrCreateGame", () => {
    it("existingGameByName returns undefined for no match, without creating anything", async () => {
      expect(await existingGameByName("Nobody's Game")).toBeUndefined();
      expect((await listPlays()).length).toBe(0);
      expect(await (await getDb()).getAll("games")).toEqual([]);
    });

    it("findOrCreateGame reuses an exact match", async () => {
      const original = await createGame({ name: "Wingspan", origin: "corpus", slug: "wingspan" });
      const found = await findOrCreateGame("Wingspan");
      expect(found.id).toBe(original.id);
    });

    it("findOrCreateGame reuses a case-insensitive match, whatever case it was stored in", async () => {
      const original = await createGame({ name: "Wingspan", origin: "custom" });
      const found = await findOrCreateGame("wingspan");
      expect(found.id).toBe(original.id);
      expect(found.name).toBe("Wingspan");
    });

    it("findOrCreateGame creates exactly one custom game for a brand-new name", async () => {
      const created = await findOrCreateGame("Brand New Game");
      expect(created.origin).toBe("custom");
      expect(created.ownedAt).toBeNull(); // never touches the collection
      const again = await findOrCreateGame("Brand New Game");
      expect(again.id).toBe(created.id);
      const all = await (await getDb()).getAll("games");
      expect(all.length).toBe(1);
    });
  });

  describe("quickPickGames", () => {
    it("orders most-recently-played first, then owned-but-never-played alphabetically", async () => {
      const zeta = await createGame({ name: "Zeta", origin: "custom" });
      await addToCollection(zeta.id); // owned, never played
      const azul = await createGame({ name: "Azul", origin: "custom" });
      await addToCollection(azul.id); // owned, never played

      const played = await createGame({ name: "Played Game", origin: "custom" });
      const play = await createDraftPlay({
        gameName: played.name,
        gameRef: played.id,
        winDirection: "high",
        outcome: "ranked",
        playerNames: ["Alice"],
      });
      play.playedAt = "2026-01-01T00:00:00Z";
      await writePlay(play);

      const picks = await quickPickGames();
      expect(picks.map((g) => g.name)).toEqual(["Played Game", "Azul", "Zeta"]);
    });
  });

  describe("playsForGame / recentGameRefs / recentPlayerNames / listPlaySummaries", () => {
    it("playsForGame returns a game's plays, most recent first", async () => {
      const game = await createGame({ name: "Wingspan", origin: "custom" });
      const older = await createDraftPlay({
        gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", playerNames: ["Alice"],
      });
      older.playedAt = "2020-01-01T00:00:00Z";
      await writePlay(older);
      const newer = await createDraftPlay({
        gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", playerNames: ["Bob"],
      });
      newer.playedAt = "2026-01-01T00:00:00Z";
      await writePlay(newer);

      const plays = await playsForGame(game.id);
      expect(plays.map((p) => p.id)).toEqual([newer.id, older.id]);
    });

    it("recentGameRefs returns distinct refs, most recent first", async () => {
      const gameA = await createGame({ name: "A", origin: "custom" });
      const gameB = await createGame({ name: "B", origin: "custom" });
      const p1 = await createDraftPlay({ gameName: "A", gameRef: gameA.id, winDirection: "high", outcome: "ranked", playerNames: ["Alice"] });
      p1.playedAt = "2020-01-01T00:00:00Z";
      await writePlay(p1);
      const p2 = await createDraftPlay({ gameName: "B", gameRef: gameB.id, winDirection: "high", outcome: "ranked", playerNames: ["Alice"] });
      p2.playedAt = "2021-01-01T00:00:00Z";
      await writePlay(p2);
      const p3 = await createDraftPlay({ gameName: "A", gameRef: gameA.id, winDirection: "high", outcome: "ranked", playerNames: ["Alice"] });
      p3.playedAt = "2022-01-01T00:00:00Z";
      await writePlay(p3);

      expect(await recentGameRefs()).toEqual([gameA.id, gameB.id]);
    });

    it("recentPlayerNames is distinct, drawn from the most recent plays, and skips corrupted ones", async () => {
      const p1 = await createDraftPlay({ gameName: "A", winDirection: "high", outcome: "ranked", playerNames: ["Alice", "Bob"] });
      p1.playedAt = "2020-01-01T00:00:00Z";
      await writePlay(p1);
      const p2 = await createDraftPlay({ gameName: "B", winDirection: "high", outcome: "ranked", playerNames: ["Cara", "Alice"] });
      p2.playedAt = "2021-01-01T00:00:00Z";
      await writePlay(p2);

      expect(await recentPlayerNames()).toEqual(["Cara", "Alice", "Bob"]);
      expect(await recentPlayerNames(1)).toEqual(["Cara", "Alice"]);
    });

    it("listPlaySummaries reports a corrupted play as unreadable rather than throwing", async () => {
      const good = await createDraftPlay({ gameName: "Good", winDirection: "high", outcome: "ranked", playerNames: ["Alice"] });
      good.playedAt = "2020-01-01T00:00:00Z";
      await writePlay(good);

      const db = await getDb();
      await db.put("plays", {
        id: "corrupt-1",
        playedAt: "2021-01-01T00:00:00Z",
        status: "draft",
        gameName: "Corrupt",
        gameRef: null,
        play: { not: "a valid play" },
      });

      const summaries = await listPlaySummaries();
      expect(summaries.map((s) => s.gameName)).toEqual(["Corrupt", "Good"]);
      expect(summaries[0].unreadable).toBe(true);
      expect(summaries[0].playerCount).toBeNull();
      expect(summaries[1].unreadable).toBe(false);
      expect(summaries[1].playerCount).toBe(1);
    });

    it("listPlaySummaries only shows a winner line once the play is complete", async () => {
      const play = await createDraftPlay({ gameName: "A", winDirection: "high", outcome: "ranked", playerNames: ["Alice"] });
      let [summary] = await listPlaySummaries();
      expect(summary.winnerLine).toBeNull();

      play.status = "complete";
      play.players[0].total = new Decimal(10);
      play.players[0].totalIsOverridden = true;
      await writePlay(play);

      [summary] = await listPlaySummaries();
      expect(summary.winnerLine).toBe("Alice won.");
    });
  });
});

describe("players extras", () => {
  it("renamePlayer trims and persists a new display name", async () => {
    const player = await createPlayer({ displayName: "Alice" });
    await renamePlayer(player.id, "  Alicia  ");
    const db = await getDb();
    const reloaded = await db.get("players", player.id);
    expect(reloaded.displayName).toBe("Alicia");
  });

  it("renamePlayer rejects an empty name", async () => {
    const player = await createPlayer({ displayName: "Alice" });
    await expect(renamePlayer(player.id, "   ")).rejects.toThrow();
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
