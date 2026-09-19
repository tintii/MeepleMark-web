import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addToCollection, getGame, playsForGame, removeFromCollection, type GameRecord } from "../storage/db";
import { evaluate } from "../engine/evaluate";
import { winnerSummarySentence } from "../engine/winnerSummary";
import type { Play } from "../engine/models";
import { PlayRowItem, type PlayRowData } from "../components/PlayRowItem";
import { Dialog } from "../components/Dialog";

/**
 * `/collection/:gameId` — a game, its plays, and the score-sheet /
 * collection actions. Mirrors GameDetailView.swift, including its
 * deliberate placement of "Remove from collection" in the page body
 * rather than a toolbar icon — that was a fix on the iOS side after the
 * icon-button placement read as accidental.
 */
export function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameRecord | null | undefined>(undefined);
  const [plays, setPlays] = useState<Play[]>([]);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  async function reload() {
    if (!gameId) return;
    const [g, p] = await Promise.all([getGame(gameId), playsForGame(gameId)]);
    setGame(g ?? null);
    setPlays(p);
  }

  useEffect(() => {
    reload();
  }, [gameId]);

  if (game === undefined) {
    return (
      <div className="page">
        <p className="type-caption">Loading…</p>
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="page">
        <p role="alert">Game not found.</p>
      </div>
    );
  }

  const currentGame = game; // narrowed non-null; closures below capture this, not `game`

  const rows: PlayRowData[] = plays.map((play) => ({
    id: play.id,
    gameName: play.gameName,
    playedAt: play.playedAt,
    status: play.status,
    playerCount: play.players.length,
    winnerLine: play.status === "complete" ? winnerSummarySentence(evaluate(play), play.outcome) : null,
    unreadable: false,
  }));

  async function handleAddToCollection() {
    await addToCollection(currentGame.id);
    reload();
  }

  async function handleConfirmRemove() {
    await removeFromCollection(currentGame.id);
    setConfirmingRemoval(false);
    reload();
  }

  return (
    <div className="page">
      <h1 className="type-title">{game.name}</h1>

      <div className="action-row">
        <Link to="/play/new" state={{ presetGameName: game.name }}>
          <button type="button">Add Play</button>
        </Link>
        {game.ownedAt == null && (
          <button type="button" onClick={handleAddToCollection}>
            Add to collection
          </button>
        )}
      </div>

      <section className="score-sheet-section">
        <h2 className="type-title">Score sheet</h2>
        <Link to={`/collection/${game.id}/template`}>
          <button type="button">{game.localTemplate ? "Edit score sheet" : "Add a score sheet"}</button>
        </Link>
        {game.localTemplate && (
          <p className="type-caption">{game.localTemplate.categories.map((c) => c.label).join(", ")}</p>
        )}
      </section>

      {rows.length === 0 ? (
        <p className="type-caption">
          {game.ownedAt != null ? "Owned, not yet played." : "Not yet played, and not in your collection."}
        </p>
      ) : (
        <ul className="play-list">
          {rows.map((row) => (
            <PlayRowItem key={row.id} row={row} />
          ))}
        </ul>
      )}

      {game.ownedAt != null && (
        <section className="destructive-section">
          <button type="button" className="destructive-button" onClick={() => setConfirmingRemoval(true)}>
            Remove from collection
          </button>
        </section>
      )}

      {confirmingRemoval && (
        <Dialog
          title={`Remove ${game.name} from your collection?`}
          message="Its recorded plays stay exactly as they are — this only removes it from your collection."
        >
          <button type="button" className="destructive-button" onClick={handleConfirmRemove}>
            Remove
          </button>
          <button type="button" onClick={() => setConfirmingRemoval(false)}>
            Cancel
          </button>
        </Dialog>
      )}
    </div>
  );
}
