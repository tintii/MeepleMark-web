import { useEffect, useState, type FormEvent } from "react";
import { createPlayer, listPlayers, renamePlayer, type PlayerRecord } from "../storage/db";

/** `/players` — the saved-player directory: add, rename. No BGG network calls. */
export function Players() {
  const [players, setPlayers] = useState<PlayerRecord[] | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bggUsername, setBggUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function reload() {
    const all = await listPlayers();
    setPlayers([...all].sort((a, b) => a.displayName.localeCompare(b.displayName)));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) {
      setError("A display name is required.");
      return;
    }
    try {
      await createPlayer({ displayName, bggUsername: bggUsername.trim() || null });
      setDisplayName("");
      setBggUsername("");
      setError(null);
      reload();
    } catch (err) {
      setError(String(err));
    }
  }

  function startEditing(player: PlayerRecord) {
    setEditingId(player.id);
    setEditingName(player.displayName);
  }

  async function saveRename(player: PlayerRecord) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await renamePlayer(player.id, trimmed);
    setEditingId(null);
    reload();
  }

  return (
    <div className="page">
      <h1 className="type-title">Players</h1>

      <form onSubmit={handleAdd}>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label>
          BGG username (optional)
          <input value={bggUsername} onChange={(e) => setBggUsername(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Add player</button>
      </form>

      {players === null && <p className="type-caption">Loading…</p>}
      {players !== null && players.length === 0 && <p className="type-caption">No saved players yet.</p>}
      {players !== null && players.length > 0 && (
        <ul className="play-list">
          {players.map((p) => (
            <li key={p.id}>
              {editingId === p.id ? (
                <span className="player-row">
                  <input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                  <button type="button" onClick={() => saveRename(p)}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="player-row">
                  <strong>{p.displayName}</strong>
                  {p.bggUsername && <span className="type-caption"> · {p.bggUsername}</span>}
                  <button type="button" onClick={() => startEditing(p)}>
                    Rename
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
