import Decimal from "decimal.js";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createDraftPlay,
  createGame,
  createPlayer,
  deletePlay,
  deletePlayer,
  gameSuggestions,
  getDb,
  getGame,
  getPlayer,
  listPlaySummaries,
  playerSuggestions,
  playSummariesForGame,
  readPlay,
  recentUnlinkedGameNames,
  resetDbConnectionForTests,
  setTemplate,
  updatePlayer,
  writePlay,
} from "./db";

beforeEach(async () => {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("meeplemark");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("existing database compatibility", () => {
  it("loads the representative v1 fixture with snapshots, overrides, and nullable references", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../../tests/fixtures/existing-indexeddb.json", import.meta.url), "utf8"),
    ) as { games: unknown[]; players: unknown[]; plays: unknown[] };
    const db = await getDb();
    const tx = db.transaction(["games", "players", "plays"], "readwrite");
    await Promise.all([
      ...fixture.games.map((game) => tx.objectStore("games").put(game)),
      ...fixture.players.map((player) => tx.objectStore("players").put(player)),
      ...fixture.plays.map((play) => tx.objectStore("plays").put(play)),
      tx.done,
    ]);

    const plain = await readPlay("fixture-plain");
    const category = await readPlay("fixture-category");
    expect(plain.scoring).toBeNull();
    expect(plain.gameRef).toBeNull();
    expect(plain.players[0].playerRef).toBeNull();
    expect(category.scoring?.version).toBe(1);
    expect(category.players[0].totalIsOverridden).toBe(true);
    expect(category.players[0].rankIsOverridden).toBe(true);
  });
});

