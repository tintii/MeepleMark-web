import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { acceptOfflineUpdate, offlineStatus, type OfflineEvent } from "../offline";

function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineEvent | null>(() => offlineStatus());

  useEffect(() => {
    const offline = (event: Event) => setStatus((event as CustomEvent<OfflineEvent>).detail);
    window.addEventListener("meeplemark:offline", offline);
    return () => window.removeEventListener("meeplemark:offline", offline);
  }, []);

  return status;
}

export function OfflineReadyIndicator() {
  const status = useOfflineStatus();
  const [open, setOpen] = useState(false);
  if (status !== "ready") return null;

  return (
    <div className={`offline-ready${open ? " is-open" : ""}`}>
      <span className="visually-hidden" role="status">Ready for offline use</span>
      <button
        className="offline-ready-trigger"
        type="button"
        aria-label="Offline use status: ready"
        aria-expanded={open}
        aria-controls="offline-ready-card"
        title="Ready for offline use"
        onClick={() => setOpen((visible) => !visible)}
      >
        <span className="offline-ready-dot" aria-hidden="true" />
      </button>
      <div className="offline-ready-card" id="offline-ready-card">
        <strong>Ready for offline use</strong>
        <p>The app is cached on this device. Local scoring works without a connection; account changes sync when you reconnect.</p>
        <Link to="/help/offline" onClick={() => setOpen(false)}>How offline use works</Link>
      </div>
    </div>
  );
}

export function OfflineUpdateStatus() {
  const status = useOfflineStatus();
  const [safeToReload, setSafeToReload] = useState(true);

  useEffect(() => {
    const persistence = (event: Event) => setSafeToReload((event as CustomEvent<boolean>).detail);
    window.addEventListener("meeplemark:persistence-safe", persistence);
    return () => window.removeEventListener("meeplemark:persistence-safe", persistence);
  }, []);

  if (status !== "update") return null;
  return (
    <aside className="update-status" aria-label="App update">
      <span>A new app shell is ready.</span>
      <button type="button" disabled={!safeToReload} onClick={() => void acceptOfflineUpdate()}>
        {safeToReload ? "Update and reload" : "Save your play before updating"}
      </button>
    </aside>
  );
}
