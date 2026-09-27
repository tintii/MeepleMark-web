import { useEffect, useState } from "react";
import { syncStatus, type SyncStatus as Status } from "./client";

export function useSyncStatus(): Status {
  const [status, setStatus] = useState(syncStatus());
  useEffect(() => {
    const update = (event: Event) => setStatus((event as CustomEvent<Status>).detail);
    window.addEventListener("meeplemark:sync-status", update);
    return () => window.removeEventListener("meeplemark:sync-status", update);
  }, []);
  return status;
}
