import { Link } from "react-router-dom";
import type { PlayStatus } from "../engine/models";

/**
 * One row's worth of display data — shared shape between the play list
 * and a game's play history, so "how a play summarizes itself" lives in
 * exactly one place. Structurally compatible with `PlaySummary`
 * (src/storage/db.ts); kept separate so this component doesn't force a
 * storage-layer import on every caller.
 */
export interface PlayRowData {
  id: string;
  gameName: string;
  playedAt: string;
  status: PlayStatus;
  playerCount: number | null;
  winnerLine: string | null;
  unreadable: boolean;
}

/**
 * One row: game name, date, player count, status, and — only when
 * `status === "complete"` — the winner line. A draft never claims a
 * result (its rank can still change with the next keystroke), and a
 * corrupted play surfaces as "Unreadable" rather than a fabricated count
 * (mirrors PlayRowView.swift).
 */
export function PlayRowItem({ row }: { row: PlayRowData }) {
  return (
    <li className="play-row">
      <Link to={`/play/${row.id}`} className="play-row-link">
        <div className="play-row-main">
          <strong>{row.gameName}</strong>
          <span className="type-caption">{new Date(row.playedAt).toLocaleDateString()}</span>
        </div>
        <div className="play-row-meta">
          {row.unreadable ? (
            <span className="type-caption warning-text">Unreadable</span>
          ) : (
            <>
              {row.winnerLine && <span className="type-caption">{row.winnerLine}</span>}
              <span className="type-caption">{row.playerCount} players</span>
            </>
          )}
          {row.status === "draft" && <span className="badge-draft">Draft</span>}
        </div>
      </Link>
    </li>
  );
}
