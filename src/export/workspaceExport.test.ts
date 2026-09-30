import { describe, expect, it } from "vitest";
import { serializeWorkspace, workspaceExportFilename, WorkspaceExportValidationError, type WorkspaceSnapshot } from "./workspaceExport";

const game = (id: string, ownedAt: string | null = null) => ({
  id, name: `Game ${id}`, slug: null, bggThingId: null, origin: "custom", ownedAt, localTemplate: null, templateVersion: 0,
});
const player = (id: string) => ({ id, displayName: `Player ${id}`, bggUsername: null, preferredColorIndex: null });
const play = (id: string, playedAt: string) => ({
  id, playedAt, status: "complete", gameName: "Game", gameRef: "game-a", winDirection: "high", outcome: "ranked",
  scoring: { slug: "local:game-a", version: 3, defaultOutcome: "ranked", categories: [{ key: "points", label: "Points" }] },
  players: [{ name: "Avery then", playerRef: "player-a", categories: { points: "0.10" }, total: "7.250", totalIsOverridden: true, rank: 1, rankIsOverridden: true }],
  notes: "Exact note",
});

describe("serializeWorkspace", () => {
  it("uses the export date in the portable filename", () => {
    expect(workspaceExportFilename(new Date("2026-09-30T23:59:59.000Z"))).toBe("meeplemark-workspace-2026-09-30.json");
  });

  it("serializes an empty version-1 envelope with readable formatting", () => {
    const text = serializeWorkspace({ games: [], players: [], plays: [] }, new Date("2026-09-30T12:34:56.000Z"));
    expect(JSON.parse(text)).toEqual({ format: "meeplemark-workspace", version: 1, exportedAt: "2026-09-30T12:34:56.000Z", games: [], players: [], plays: [] });
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "version": 1,');
  });

  it("sorts copies deterministically and preserves exact persisted values", () => {
    const snapshot: WorkspaceSnapshot = {
      games: [game("game-z"), game("game-a", "2026-01-02T00:00:00.000Z")],
      players: [player("player-z"), player("player-a")],
      plays: [play("play-z", "2026-02-01T00:00:00.000Z"), play("play-b", "2026-01-01T00:00:00.000Z"), play("play-a", "2026-01-01T00:00:00.000Z")],
    };
    const original = structuredClone(snapshot);
    const first = JSON.parse(serializeWorkspace(snapshot, new Date(0)));
    const second = serializeWorkspace({ games: [...snapshot.games].reverse(), players: [...snapshot.players].reverse(), plays: [...snapshot.plays].reverse() }, new Date(0));
    expect(first.games.map((record: { id: string }) => record.id)).toEqual(["game-a", "game-z"]);
    expect(first.players.map((record: { id: string }) => record.id)).toEqual(["player-a", "player-z"]);
    expect(first.plays.map((record: { id: string }) => record.id)).toEqual(["play-a", "play-b", "play-z"]);
    expect(first.plays[0].players[0]).toMatchObject({ categories: { points: "0.10" }, total: "7.250", totalIsOverridden: true, rankIsOverridden: true });
    expect(serializeWorkspace(snapshot, new Date(0))).toBe(second);
    expect(snapshot).toEqual(original);
  });

  it("reports a bounded set of invalid record details and the full count", () => {
    const invalid = Array.from({ length: 7 }, (_, index) => ({ ...player(`bad-${index}`), displayName: "" }));
    try {
      serializeWorkspace({ games: [], players: invalid, plays: [] });
      throw new Error("expected serialization to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceExportValidationError);
      const validation = error as WorkspaceExportValidationError;
      expect(validation.totalFailures).toBe(7);
      expect(validation.failures).toHaveLength(5);
      expect(validation.message).toContain("and 2 more");
      expect(validation.message).toContain("Nothing was exported");
    }
  });
});
