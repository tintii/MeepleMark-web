import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createDraftPlay,
  existingGameByName,
  findOrCreateGame,
  gameSuggestions,
  playerSuggestions,
  type GameRecord,
  type GameSuggestion,
  type PlayerSuggestion,
} from "../storage/db";
import type { OutcomeMode, WinDirection } from "../engine/models";
import { GroupedSection, PageHeader } from "../components/PageHeader";

interface NewPlayNavState { presetGameName?: string }
interface SeatInput { name: string; playerRef: string | null }

export function NewPlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const presetGameName = (location.state as NewPlayNavState | null)?.presetGameName;
  const [gameName, setGameName] = useState(presetGameName ?? "");
  const [seats, setSeats] = useState<SeatInput[]>([{ name: "", playerRef: null }, { name: "", playerRef: null }]);
  const [winDirection, setWinDirection] = useState<WinDirection>("high");
  const [outcome, setOutcome] = useState<OutcomeMode>("ranked");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [games, setGames] = useState<GameSuggestion[]>([]);
  const [players, setPlayers] = useState<PlayerSuggestion[]>([]);
  const [matchedGame, setMatchedGame] = useState<GameRecord | undefined>();
  const [useTemplate, setUseTemplate] = useState(false);
  const selectedTemplate = useTemplate ? matchedGame?.localTemplate : null;

  useEffect(() => {
    void gameSuggestions().then(setGames);
    void playerSuggestions().then(setPlayers);
  }, []);

  useEffect(() => {
    const trimmed = gameName.trim();
    let cancelled = false;
    void existingGameByName(trimmed).then((game) => { if (!cancelled) setMatchedGame(game); });
    return () => { cancelled = true; };
  }, [gameName]);

  function updateSeat(index: number, name: string) {
    setSeats((current) => current.map((seat, seatIndex) => seatIndex === index ? { name, playerRef: null } : seat));
  }

  function pickPlayer(suggestion: PlayerSuggestion) {
    setSeats((current) => {
      const emptyIndex = current.findIndex((seat) => seat.name.trim() === "");
      const selected = { name: suggestion.name, playerRef: suggestion.id };
      return emptyIndex >= 0
        ? current.map((seat, index) => index === emptyIndex ? selected : seat)
        : [...current, selected];
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedGameName = gameName.trim();
    const selectedSeats = seats.map((seat) => ({ ...seat, name: seat.name.trim() })).filter((seat) => seat.name);
    if (!trimmedGameName || selectedSeats.length === 0) {
      setError("Enter a game name and at least one player.");
      return;
    }
    setSubmitting(true);
    try {
      const game = await findOrCreateGame(trimmedGameName);
      const play = await createDraftPlay({
        gameName: game.name,
        gameRef: game.id,
        winDirection,
        outcome,
        seats: selectedSeats,
        template: useTemplate ? game.localTemplate : null,
      });
      navigate(`/play/${play.id}`);
    } catch {
      setError("The play could not be saved. Your selections are still here; please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="New play" parent={{ to: "/", label: "Plays" }} />
      <form onSubmit={handleSubmit}>
        <GroupedSection title="Game">
          <label className="field"><span className="field-label">Game name</span><input value={gameName} onChange={(event) => { setGameName(event.target.value); setUseTemplate(false); }} autoComplete="off" /></label>
          {games.length > 0 && <div className="suggestion-row" aria-label="Game suggestions">{games.map((game) => <button type="button" key={`${game.gameRef ?? "history"}:${game.name}`} className="suggestion-chip" onClick={() => setGameName(game.name)}>{game.name}</button>)}</div>}
          {matchedGame?.localTemplate && (
            <label className="checkbox-row"><input type="checkbox" checked={useTemplate} onChange={(event) => setUseTemplate(event.target.checked)} />Use “{matchedGame.name}” score sheet ({matchedGame.localTemplate.categories.length} categories)</label>
          )}
        </GroupedSection>

        <GroupedSection title="Players">
          {seats.map((seat, index) => (
            <div key={index} className="player-row">
              <label className="field seat-field"><span className="field-label">Player {index + 1}</span><input value={seat.name} onChange={(event) => updateSeat(index, event.target.value)} aria-describedby={seat.playerRef ? `seat-${index}-identity` : undefined} /></label>
              {seat.playerRef && <span id={`seat-${index}-identity`} className="selected-identity">Saved player selected</span>}
              {seats.length > 1 && <button type="button" onClick={() => setSeats((current) => current.filter((_, seatIndex) => seatIndex !== index))} aria-label={`Remove player ${index + 1}`}>Remove</button>}
            </div>
          ))}
          {players.length > 0 && (
            <div className="suggestion-row" aria-label="Player suggestions">
              {players.map((player, index) => <button type="button" key={player.id ?? `recent:${player.name}:${index}`} className="suggestion-chip" onClick={() => pickPlayer(player)}>{player.name}{player.username ? ` (${player.username})` : ""}{player.id ? " · Saved" : " · Recent"}</button>)}
            </div>
          )}
          <button type="button" onClick={() => setSeats((current) => [...current, { name: "", playerRef: null }])}>Add player</button>
        </GroupedSection>

        <GroupedSection title="Rules">
          <label className="field"><span className="field-label">Win direction</span><select value={selectedTemplate?.winDirection ?? winDirection} onChange={(event) => setWinDirection(event.target.value as WinDirection)} disabled={useTemplate}><option value="high">Highest score wins</option><option value="low">Lowest score wins</option></select></label>
          <label className="field"><span className="field-label">Outcome</span><select value={selectedTemplate?.defaultOutcome ?? outcome} onChange={(event) => setOutcome(event.target.value as OutcomeMode)} disabled={useTemplate}><option value="ranked">Ranked</option><option value="flagged">Win / loss</option></select></label>
          {useTemplate && <p className="field-hint">The selected score sheet supplies these rules.</p>}
        </GroupedSection>

        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Start play"}</button>
      </form>
    </div>
  );
}
