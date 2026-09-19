import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { readPlay, writePlay } from "../storage/db";
import type { Play } from "../engine/models";
import { evaluate } from "../engine/evaluate";
import { decimalFromString } from "../engine/decimal";

/**
 * `/play/:id` — the scoring screen. Plain mode only for this phase (no
 * template/category grid yet): one row per player with a raw score input,
 * live-recomputed rank/total via evaluate() shown next to each row.
 */
export function PlayScoring() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [play, setPlay] = useState<Play | null>(null);
  const [scoreInputs, setScoreInputs] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    readPlay(id)
      .then((loaded) => {
        if (cancelled) return;
        setPlay(loaded);
        setScoreInputs(loaded.players.map((p) => (p.total != null ? p.total.toFixed() : "")));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const result = useMemo(() => (play ? evaluate(play) : null), [play]);

  if (loadError) return <p role="alert">Could not load play: {loadError}</p>;
  if (!play) return <p className="type-caption">Loading…</p>;

  function updateScore(index: number, value: string) {
    setScoreInputs((inputs) => inputs.map((v, i) => (i === index ? value : v)));
    setPlay((current) => {
      if (!current) return current;
      const parsed = value.trim() === "" ? null : decimalFromString(value);
      const players = current.players.map((player, i) =>
        i === index ? { ...player, total: parsed, totalIsOverridden: false } : player,
      );
      return { ...current, players };
    });
  }

  async function handleComplete() {
    if (!play) return;
    setSaving(true);
    try {
      const completed: Play = { ...play, status: "complete" };
      await writePlay(completed);
      navigate("/");
    } catch (err) {
      setLoadError(String(err));
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1 className="type-title">{play.gameName}</h1>
      <p className="type-caption">
        {new Date(play.playedAt).toLocaleString()} · {play.status}
      </p>

      <table className="score-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {play.players.map((player, index) => (
            <tr key={index}>
              <td>{player.name}</td>
              <td>
                <input
                  className="tabular-nums"
                  inputMode="decimal"
                  value={scoreInputs[index] ?? ""}
                  onChange={(e) => updateScore(index, e.target.value)}
                  aria-label={`${player.name}'s score`}
                />
              </td>
              <td className="tabular-nums">{result?.players[index]?.rank ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result && result.warnings.length > 0 && (
        <ul className="warnings">
          {result.warnings.map((warning, i) => (
            <li key={i}>{warning.message}</li>
          ))}
        </ul>
      )}

      <button type="button" onClick={handleComplete} disabled={play.status === "complete" || saving}>
        Complete
      </button>
    </div>
  );
}
