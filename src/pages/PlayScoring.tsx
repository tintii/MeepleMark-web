import { useEffect, useState, type CSSProperties } from "react";
import type { PlayDraftApi } from "../draft/usePlayDraft";
import { assignRoster } from "../tokens/playerIdentity";
import { MarkerBadge } from "../components/MarkerBadge";
import { CompletionControls, DecimalScoreField, OutcomeControl } from "../components/ScoreControls";
import { PageHeader } from "../components/PageHeader";

export function PlayScoring({ draft }: { draft: PlayDraftApi }) {
  const play = draft.play!;
  const evaluation = draft.evaluation!;
  const [scoreTexts, setScoreTexts] = useState(() => play.players.map((player) => player.total?.toFixed() ?? ""));
  const [rankTexts, setRankTexts] = useState(() => play.players.map((player) => player.rankIsOverridden && player.rank != null ? String(player.rank) : ""));
  const [invalidFields, setInvalidFields] = useState<Set<string>>(() => new Set());
  const roster = assignRoster(play.players.map((player) => player.name));
  const setHasUnfinishedInput = draft.setHasUnfinishedInput;

  useEffect(() => {
    setHasUnfinishedInput(invalidFields.size > 0);
    return () => setHasUnfinishedInput(false);
  }, [setHasUnfinishedInput, invalidFields.size]);

  function setValidity(key: string, valid: boolean) {
    setInvalidFields((current) => {
      const next = new Set(current);
      if (valid) next.delete(key); else next.add(key);
      return next;
    });
  }

  function updateScore(index: number, value: string) {
    setScoreTexts((texts) => texts.map((text, position) => position === index ? value : text));
    setValidity(`score:${index}`, draft.setScore(index, value));
  }

  function updateRank(index: number, value: string) {
    setRankTexts((texts) => texts.map((text, position) => position === index ? value : text));
    setValidity(`rank:${index}`, draft.setRank(index, value));
  }

  return (
    <div className="page">
      <PageHeader title={play.gameName} parent={{ to: "/", label: "Plays" }} subtitle={`${new Date(play.playedAt).toLocaleString()} · ${play.status}`} />

      <div className="plain-score-list" role="group" aria-label="Player scores">
        {play.players.map((player, index) => {
          const identity = roster[index];
          const result = evaluation.players[index];
          return (
            <section className="plain-player-card" key={index} aria-labelledby={`plain-player-${index}`} style={{ "--player-accent": `var(--color-player-${(identity?.colorIndex ?? index) % 8 + 1}-fill)` } as CSSProperties}>
              <div className="plain-player-identity">{identity && <MarkerBadge identity={identity} />}<h2 id={`plain-player-${index}`}>{player.name}</h2></div>
              <label className="field score-field"><span className="field-label">Score</span><DecimalScoreField label={`${player.name}'s score`} value={scoreTexts[index] ?? ""} onChange={(value) => updateScore(index, value)} /></label>
              {play.outcome === "ranked" ? (
                <label className="field rank-field">
                  <span className="field-label">Rank {player.rankIsOverridden && <span className="manual-indicator">Manual rank</span>}</span>
                  <input className="tabular-nums" inputMode="numeric" value={rankTexts[index] ?? ""} placeholder={result?.rank != null ? `Automatic: ${result.rank}` : "Automatic"} onChange={(event) => updateRank(index, event.target.value)} aria-label={`${player.name}'s rank`} />
                </label>
              ) : (
                <OutcomeControl name={player.name} value={player.win} onChange={(value) => draft.setWin(index, value)} />
              )}
            </section>
          );
        })}
      </div>

      {evaluation.warnings.length > 0 && <ul className="warnings" role="status">{evaluation.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>}
      <CompletionControls draft={draft} hasUnfinishedInput={invalidFields.size > 0} />
    </div>
  );
}
