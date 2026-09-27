import { useCallback, useEffect, useState } from "react";
import { useAccount } from "../account/accountState";
import { PageHeader } from "../components/PageHeader";
import { openWorkspaceDb } from "../storage/scopedDb";
import { keepLocalVersion, listConflicts, useServerVersion, type ConflictRecord } from "../sync/conflicts";

export function Conflicts() {
  const { workspace } = useAccount();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const reload = useCallback(async () => { if (workspace.kind === "account") setConflicts(await listConflicts({ ...workspace, origin: window.location.origin })); }, [workspace]);
  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  if (workspace.kind !== "account") return <div className="page"><PageHeader title="Conflicts" subtitle="Sign in to review synchronized records." /></div>;
  const scope = { ...workspace, origin: window.location.origin };
  return <div className="page"><PageHeader title="Conflicts" parent={{ to: "/account", label: "Account" }} subtitle="Choose a version for each record. Other records continue syncing." />
    {message && <p role="status">{message}</p>}
    {conflicts.length === 0 ? <p>No records need review.</p> : <ul className="play-list">{conflicts.map((conflict) => <li key={conflict.key}>
      <strong>{conflict.entityType} · {conflict.entityId}</strong>
      <p className="type-caption">Mine: {conflict.localDocument ? "edited record" : "deleted"} · Server: {conflict.server.deleted ? "deleted" : `revision ${conflict.server.revision}`}</p>
      <div className="action-row"><button onClick={() => void (async () => { await useServerVersion(await openWorkspaceDb(scope), conflict); await reload(); })()}>Use server</button>
      <button onClick={() => void (async () => { const id = await keepLocalVersion(scope, conflict); setMessage(id === conflict.entityId ? "Your version will retry against the reviewed server revision." : "Your version was saved as an explicit copy."); await reload(); })()}>Keep mine</button></div>
    </li>)}</ul>}
  </div>;
}
