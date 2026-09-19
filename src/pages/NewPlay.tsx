import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createDraftPlay } from "../storage/db";
import type { OutcomeMode, WinDirection } from "../engine/models";

/** `/play/new` — bare form: game name, dynamic player list, win direction, outcome mode. */
export function NewPlay() {
  const navigate = useNavigate();
  const [gameName, setGameName] = useState("");
  const [playerNames, setPlayerNames] = useState<string[]>(["", ""]);
  const [winDirection, setWinDirection] = useState<WinDirection>("high");
  const [outcome, setOutcome] = useState<OutcomeMode>("ranked");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((names) => names.map((n, i) => (i === index ? value : n)));
  }

  function addPlayer() {
    setPlayerNames((names) => [...names, ""]);
  }

  function removePlayer(index: number) {
    setPlayerNames((names) => names.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedNames = playerNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (!gameName.trim() || trimmedNames.length === 0) {
      setError("A game name and at least one player are required.");
      return;
    }
    setSubmitting(true);
    try {
      const play = await createDraftPlay({
        gameName: gameName.trim(),
        winDirection,
        outcome,
        playerNames: trimmedNames,
      });
      navigate(`/play/${play.id}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1 className="type-title">New play</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Game name
          <input value={gameName} onChange={(e) => setGameName(e.target.value)} />
        </label>

        <fieldset>
          <legend>Players</legend>
          {playerNames.map((name, index) => (
            <div key={index} className="player-row">
              <input
                value={name}
                onChange={(e) => updatePlayerName(index, e.target.value)}
                placeholder={`Player ${index + 1}`}
              />
              {playerNames.length > 1 && (
                <button type="button" onClick={() => removePlayer(index)} aria-label={`Remove player ${index + 1}`}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addPlayer}>
            Add player
          </button>
        </fieldset>

        <label>
          Win direction
          <select value={winDirection} onChange={(e) => setWinDirection(e.target.value as WinDirection)}>
            <option value="high">Highest score wins</option>
            <option value="low">Lowest score wins</option>
          </select>
        </label>

        <label>
          Outcome
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeMode)}>
            <option value="ranked">Ranked</option>
            <option value="flagged">Win / loss (flagged)</option>
          </select>
        </label>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting}>
          Start play
        </button>
      </form>
    </div>
  );
}
