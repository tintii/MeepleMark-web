import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPlaySummaries, type PlaySummary } from "../storage/db";
import { deletePlay } from "../storage/db";
import { PlayRowItem } from "../components/PlayRowItem";
import { Dialog } from "../components/Dialog";
import { PageHeader } from "../components/PageHeader";
import { useAccount } from "../account/accountState";

/** `/` — every play, most recent first, with each row's winner line once complete. */
export function PlayList() {
  const { workspace } = useAccount();
  const canWrite = workspace.kind === "guest" || (workspace.kind === "account" && workspace.capabilities.write);
  const [rows, setRows] = useState<PlaySummary[] | null>(null);
  const [deleting, setDeleting] = useState<PlaySummary | null>(null);

  async function reload(cancelled?: { value: boolean }) {
    const summaries = await listPlaySummaries();
    if (!cancelled?.value) setRows(summaries);
  }

  useEffect(() => {
    const cancelled = { value: false };
    void listPlaySummaries().then((summaries) => {
      if (!cancelled.value) setRows(summaries);
    });
    return () => {
      cancelled.value = true;
    };
  }, []);

  async function confirmDelete() {
    if (!deleting) return;
    await deletePlay(deleting.id);
    setDeleting(null);
    await reload();
  }

  return (
    <div className="page">
      <PageHeader title="Plays" actions={canWrite ? <Link className="button-link" to="/play/new">Add Play</Link> : undefined} />

      {rows === null && <p className="type-caption">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <p className="type-title">No plays yet</p>
          <p className="type-caption">Start a play — no account, no setup.</p>
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <ul className="play-list" aria-label="Play history" data-dialog-fallback tabIndex={-1}>
          {rows.map((row) => (
            <PlayRowItem key={row.id} row={row} onDelete={canWrite ? setDeleting : undefined} />
          ))}
        </ul>
      )}

      {deleting && (
        <Dialog
          title={`Delete ${deleting.gameName} play?`}
          message="This removes only this play. Games, score sheets, and saved players stay in place."
          onCancel={() => setDeleting(null)}
        >
          <button type="button" className="destructive-button" onClick={confirmDelete}>Delete play</button>
          <button type="button" onClick={() => setDeleting(null)}>Cancel</button>
        </Dialog>
      )}
    </div>
  );
}
