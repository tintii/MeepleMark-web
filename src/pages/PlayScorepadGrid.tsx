import { useEffect, useRef, useState } from "react";
import type { PlayDraftApi } from "../draft/usePlayDraft";
import { assignRoster } from "../tokens/playerIdentity";
import { MarkerBadge } from "../components/MarkerBadge";
import { CompletionControls, DecimalScoreField, OutcomeControl } from "../components/ScoreControls";
import { PageHeader } from "../components/PageHeader";

type ScorepadLayout = "grid" | "single";

export function PlayScorepadGrid({ draft }: { draft: PlayDraftApi }) {
  const play = draft.play!;
  const evaluation = draft.evaluation!;
  const categories = play.scoring?.categories ?? [];
  const roster = assignRoster(play.players.map((player) => player.name));
  const [layout, setLayout] = useState<ScorepadLayout>(() => window.matchMedia("(max-width: 40rem)").matches ? "single" : "grid");
  const explicitLayout = useRef(false);
  const layoutHeading = useRef<HTMLElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [categoryTexts, setCategoryTexts] = useState<Record<string, string>[]>(() => play.players.map((player) => Object.fromEntries(categories.map((category) => [category.key, player.categories?.[category.key]?.toFixed() ?? ""]))));
  const [totalTexts, setTotalTexts] = useState(() => play.players.map((player) => player.total?.toFixed() ?? ""));
  const [rankTexts, setRankTexts] = useState(() => play.players.map((player) => player.rankIsOverridden && player.rank != null ? String(player.rank) : ""));
  const [invalidFields, setInvalidFields] = useState<Set<string>>(() => new Set());
  const setHasUnfinishedInput = draft.setHasUnfinishedInput;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 40rem)");
    const update = (event: MediaQueryListEvent) => { if (!explicitLayout.current) setLayout(event.matches ? "single" : "grid"); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setHasUnfinishedInput(invalidFields.size > 0);
    return () => setHasUnfinishedInput(false);
  }, [setHasUnfinishedInput, invalidFields.size]);

  function chooseLayout(next: ScorepadLayout) {
    explicitLayout.current = true;
    setLayout(next);
    window.requestAnimationFrame(() => layoutHeading.current?.focus());
  }

  function setValidity(key: string, valid: boolean) {
    setInvalidFields((current) => {
      const next = new Set(current);
      if (valid) next.delete(key); else next.add(key);
      return next;
    });
  }

  function updateCategory(playerIndex: number, key: string, value: string) {
    setCategoryTexts((texts) => texts.map((text, index) => index === playerIndex ? { ...text, [key]: value } : text));
    setValidity(`category:${playerIndex}:${key}`, draft.setCategoryValue(playerIndex, key, value));
  }

  function updateTotal(playerIndex: number, value: string) {
    setTotalTexts((texts) => texts.map((text, index) => index === playerIndex ? value : text));
    setValidity(`total:${playerIndex}`, draft.setScore(playerIndex, value));
  }

  function updateRank(playerIndex: number, value: string) {
    setRankTexts((texts) => texts.map((text, index) => index === playerIndex ? value : text));
    setValidity(`rank:${playerIndex}`, draft.setRank(playerIndex, value));
  }

  function totalValue(index: number): string {
    if (invalidFields.has(`total:${index}`) || play.players[index].totalIsOverridden) return totalTexts[index] ?? "";
    return evaluation.players[index]?.total?.toFixed() ?? "";
  }

  function rankControl(playerIndex: number) {
    const player = play.players[playerIndex];
    const result = evaluation.players[playerIndex];
    if (play.outcome === "flagged") return <OutcomeControl name={player.name} value={player.win} onChange={(value) => draft.setWin(playerIndex, value)} />;
    return (
      <label className="field compact-field">
        <span className="field-label">Rank {player.rankIsOverridden && <span className="manual-indicator">Manual rank</span>}</span>
        <input className="tabular-nums" inputMode="numeric" value={rankTexts[playerIndex] ?? ""} placeholder={result?.rank != null ? `Automatic: ${result.rank}` : "Automatic"} onChange={(event) => updateRank(playerIndex, event.target.value)} aria-label={`${player.name}'s rank`} />
      </label>
    );
  }

  function totalControl(playerIndex: number) {
    const player = play.players[playerIndex];
    return (
      <div>
        <DecimalScoreField label={`${player.name}, total`} value={totalValue(playerIndex)} onChange={(value) => updateTotal(playerIndex, value)} />
        {player.totalIsOverridden && <div className="manual-row"><span className="manual-indicator">Manual total</span><button type="button" className="link-button" onClick={() => { draft.recomputeTotal(playerIndex); setTotalTexts((texts) => texts.map((text, index) => index === playerIndex ? "" : text)); }}>Recompute</button></div>}
      </div>
    );
  }

  return (
    <div className="page page-wide">
      <PageHeader title={play.gameName} parent={{ to: "/", label: "Plays" }} subtitle={`${new Date(play.playedAt).toLocaleString()} · ${play.status}`} />

      <div className="layout-switch" role="group" aria-label="Scorepad layout">
        <button type="button" aria-pressed={layout === "grid"} onClick={() => chooseLayout("grid")}>Grid</button>
        <button type="button" aria-pressed={layout === "single"} onClick={() => chooseLayout("single")}>Single player</button>
      </div>

      {layout === "single" ? (
        <section className="single-scorepad" aria-labelledby="single-player-heading">
          <div className="single-player-nav">
            <button type="button" onClick={() => setSelectedPlayer((index) => Math.max(0, index - 1))} disabled={selectedPlayer === 0}>Previous</button>
            <div className="plain-player-identity">{roster[selectedPlayer] && <MarkerBadge identity={roster[selectedPlayer]} />}<h2 id="single-player-heading" ref={(element) => { layoutHeading.current = element; }} tabIndex={-1}>{play.players[selectedPlayer].name}</h2></div>
            <button type="button" onClick={() => setSelectedPlayer((index) => Math.min(play.players.length - 1, index + 1))} disabled={selectedPlayer === play.players.length - 1}>Next</button>
          </div>
          <p className="type-caption player-position">Player {selectedPlayer + 1} of {play.players.length}</p>
          <div className="single-category-list">
            {categories.map((category) => <label className="field category-field" key={category.key}><span className="field-label">{category.label}</span><DecimalScoreField label={`${play.players[selectedPlayer].name}, ${category.label}`} value={categoryTexts[selectedPlayer]?.[category.key] ?? ""} onChange={(value) => updateCategory(selectedPlayer, category.key, value)} /></label>)}
          </div>
          <div className="field"><span className="field-label">Total</span>{totalControl(selectedPlayer)}</div>
          {rankControl(selectedPlayer)}
        </section>
      ) : (
        <div className="scorepad-table-wrap" tabIndex={0} aria-label="Category score grid">
          <table className="scorepad-table">
            <thead><tr><th scope="col" ref={(element) => { layoutHeading.current = element; }} tabIndex={-1}>Category</th>{play.players.map((player, index) => <th scope="col" key={index}><span className="scorepad-player-heading">{roster[index] && <MarkerBadge identity={roster[index]} />}{player.name}</span></th>)}</tr></thead>
            <tbody>
              {categories.map((category) => <tr key={category.key}><th scope="row">{category.label}</th>{play.players.map((player, index) => <td key={index}><DecimalScoreField label={`${player.name}, ${category.label}`} value={categoryTexts[index]?.[category.key] ?? ""} onChange={(value) => updateCategory(index, category.key, value)} /></td>)}</tr>)}
              <tr><th scope="row">Total</th>{play.players.map((_, index) => <td key={index}>{totalControl(index)}</td>)}</tr>
              <tr><th scope="row">{play.outcome === "ranked" ? "Rank" : "Outcome"}</th>{play.players.map((_, index) => <td key={index}>{rankControl(index)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}

      {evaluation.warnings.length > 0 && <ul className="warnings" role="status">{evaluation.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>}
      <CompletionControls draft={draft} hasUnfinishedInput={invalidFields.size > 0} />
    </div>
  );
}
