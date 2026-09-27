import { useCallback, useEffect } from "react";
import { useAccount } from "../account/accountState";
import type { RememberedAccount } from "../account/workspaceCoordinator";
import { syncNow, type SyncStatus as Status } from "../sync/client";
import { useSyncStatus } from "../sync/useSyncStatus";

const LABELS: Record<Status, string> = {
  idle: "Saved on this device", pending: "Waiting to sync", syncing: "Syncing…", synced: "Synced with server",
  conflicted: "Needs conflict review", reauthenticate: "Sign in again to sync", offline: "Offline — saved on this device",
  recovery: "Server recovery needs review", error: "Sync unavailable — saved on this device",
};

export function SyncCoordinator() {
  const { workspace } = useAccount();
  const trigger = useCallback(() => {
    if (workspace.kind !== "account") return;
    const account: RememberedAccount = { ...workspace, kind: "account", origin: window.location.origin };
    void syncNow(account);
  }, [workspace]);
  useEffect(() => {
    if (workspace.kind !== "account") return;
    const initial = window.setTimeout(trigger, 250);
    const poll = window.setInterval(trigger, 30_000);
    window.addEventListener("online", trigger);
    window.addEventListener("focus", trigger);
    window.addEventListener("meeplemark:local-change", trigger);
    return () => {
      window.clearTimeout(initial); window.clearInterval(poll);
      window.removeEventListener("online", trigger); window.removeEventListener("focus", trigger); window.removeEventListener("meeplemark:local-change", trigger);
    };
  }, [workspace.kind, trigger]);
  return null;
}

export function SyncStatusPanel({ action = false }: { action?: boolean }) {
  const { workspace } = useAccount();
  const status = useSyncStatus();
  if (workspace.kind !== "account") return null;
  const account: RememberedAccount = { ...workspace, kind: "account", origin: window.location.origin };
  return <div className="sync-panel"><p className="save-status" role="status">{LABELS[status]}</p>{action && <button type="button" onClick={() => void syncNow(account)}>Sync now</button>}</div>;
}
