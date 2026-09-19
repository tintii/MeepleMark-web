import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createDraftPlay,
  existingGameByName,
  findOrCreateGame,
  quickPickGames,
  recentPlayerNames,
  writePlay,
  type GameRecord,
} from "../storage/db";
import { applyTemplate } from "../draft/playDraft";
import type { OutcomeMode, WinDirection } from "../engine/models";

interface NewPlayNavState {
  presetGameName?: string;
}

/**
 * `/play/new` — game name (with quick-pick suggestions), dynamic player
 * list (with recent-name suggestions), win direction, outcome mode, and
 * an offer to apply a matched game's saved score sheet. Mirrors
 * NewPlayView.swift: typing alone still completes the flow with no
 * suggestion ever tapped.
 */
export function NewPlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const presetGameName = (location.state as NewPlayNavState | null)?.presetGameName;

  const [gameName, setGameName] = useState(presetGameName ?? "");
  const [playerNames, setPlayerNames] = useState<string[]>(["", ""]);
  const [winDirection, setWinDirection] = useState<WinDirection>("high");
  const [outcome, setOutcome] = useState<OutcomeMode>("ranked");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [gameSuggestions, setGameSuggestions] = useState<GameRecord[]>([]);
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [matchedGame, setMatchedGame] = useState<GameRecord | undefined>(undefined);
  const [useTemplate, setUseTemplate] = useState(false);

  useEffect(() => {
    quickPickGames().then(setGameSuggestions);
    recentPlayerNames().then(setPlayerSuggestions);
  }, []);

  // Task 2.6 equivalent: a read-only lookup as the game name is typed,
  // offering a saved score sheet without creating anything.
  useEffect(() => {
    const trimmed = gameName.trim();
    if (!trimmed) {
      setMatchedGame(undefined);
      return;
    }
    let cancelled = false;
    existingGameByName(trimmed).then((game) => {
      if (!cancelled) setMatchedGame(game);
    });
    return () => {
      cancelled = true;
    };
  }, [gameName]);

  useEffect(() => {
    if (!matchedGame?.localTemplate) setUseTemplate(false);
  }, [matchedGame]);

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((names) => names.map((n, i) => (i === index ? value : n)));
  }

  function addPlayer() {
    setPlayerNames((names) => [...names, ""]);
  }

  function removePlayer(index: number) {
    setPlayerNames((names) => names.filter((_, i) => i !== index));
  }

  function pickPlayerSuggestion(name: string) {
    const emptyIndex = playerNames.findIndex((n) => n.trim() === "");
    if (emptyIndex >= 0) {
      updatePlayerName(emptyIndex, name);
    } else {
      setPlayerNames((names) => [...names, name]);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedGameName = gameName.trim();
    const trimmedNames = playerNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (!trimmedGameName || trimmedNames.length === 0) {
      setError("A game name and at least one player are required.");
      return;
    }
    setSubmitting(true);
    try {
      const game = await findOrCreateGame(trimmedGameName);
      const play = await createDraftPlay({
        gameName: trimmedGameName,
        gameRef: game.id,
        winDirection,
        outcome,
        playerNames: trimmedNames,
      });

      if (useTemplate && game.localTemplate) {
        const templated = applyTemplate(play, game.localTemplate);
        await writePlay(templated);
      }

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
          <input value={gameName} onChange={(e) => setGameName(e.target.value)} list="game-suggestions" />
          <datalist id="game-suggestions">
            {gameSuggestions.map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
        </label>

        {matchedGame?.localTemplate && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
            />
            Use &ldquo;{matchedGame.name}&rdquo;&rsquo;s score sheet (
            {matchedGame.localTemplate.categories.length} categories)
          </label>
        )}

        <fieldset>
          <legend>Players</legend>
          {playerNames.map((name, index) => (
            <div key={index} className="player-row">
              <input
                value={name}
                onChange={(e) => updatePlayerName(index, e.target.value)}
                placeholder={`Player ${index + 1}`}
                list="player-suggestions"
              />
              {playerNames.length > 1 && (
                <button type="button" onClick={() => removePlayer(index)} aria-label={`Remove player ${index + 1}`}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <datalist id="player-suggestions">
            {playerSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {playerSuggestions.length > 0 && (
            <div className="suggestion-row">
              {playerSuggestions.map((name) => (
                <button
                  type="button"
                  key={name}
                  className="suggestion-chip"
                  onClick={() => pickPlayerSuggestion(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
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
