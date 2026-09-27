import { useEffect, useState } from "react";
import type { RememberedAccount } from "../account/workspaceCoordinator";
import { adoptionPreview, adoptGuestData, type AdoptionPreview, type AdoptionProgress } from "../adoption/adoption";

export function AdoptionPanel({ account }: { account: RememberedAccount }) {
  const [preview, setPreview] = useState<AdoptionPreview | null>(null);
  const [progress, setProgress] = useState<AdoptionProgress | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => void adoptionPreview().then(setPreview), 0); return () => clearTimeout(timer); }, []);
  if (!preview || preview.total === 0 || skipped) return null;
  return <section className="grouped-section"><h2 className="section-heading">Guest data</h2><div className="grouped-section-body">
    <p>Copy into <strong>{account.displayName}</strong>: {preview.games} games, {preview.players} players, {preview.plays} plays. Guest originals remain available.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {progress && <p role="status">Server acknowledged {progress.acknowledged} of {progress.staged}. Invalid: {progress.invalid.length}. Changed since prior adoption: {progress.changed.length}.</p>}
    <div className="action-row"><button type="button" onClick={() => void adoptGuestData(account).then(setProgress).catch((reason) => setError(String(reason)))}>Copy guest data</button><button type="button" onClick={() => setSkipped(true)}>Skip</button></div>
  </div></section>;
}

