import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPlaySummaries, type PlaySummary } from "../storage/db";
import { PlayRowItem } from "../components/PlayRowItem";

/** `/` — every play, most recent first, with each row's winner line once complete. */
export function PlayList() {
  const [rows, setRows] = useState<PlaySummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlaySummaries().then((summaries) => {
      if (!cancelled) setRows(summaries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1 className="type-title">Plays</h1>
      <Link to="/play/new">
        <button type="button">Add Play</button>
      </Link>

      {rows === null && <p className="type-caption">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <div className="empty-state">
          <p className="type-title">No plays yet</p>
          <p className="type-caption">Start a play — no account, no setup.</p>
        </div>
      )}
      {rows !== null && rows.length > 0 && (
        <ul className="play-list">
          {rows.map((row) => (
            <PlayRowItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}
