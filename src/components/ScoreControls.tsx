import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlayDraftApi } from "../draft/usePlayDraft";
import { addToCollection, getGame, type GameRecord } from "../storage/db";
import { winnerSummarySentence } from "../engine/winnerSummary";
import { Dialog } from "./Dialog";
import { SyncStatusPanel } from "./SyncStatus";

export function DecimalScoreField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  function toggleSign() {
    onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
  }
  return (
    <div className="number-entry">
      <input className="tabular-nums" inputMode="decimal" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="sign-button" onClick={toggleSign} aria-label={`Toggle sign for ${label}`}>±</button>
    </div>
  );
}

export function OutcomeControl({ name, value, onChange }: { name: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return (
    <fieldset className="outcome-control">
      <legend>{name} outcome</legend>
      <button type="button" aria-pressed={value === true} onClick={() => onChange(true)}>Won</button>
      <button type="button" aria-pressed={value === false} onClick={() => onChange(false)}>Lost</button>
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)}>Unset</button>
    </fieldset>
  );
}

export function SaveStatus({ draft }: { draft: PlayDraftApi }) {
  if (draft.saveStatus === "saved") return <p className="save-status" role="status">Saved</p>;
  if (draft.saveStatus === "saving") return <p className="save-status" role="status">Saving…</p>;
  return (
    <div className="save-error" role="alert">
      <p>{draft.saveError}</p>
      <button type="button" onClick={() => void draft.retry()}>Retry save</button>
    </div>
  );
}

export function CompletionControls({ draft, hasUnfinishedInput }: { draft: PlayDraftApi; hasUnfinishedInput: boolean }) {
  const navigate = useNavigate();
  const [uncollectedGame, setUncollectedGame] = useState<GameRecord | null>(null);
  const [stage, setStage] = useState<"idle" | "offer" | "recorded">("idle");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionFailed, setCompletionFailed] = useState(false);
  const play = draft.play!;
  const evaluation = draft.evaluation!;

  async function handleComplete() {
    if (hasUnfinishedInput) {
      setError("Finish or clear every incomplete number before recording the play.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      let completed;
      if (completionFailed) {
        await draft.retry();
        completed = draft.play!;
      } else {
        completed = await draft.complete();
      }
      setCompletionFailed(false);
      if (completed.gameRef) {
        const game = await getGame(completed.gameRef);
        if (game && game.ownedAt == null) {
          setUncollectedGame(game);
          setStage("offer");
          return;
        }
      }
      setStage("recorded");
    } catch {
      setCompletionFailed(true);
      setError("The completed play was not saved. Your entries are still here; retry when storage is available.");
    } finally {
      setPending(false);
    }
  }

  async function addGame() {
    if (!uncollectedGame) return;
    setPending(true);
    setError(null);
    try {
      await addToCollection(uncollectedGame.id);
      setStage("recorded");
    } catch {
      setError("The play is recorded, but the game was not added. Retry or choose Not now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {error && <p role="alert" className="form-error">{error}</p>}
      <SaveStatus draft={draft} />
      <SyncStatusPanel />
      <button type="button" className="primary-button" onClick={handleComplete} disabled={(play.status === "complete" && !completionFailed) || pending}>{pending ? "Saving…" : completionFailed ? "Retry completion" : "Complete"}</button>

      {stage === "offer" && uncollectedGame && (
        <Dialog title={`Add ${uncollectedGame.name} to your collection?`} onCancel={() => setStage("recorded")} pending={pending}>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="button" onClick={addGame} disabled={pending}>Add</button>
          <button type="button" onClick={() => setStage("recorded")} disabled={pending}>Not now</button>
        </Dialog>
      )}
      {stage === "recorded" && (
        <Dialog title="Play recorded on this device" message={winnerSummarySentence(evaluation, play.outcome) ?? "Nice game."}>
          <button type="button" onClick={() => navigate("/")}>View Plays</button>
        </Dialog>
      )}
    </>
  );
}
