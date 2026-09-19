import { useParams } from "react-router-dom";
import { usePlayDraft } from "../draft/usePlayDraft";
import { PlayScoring } from "./PlayScoring";
import { PlayScorepadGrid } from "./PlayScorepadGrid";

/**
 * `/play/:id` — routes to the plain scoring surface or the templated
 * scorepad grid based on `play.scoring !== null`. Mirrors
 * PlayListView.swift's `if draft.play.scoring != nil { ScorepadGridView }
 * else { ScoringView }` — a real bug on the iOS side when this branch was
 * missing, so it's preserved here deliberately.
 */
export function PlayRoute() {
  const { id } = useParams<{ id: string }>();
  const draft = usePlayDraft(id);

  if (draft.loadError && !draft.play) {
    return (
      <div className="page">
        <p role="alert">Could not load play: {draft.loadError}</p>
      </div>
    );
  }
  if (!draft.play) {
    return (
      <div className="page">
        <p className="type-caption">Loading…</p>
      </div>
    );
  }

  return draft.play.scoring != null ? <PlayScorepadGrid draft={draft} /> : <PlayScoring draft={draft} />;
}
