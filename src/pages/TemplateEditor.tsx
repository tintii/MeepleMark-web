import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteTemplate, getGame, setTemplate, type GameRecord } from "../storage/db";
import { TemplateValidation } from "../engine/validation";
import { buildTemplateCandidate } from "../draft/templateCandidate";
import type { OutcomeMode, WinDirection } from "../engine/models";
import { PageHeader } from "../components/PageHeader";
import { readScoreSheetFile } from "../draft/scoreSheetPortability";
import { FailurePage } from "../components/FailurePage";

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
  const importInput = useRef<HTMLInputElement>(null);

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
    return <FailurePage code={404} title="Game not found" explanation="This game is not available, so its score sheet cannot be edited." actions={<Link className="button-link primary-button" to="/collection">Collection</Link>} />;
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

  function moveCategory(index: number, direction: -1 | 1) {
    setLabels((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
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

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = await readScoreSheetFile(file);
      setLabels(imported.categories.map((category) => category.label));
      setWinDirection(imported.winDirection);
      setDefaultOutcome(imported.defaultOutcome);
      setIssues([]);
    } catch (error) {
      setIssues([error instanceof Error ? error.message : "The score sheet file could not be imported."]);
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="page">
      <PageHeader title={`Score sheet — ${game.name}`} parent={{ to: `/collection/${game.id}`, label: game.name }} />
      <div className="field inline-field">
        <span id="score-sheet-import-label" className="field-label">Import score sheet JSON</span>
        <input ref={importInput} className="visually-hidden" type="file" accept=".json,application/json" aria-labelledby="score-sheet-import-label" onChange={handleImport} />
        <button type="button" onClick={() => importInput.current?.click()}>Choose file</button>
      </div>
      <form onSubmit={handleSave}>
        <fieldset>
          <legend>Categories</legend>
          {labels.map((label, index) => (
            <div key={index} className="player-row">
              <input
                value={label}
                onChange={(e) => updateLabel(index, e.target.value)}
                placeholder={`Category ${index + 1}`}
                aria-label={`Category ${index + 1} label`}
              />
              <button type="button" onClick={() => moveCategory(index, -1)} disabled={index === 0} aria-label={`Move category ${index + 1} up`}>Move up</button>
              <button type="button" onClick={() => moveCategory(index, 1)} disabled={index === labels.length - 1} aria-label={`Move category ${index + 1} down`}>Move down</button>
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

        <label className="field inline-field">
          <span className="field-label">Win direction</span>
          <select value={winDirection} onChange={(e) => setWinDirection(e.target.value as WinDirection)}>
            <option value="high">High score wins</option>
            <option value="low">Low score wins</option>
          </select>
        </label>

        <label className="field inline-field">
          <span className="field-label">Outcome</span>
          <select value={defaultOutcome} onChange={(e) => setDefaultOutcome(e.target.value as OutcomeMode)}>
            <option value="ranked">Ranked</option>
            <option value="flagged">Cooperative / solo (win or lose)</option>
          </select>
        </label>

        {issues.length > 0 && (
          <ul className="warnings" role="alert">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}

        <div className="score-sheet-actions">
          <button type="submit" disabled={saving}>
            Save
          </button>
          {game.localTemplate != null && (
            <button type="button" className="destructive-button" onClick={handleDelete}>
              Delete score sheet
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
