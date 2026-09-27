import { useEffect, useState } from "react";
import { acceptOfflineUpdate, offlineStatus, type OfflineEvent } from "../offline";

export function OfflineStatus() {
  const [status, setStatus] = useState<OfflineEvent | null>(() => offlineStatus());
  const [safeToReload, setSafeToReload] = useState(true);

  useEffect(() => {
    const offline = (event: Event) => setStatus((event as CustomEvent<OfflineEvent>).detail);
    const persistence = (event: Event) => setSafeToReload((event as CustomEvent<boolean>).detail);
    window.addEventListener("meeplemark:offline", offline);
    window.addEventListener("meeplemark:persistence-safe", persistence);
    return () => {
      window.removeEventListener("meeplemark:offline", offline);
      window.removeEventListener("meeplemark:persistence-safe", persistence);
    };
  }, []);

  if (status === null) return null;
  if (status === "ready") return <p className="offline-status" role="status">Ready for offline use</p>;
  return (
    <aside className="update-status" aria-label="App update">
      <span>A new app shell is ready.</span>
      <button type="button" disabled={!safeToReload} onClick={() => void acceptOfflineUpdate()}>
        {safeToReload ? "Update and reload" : "Save your play before updating"}
      </button>
    </aside>
  );
}
