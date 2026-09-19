import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listGames, type GameRecord } from "../storage/db";

/** `/collection` — owned games, alphabetical. */
export function Collection() {
  const [games, setGames] = useState<GameRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGames().then((all) => {
      if (cancelled) return;
      setGames(all.filter((g) => g.ownedAt != null).sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <h1 className="type-title">Collection</h1>

      {games === null && <p className="type-caption">Loading…</p>}
      {games !== null && games.length === 0 && (
        <p className="type-caption">No games in your collection yet.</p>
      )}
      {games !== null && games.length > 0 && (
        <ul className="play-list">
          {games.map((g) => (
            <li key={g.id}>
              <Link to={`/collection/${g.id}`}>{g.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
