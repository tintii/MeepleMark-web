import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { addToCollection, findOrCreateGame, listGames, type GameRecord } from "../storage/db";
import { GroupedSection, PageHeader } from "../components/PageHeader";
import { useAccount } from "../account/accountState";

/** `/collection` — owned games, alphabetical. */
export function Collection() {
  const { workspace } = useAccount();
  const canWrite = workspace.kind === "guest" || (workspace.kind === "account" && workspace.capabilities.write);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  async function reload(cancelled?: { value: boolean }) {
    const all = await listGames();
    if (!cancelled?.value) setGames(all.filter((g) => g.ownedAt != null).sort((a, b) => a.name.localeCompare(b.name)));
  }

  useEffect(() => {
    const cancelled = { value: false };
    void listGames().then((all) => {
      if (!cancelled.value) setGames(all.filter((game) => game.ownedAt != null).sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => {
      cancelled.value = true;
    };
  }, []);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a game name.");
      return;
    }
    try {
      const game = await findOrCreateGame(name);
      await addToCollection(game.id);
      setName("");
      setError(null);
      await reload();
    } catch {
      setError("The game could not be added. Please try again.");
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Collection"
        subtitle="Games you own, whether played yet or not."
        actions={canWrite ? <button className="mobile-add-action mobile-only" type="button" aria-label="Go to add game form" onClick={() => nameInput.current?.focus()}>Add game</button> : undefined}
      />

      {canWrite ? <GroupedSection title="Add a game">
        <form onSubmit={handleAdd} className="inline-form">
          <label className="field">
            <span className="field-label">Game name</span>
            <input ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="submit">Add to collection</button>
        </form>
      </GroupedSection> : <p className="type-caption">This account is read-only. Your downloaded collection is available to browse.</p>}

      {games === null && <p className="type-caption">Loading…</p>}
      {games !== null && games.length === 0 && (
        <p className="type-caption">No games in your collection yet.</p>
      )}
      {games !== null && games.length > 0 && (
        <ul className="play-list" aria-label="Owned games">
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
