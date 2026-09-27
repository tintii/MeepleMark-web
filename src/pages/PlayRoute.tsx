import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayDraft } from "../draft/usePlayDraft";
import { PlayScoring } from "./PlayScoring";
import { PlayScorepadGrid } from "./PlayScorepadGrid";
import { Dialog } from "../components/Dialog";

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
  const navigate = useNavigate();
  const [blockedDestination, setBlockedDestination] = useState<string | null>(null);

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target || target.origin !== window.location.origin) return;
      if (draft.saveStatus === "saved" && !draft.hasUnfinishedInput) return;
      event.preventDefault();
      const destination = `${target.pathname}${target.search}${target.hash}`;
      if (draft.saveStatus === "saving" && !draft.hasUnfinishedInput) {
        void draft.flush().then(() => navigate(destination), () => setBlockedDestination(destination));
      } else {
        setBlockedDestination(destination);
      }
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [draft, navigate]);

  async function retryAndLeave() {
    if (!blockedDestination) return;
    try {
      await draft.retry();
      navigate(blockedDestination);
    } catch {
      // The save status exposes the retry failure and leaves the dialog open.
    }
  }

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

  return (
    <>
      {draft.play.scoring != null ? <PlayScorepadGrid draft={draft} /> : <PlayScoring draft={draft} />}
      {blockedDestination && (
        <Dialog title="Changes are not ready to leave" message={draft.hasUnfinishedInput ? "Finish or clear incomplete numbers, or leave without saving those partial entries." : "The latest save failed. Retry or explicitly leave without saving."} onCancel={() => setBlockedDestination(null)}>
          {!draft.hasUnfinishedInput && <button type="button" onClick={retryAndLeave}>Retry save</button>}
          <button type="button" className="destructive-button" onClick={() => navigate(blockedDestination)}>Leave without saving</button>
          <button type="button" onClick={() => setBlockedDestination(null)}>Stay</button>
        </Dialog>
      )}
    </>
  );
}
