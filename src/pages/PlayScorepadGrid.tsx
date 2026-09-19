import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlayDraftApi } from "../draft/usePlayDraft";
import { assignRoster } from "../tokens/playerIdentity";
import { winnerSummarySentence } from "../engine/winnerSummary";
import { addToCollection, getGame, type GameRecord } from "../storage/db";
import { MarkerBadge } from "../components/MarkerBadge";
import { Dialog } from "../components/Dialog";

/**
 * The templated scoring surface (`play.scoring !== null`): categories as
 * rows, players as columns. Mirrors ScorepadGridView.swift's `gridBody` —
 * the category-label column (`.scorepad-pinned`) is a *sibling* of the
 * horizontally scrolling player region (`.scorepad-scroll`), not a child
 * of it, so it never scrolls away with the player columns. Category
 * labels wrap rather than truncate (no ellipsis/line-clamp anywhere in
 * `.scorepad-label-cell` — see tokens.css).
 */
export function PlayScorepadGrid({ draft }: { draft: PlayDraftApi }) {
  const play = draft.play!;
  const evaluation = draft.evaluation!;
  const navigate = useNavigate();
  const categories = play.scoring?.categories ?? [];
  const roster = assignRoster(play.players.map((p) => p.name));

  const [categoryTexts, setCategoryTexts] = useState<Record<string, string>[]>(
    play.players.map((p) =>
      Object.fromEntries(categories.map((c) => [c.key, p.categories?.[c.key]?.toFixed() ?? ""])),
    ),
  );
  const [totalTexts, setTotalTexts] = useState<string[]>(
    play.players.map((p) => (p.totalIsOverridden && p.total != null ? p.total.toFixed() : "")),
  );
  const [rankTexts, setRankTexts] = useState<string[]>(
    play.players.map((p) => (p.rankIsOverridden && p.rank != null ? String(p.rank) : "")),
  );

  const [uncollectedGame, setUncollectedGame] = useState<GameRecord | null>(null);
  const [confirmingAdd, setConfirmingAdd] = useState(false);
  const [showingRecorded, setShowingRecorded] = useState(false);

  function updateCategory(playerIndex: number, key: string, value: string) {
    setCategoryTexts((texts) => texts.map((t, i) => (i === playerIndex ? { ...t, [key]: value } : t)));
    draft.setCategoryValue(playerIndex, key, value);
  }

  function updateTotal(playerIndex: number, value: string) {
    setTotalTexts((texts) => texts.map((t, i) => (i === playerIndex ? value : t)));
    draft.setScore(playerIndex, value);
  }

  function updateRank(playerIndex: number, value: string) {
    setRankTexts((texts) => texts.map((t, i) => (i === playerIndex ? value : t)));
    draft.setRank(playerIndex, value);
  }

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
    <div className="page page-wide">
      <h1 className="type-title">{play.gameName}</h1>

      <div className="scorepad-grid">
        <div className="scorepad-pinned">
          <div className="scorepad-cell scorepad-header-cell" aria-hidden="true">
            {" "}
          </div>
          {categories.map((c) => (
            <div key={c.key} className="scorepad-cell scorepad-label-cell">
              {c.label}
            </div>
          ))}
          <div className="scorepad-cell scorepad-label-cell">Total</div>
          {play.outcome === "ranked" && <div className="scorepad-cell scorepad-label-cell">Rank</div>}
        </div>

        <div className="scorepad-scroll">
          <div className="scorepad-players">
            {play.players.map((player, index) => {
              const identity = roster[index];
              const result = evaluation.players[index];
              return (
                <div key={index} className="scorepad-player-column">
                  <div className="scorepad-cell scorepad-header-cell">
                    {identity && <MarkerBadge identity={identity} />}
                    <span className="player-name">{player.name}</span>
                  </div>

                  {categories.map((c) => (
                    <div key={c.key} className="scorepad-cell">
                      <input
                        className="tabular-nums"
                        inputMode="decimal"
                        placeholder="0"
                        value={categoryTexts[index]?.[c.key] ?? ""}
                        onChange={(e) => updateCategory(index, c.key, e.target.value)}
                        aria-label={`${player.name}, ${c.label}`}
                      />
                    </div>
                  ))}

                  <div className="scorepad-cell scorepad-total-cell">
                    <input
                      className="tabular-nums"
                      inputMode="decimal"
                      value={player.totalIsOverridden ? totalTexts[index] ?? "" : result?.total?.toFixed() ?? ""}
                      onChange={(e) => updateTotal(index, e.target.value)}
                      aria-label={`${player.name}, total`}
                    />
                    {player.totalIsOverridden && (
                      <div className="manual-row">
                        <span className="type-caption">manual</span>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => draft.recomputeTotal(index)}
                        >
                          Recompute
                        </button>
                      </div>
                    )}
                  </div>

                  {play.outcome === "ranked" && (
                    <div className="scorepad-cell">
                      <input
                        className="tabular-nums"
                        inputMode="numeric"
                        placeholder={result?.rank != null ? `Rank ${result.rank}` : "Rank —"}
                        value={rankTexts[index] ?? ""}
                        onChange={(e) => updateRank(index, e.target.value)}
                        aria-label={`${player.name}'s rank`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
