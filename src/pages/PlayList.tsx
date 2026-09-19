import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPlays } from "../storage/db";

interface Row {
  id: string;
  gameName: string;
  playedAt: string;
  status: string;
}

/** `/` — read all plays, sorted by playedAt descending, show game + date + status. */
export function PlayList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlays().then((plays) => {
      if (cancelled) return;
      setRows(plays.map((p) => ({ id: p.id, gameName: p.gameName, playedAt: p.playedAt, status: p.status })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1 className="type-title">Plays</h1>
      <Link to="/play/new">
        <button type="button">New play</button>
      </Link>

      {rows === null && <p className="type-caption">Loading…</p>}
      {rows !== null && rows.length === 0 && <p className="type-caption">No plays recorded yet.</p>}
      {rows !== null && rows.length > 0 && (
        <ul className="play-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/play/${row.id}`}>
                <strong>{row.gameName}</strong> — {new Date(row.playedAt).toLocaleDateString()} — {row.status}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
