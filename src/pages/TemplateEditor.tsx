import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteTemplate, getGame, setTemplate, type GameRecord } from "../storage/db";
import { TemplateValidation } from "../engine/validation";
import { buildTemplateCandidate } from "../draft/templateCandidate";
import type { OutcomeMode, WinDirection } from "../engine/models";

const CATEGORY_CAP = 10;

/**
 * `/collection/:gameId/template` — author or edit a game's local category
 * set. Mirrors TemplateEditorView.swift. Runs `TemplateValidation` over a
 * candidate document before saving, so a bad shape shows inline rather
 * than throwing from `setTemplate`.
 */
export function TemplateEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<GameRecord | null | undefined>(undefined);
  const [labels, setLabels] = useState<string[]>(["", ""]);
  const [winDirection, setWinDirection] = useState<WinDirection>("high");
  const [defaultOutcome, setDefaultOutcome] = useState<OutcomeMode>("ranked");
  const [issues, setIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    getGame(gameId).then((g) => {
      setGame(g ?? null);
      if (g?.localTemplate) {
        setLabels(g.localTemplate.categories.map((c) => c.label));
        setWinDirection(g.localTemplate.winDirection);
        setDefaultOutcome(g.localTemplate.defaultOutcome);
      }
    });
  }, [gameId]);

  if (game === undefined) {
    return (
      <div className="page">
        <p className="type-caption">Loading…</p>
      </div>
    );
  }
  if (game === null) {
    return (
      <div className="page">
        <p role="alert">Game not found.</p>
      </div>
    );
  }

  function updateLabel(index: number, value: string) {
    setLabels((ls) => ls.map((l, i) => (i === index ? value : l)));
  }

  function addCategory() {
    setLabels((ls) => (ls.length >= CATEGORY_CAP ? ls : [...ls, ""]));
  }

  function removeCategory(index: number) {
    setLabels((ls) => (ls.length > 1 ? ls.filter((_, i) => i !== index) : ls));
  }

  const currentGame = game; // narrowed non-null; closures below capture this, not `game`

  async function handleSave(event: FormEvent) {
    event.preventDefault();

    // A lighter-touch check: a candidate document run through
    // TemplateValidation so a shape problem (empty/too many categories)
    // surfaces inline instead of as a thrown error from setTemplate.
    const candidate = buildTemplateCandidate(
      currentGame.id,
      currentGame.localTemplate?.version ?? 0,
      labels,
      winDirection,
      defaultOutcome,
    );
    const validationIssues = TemplateValidation.validate(candidate);
    if (validationIssues.length > 0) {
      setIssues(validationIssues.map((issue) => issue.message));
      return;
    }

    setSaving(true);
    try {
      await setTemplate(currentGame.id, labels, winDirection, defaultOutcome);
      setIssues([]);
      navigate(`/collection/${currentGame.id}`);
    } catch (err) {
      setIssues([String(err)]);
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteTemplate(currentGame.id);
    navigate(`/collection/${currentGame.id}`);
  }

  return (
    <div className="page">
      <h1 className="type-title">Score sheet — {game.name}</h1>
      <form onSubmit={handleSave}>
        <fieldset>
          <legend>Categories</legend>
          {labels.map((label, index) => (
            <div key={index} className="player-row">
              <input
                value={label}
                onChange={(e) => updateLabel(index, e.target.value)}
                placeholder={`Category ${index + 1}`}
              />
              {labels.length > 1 && (
                <button type="button" onClick={() => removeCategory(index)} aria-label={`Remove category ${index + 1}`}>
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addCategory} disabled={labels.length >= CATEGORY_CAP}>
            Add category
          </button>
          <p className="type-caption">Up to {CATEGORY_CAP} categories.</p>
        </fieldset>

        <label>
          Win direction
          <select value={winDirection} onChange={(e) => setWinDirection(e.target.value as WinDirection)}>
            <option value="high">High score wins</option>
            <option value="low">Low score wins</option>
          </select>
        </label>

        <label>
          Outcome
          <select value={defaultOutcome} onChange={(e) => setDefaultOutcome(e.target.value as OutcomeMode)}>
            <option value="ranked">Ranked</option>
            <option value="flagged">Cooperative / solo (win or lose)</option>
          </select>
        </label>

        {issues.length > 0 && (
          <ul className="warnings">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}

        <button type="submit" disabled={saving}>
          Save
        </button>
      </form>

      {game.localTemplate != null && (
        <button type="button" className="destructive-button" onClick={handleDelete}>
          Delete score sheet
        </button>
      )}
    </div>
  );
}
