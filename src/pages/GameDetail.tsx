import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addToCollection, deletePlay, getGame, playSummariesForGame, removeFromCollection, type GameRecord, type PlaySummary } from "../storage/db";
import { PlayRowItem } from "../components/PlayRowItem";
import { Dialog } from "../components/Dialog";
import { GroupedSection, PageHeader } from "../components/PageHeader";
import { useAccount } from "../account/accountState";
import { scoreSheetFilename, serializeScoreSheet } from "../draft/scoreSheetPortability";

/**
 * `/collection/:gameId` — a game, its plays, and the score-sheet /
 * collection actions. Mirrors GameDetailView.swift, including its
 * deliberate placement of "Remove from collection" in the page body
 * rather than a toolbar icon — that was a fix on the iOS side after the
 * icon-button placement read as accidental.
 */
export function GameDetail() {
  const { workspace } = useAccount();
  const canWrite = workspace.kind === "guest" || (workspace.kind === "account" && workspace.capabilities.write);
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameRecord | null | undefined>(undefined);
  const [plays, setPlays] = useState<PlaySummary[]>([]);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [deletingPlay, setDeletingPlay] = useState<PlaySummary | null>(null);

  async function reload() {
    if (!gameId) return;
    const [g, p] = await Promise.all([getGame(gameId), playSummariesForGame(gameId)]);
    setGame(g ?? null);
    setPlays(p);
  }

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    void Promise.all([getGame(gameId), playSummariesForGame(gameId)]).then(([loadedGame, loadedPlays]) => {
      if (cancelled) return;
      setGame(loadedGame ?? null);
      setPlays(loadedPlays);
    });
    return () => { cancelled = true; };
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

  async function handleAddToCollection() {
    await addToCollection(currentGame.id);
    reload();
  }

  async function handleConfirmRemove() {
    await removeFromCollection(currentGame.id);
    setConfirmingRemoval(false);
    reload();
  }

  async function handleDeletePlay() {
    if (!deletingPlay) return;
    await deletePlay(deletingPlay.id);
    setDeletingPlay(null);
    await reload();
  }

  function handleExportScoreSheet() {
    if (!currentGame.localTemplate) return;
    const url = URL.createObjectURL(new Blob([serializeScoreSheet(currentGame.localTemplate)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = scoreSheetFilename(currentGame.name);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <PageHeader
        title={game.name}
        parent={{ to: "/collection", label: "Collection" }}
        actions={canWrite ? <Link className="button-link" to="/play/new" state={{ presetGameName: game.name }}>Add Play</Link> : undefined}
      />

      <div className="action-row">
        {canWrite && game.ownedAt == null && (
          <button type="button" onClick={handleAddToCollection}>
            Add to collection
          </button>
        )}
      </div>

      <GroupedSection title="Score sheet">
        {canWrite && <Link className="button-link" to={`/collection/${game.id}/template`}>
          {game.localTemplate ? "Edit score sheet" : "Add a score sheet"}
        </Link>}
        {game.localTemplate && (
          <>
            <p className="type-caption">{game.localTemplate.categories.map((c) => c.label).join(", ")}</p>
            <button type="button" onClick={handleExportScoreSheet}>Export score sheet</button>
          </>
        )}
      </GroupedSection>

      {plays.length === 0 ? (
        <p className="type-caption">
          {game.ownedAt != null ? "Owned, not yet played." : "Not yet played, and not in your collection."}
        </p>
      ) : (
        <ul className="play-list" aria-label={`${game.name} play history`} data-dialog-fallback tabIndex={-1}>
          {plays.map((row) => (
            <PlayRowItem key={row.id} row={row} onDelete={canWrite ? setDeletingPlay : undefined} />
          ))}
        </ul>
      )}

      {canWrite && game.ownedAt != null && (
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
          onCancel={() => setConfirmingRemoval(false)}
        >
          <button type="button" className="destructive-button" onClick={handleConfirmRemove}>
            Remove
          </button>
          <button type="button" onClick={() => setConfirmingRemoval(false)}>
            Cancel
          </button>
        </Dialog>
      )}

      {deletingPlay && (
        <Dialog
          title={`Delete this ${game.name} play?`}
          message="Other plays, this game, its score sheet, and saved players will stay in place."
          onCancel={() => setDeletingPlay(null)}
        >
          <button type="button" className="destructive-button" onClick={handleDeletePlay}>Delete play</button>
          <button type="button" onClick={() => setDeletingPlay(null)}>Cancel</button>
        </Dialog>
      )}
    </div>
  );
}