describe("storage parity operations", () => {
  it("deletes one play without changing games, sheets, players, history, or suggestions", async () => {
    const game = await createGame({ name: "Garden", origin: "custom" });
    await setTemplate(game.id, ["Flowers"], "high", "ranked");
    const player = await createPlayer({ displayName: "Avery" });
    const first = await createDraftPlay({ gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", seats: [{ name: "Avery", playerRef: player.id }] });
    const second = await createDraftPlay({ gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", playerNames: ["Guest"] });

    await deletePlay(first.id);

    await expect(readPlay(first.id)).rejects.toThrow("no play");
    expect((await listPlaySummaries()).map((play) => play.id)).toEqual([second.id]);
    expect(await getGame(game.id)).toMatchObject({ id: game.id, localTemplate: { version: 1 } });
    expect(await getPlayer(player.id)).toMatchObject({ id: player.id });
    expect((await playerSuggestions()).map((suggestion) => suggestion.name)).toContain("Guest");
    expect((await playerSuggestions()).map((suggestion) => suggestion.name)).not.toContain("Avery at play");
  });

  it("updates and clears player metadata, validates fields, and deletes without rewriting history", async () => {
    const player = await createPlayer({ displayName: "Avery", bggUsername: "avery", preferredColorIndex: 2 });
    const play = await createDraftPlay({ gameName: "Garden", winDirection: "high", outcome: "ranked", seats: [{ name: "Original Avery", playerRef: player.id }] });
    await updatePlayer(player.id, { displayName: "Avery Two", bggUsername: "", preferredColorIndex: null });
    expect(await getPlayer(player.id)).toMatchObject({ displayName: "Avery Two", bggUsername: null, preferredColorIndex: null });
    await expect(updatePlayer(player.id, { displayName: "  ", preferredColorIndex: null })).rejects.toThrow("display name");
    await expect(updatePlayer(player.id, { displayName: "Avery", preferredColorIndex: 8 })).rejects.toThrow("eight");
    await deletePlayer(player.id);
    expect(await getPlayer(player.id)).toBeUndefined();
    expect((await readPlay(play.id)).players[0]).toMatchObject({ name: "Original Avery", playerRef: player.id });
  });

  it("bounds and orders unlinked game and player suggestions while skipping corruption", async () => {
    const savedA = await createPlayer({ displayName: "Same", bggUsername: "one" });
    const savedB = await createPlayer({ displayName: "Same", bggUsername: "two" });
    const linked = await createGame({ name: "Linked", origin: "custom" });
    const owned = await createGame({ name: "Alpha owned", origin: "custom" });
    const db = await getDb();
    await db.put("games", { ...owned, ownedAt: "2026-01-01T00:00:00Z" });
    const older = await createDraftPlay({ gameName: "Legacy", winDirection: "high", outcome: "ranked", playerNames: ["Recent guest"] });
    older.playedAt = "2025-01-01T00:00:00Z";
    await writePlay(older);
    const newer = await createDraftPlay({ gameName: "legacy", winDirection: "high", outcome: "ranked", playerNames: ["New guest"] });
    newer.playedAt = "2026-01-01T00:00:00Z";
    await writePlay(newer);
    const linkedPlay = await createDraftPlay({ gameName: linked.name, gameRef: linked.id, winDirection: "high", outcome: "ranked", playerNames: ["Same"] });
    linkedPlay.playedAt = "2027-01-01T00:00:00Z";
    await writePlay(linkedPlay);
    await db.put("plays", { id: "bad", playedAt: "2028-01-01T00:00:00Z", status: "draft", gameName: "Invented", gameRef: null, play: { broken: true } });

    expect(await recentUnlinkedGameNames()).toEqual(["legacy"]);
    expect(await gameSuggestions()).toEqual([
      { name: "Linked", gameRef: linked.id },
      { name: "Alpha owned", gameRef: owned.id },
      { name: "legacy", gameRef: null },
    ]);
    const suggestions = await playerSuggestions();
    expect(suggestions.slice(0, 2)).toEqual([
      { id: savedA.id, name: "Same", username: "one" },
      { id: savedB.id, name: "Same", username: "two" },
    ]);
    expect(suggestions.map((suggestion) => suggestion.name)).toContain("New guest");
  });

  it("persists an explicitly referenced templated play once as its final document", async () => {
    const game = await createGame({ name: "Garden", origin: "custom" });
    await setTemplate(game.id, ["Flowers", "Paths"], "low", "flagged");
    const template = (await getGame(game.id))!.localTemplate!;
    const player = await createPlayer({ displayName: "Avery" });
    const play = await createDraftPlay({
      gameName: game.name,
      gameRef: game.id,
      winDirection: "high",
      outcome: "ranked",
      seats: [{ name: "Avery", playerRef: player.id }, { name: "Guest", playerRef: null }],
      template,
    });
    expect(play).toMatchObject({ winDirection: "low", outcome: "flagged", scoring: { version: 1 } });
    expect(play.players.map((seat) => [seat.name, seat.playerRef])).toEqual([["Avery", player.id], ["Guest", null]]);
    expect((await readPlay(play.id)).scoring?.categories.map((category) => category.label)).toEqual(["Flowers", "Paths"]);
  });

  it("versions reordered sheets once and preserves existing play snapshots after edits and deletion", async () => {
    const game = await createGame({ name: "Garden", origin: "custom" });
    await setTemplate(game.id, ["Flowers", "Paths"], "high", "ranked");
    const originalTemplate = (await getGame(game.id))!.localTemplate!;
    const play = await createDraftPlay({ gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", playerNames: ["Avery"], template: originalTemplate });
    await setTemplate(game.id, ["Paths", "Flowers"], "high", "ranked");
    expect((await getGame(game.id))!.templateVersion).toBe(2);
    await setTemplate(game.id, ["Paths", "Flowers"], "high", "ranked");
    expect((await getGame(game.id))!.templateVersion).toBe(2);
    await import("./db").then(({ deleteTemplate }) => deleteTemplate(game.id));
    expect((await readPlay(play.id)).scoring).toMatchObject({ version: 1, categories: [{ label: "Flowers" }, { label: "Paths" }] });
  });

  it("keeps corrupt game-specific history visible without inventing scores", async () => {
    const game = await createGame({ name: "Garden", origin: "custom" });
    const good = await createDraftPlay({ gameName: game.name, gameRef: game.id, winDirection: "high", outcome: "ranked", playerNames: ["Avery"] });
    good.players[0].total = new Decimal(4);
    await writePlay(good);
    const db = await getDb();
    await db.put("plays", { id: "bad", playedAt: "2027-01-01T00:00:00Z", status: "complete", gameName: game.name, gameRef: game.id, play: { broken: true } });

    const rows = await playSummariesForGame(game.id);
    expect(rows.map((row) => row.id)).toEqual(["bad", good.id]);
    expect(rows[0]).toMatchObject({ unreadable: true, playerCount: null, winnerLine: null });
  });

  it("does not allow a late write to resurrect a deleted play", async () => {
    const play = await createDraftPlay({ gameName: "Gone", winDirection: "high", outcome: "ranked", playerNames: ["Avery"] });
    await deletePlay(play.id);
    await expect(writePlay(play)).rejects.toThrow("deleted");
    await expect(readPlay(play.id)).rejects.toThrow("no play");
  });
});
