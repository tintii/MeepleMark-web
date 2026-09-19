import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlayDraftApi } from "../draft/usePlayDraft";
import { assignRoster } from "../tokens/playerIdentity";
import { winnerSummarySentence } from "../engine/winnerSummary";
import { addToCollection, getGame, type GameRecord } from "../storage/db";
import { MarkerBadge } from "../components/MarkerBadge";
import { Dialog } from "../components/Dialog";

/**
 * The plain-mode scoring surface (`play.scoring === null`). One score per
 * player, rank live-recomputed via `evaluate()` on every keystroke.
 * Mirrors ScoringView.swift.
 */
export function PlayScoring({ draft }: { draft: PlayDraftApi }) {
  const play = draft.play!;
  const evaluation = draft.evaluation!;
  const navigate = useNavigate();

  const [scoreTexts, setScoreTexts] = useState<string[]>(
    play.players.map((p) => (p.total != null ? p.total.toFixed() : "")),
  );
  const [rankTexts, setRankTexts] = useState<string[]>(
    play.players.map((p) => (p.rankIsOverridden && p.rank != null ? String(p.rank) : "")),
  );

  const [uncollectedGame, setUncollectedGame] = useState<GameRecord | null>(null);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  const [showingRecorded, setShowingRecorded] = useState(false);

  const roster = assignRoster(play.players.map((p) => p.name));

  function updateScore(index: number, value: string) {
    setScoreTexts((texts) => texts.map((t, i) => (i === index ? value : t)));
    draft.setScore(index, value);
  }

  function updateRank(index: number, value: string) {
    setRankTexts((texts) => texts.map((t, i) => (i === index ? value : t)));
    draft.setRank(index, value);
  }

  // Two-step completion (mirrors ScoringView.swift): offer to add an
  // uncollected game once, then always confirm with the winner sentence.
  async function handleComplete() {
    draft.complete();
    if (play.gameRef) {
      const game = await getGame(play.gameRef);
      if (game && game.ownedAt == null) {
        setUncollectedGame(game);
        setConfirmingAdd(true);
        return;
      }
    }
    setShowingRecorded(true);
  }

  async function resolveCollectionOffer(add: boolean) {
    if (add && uncollectedGame) await addToCollection(uncollectedGame.id);
    setConfirmingAdd(false);
    setShowingRecorded(true);
  }

  return (
    <div className="page">
      <h1 className="type-title">{play.gameName}</h1>
      <p className="type-caption">
        {new Date(play.playedAt).toLocaleString()} · {play.status}
      </p>

      <table className="score-table">
        <thead>
          <tr>
            <th aria-hidden="true"></th>
            <th>Player</th>
            <th>Rank</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {play.players.map((player, index) => {
            const identity = roster[index];
            const result = evaluation.players[index];
            return (
              <tr key={index}>
                <td>{identity && <MarkerBadge identity={identity} />}</td>
                <td>{player.name}</td>
                <td>
                  <input
                    className="tabular-nums rank-input"
                    inputMode="numeric"
                    value={rankTexts[index] ?? ""}
                    placeholder={result?.rank != null ? `Rank ${result.rank}` : "Rank —"}
                    onChange={(e) => updateRank(index, e.target.value)}
                    aria-label={`${player.name}'s rank`}
                  />
                </td>
                <td>
                  <input
                    className="tabular-nums"
                    inputMode="decimal"
                    value={scoreTexts[index] ?? ""}
                    onChange={(e) => updateScore(index, e.target.value)}
                    aria-label={`${player.name}'s score`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {evaluation.warnings.length > 0 && (
        <ul className="warnings">
          {evaluation.warnings.map((warning, i) => (
            <li key={i}>{warning.message}</li>
          ))}
        </ul>
      )}

      {draft.loadError && <p role="alert">{draft.loadError}</p>}

      <button type="button" onClick={handleComplete} disabled={play.status === "complete"}>
        Complete
      </button>

      {confirmingAdd && uncollectedGame && (
        <Dialog title={`Add ${uncollectedGame.name} to your collection?`}>
          <button type="button" onClick={() => resolveCollectionOffer(true)}>
            Add
          </button>
          <button type="button" onClick={() => resolveCollectionOffer(false)}>
            Not now
          </button>
        </Dialog>
      )}

      {showingRecorded && (
        <Dialog title="Play recorded" message={winnerSummarySentence(evaluation, play.outcome) ?? "Nice game."}>
          <button type="button" onClick={() => navigate("/")}>
            View Plays
          </button>
        </Dialog>
      )}
    </div>
  );
}
