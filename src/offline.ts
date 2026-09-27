import { registerSW } from "virtual:pwa-register";

export type OfflineEvent = "ready" | "update";
let updateWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let currentStatus: OfflineEvent | null = null;

function announce(kind: OfflineEvent) {
  currentStatus = kind;
  window.dispatchEvent(new CustomEvent<OfflineEvent>("meeplemark:offline", { detail: kind }));
}

export function offlineStatus(): OfflineEvent | null { return currentStatus; }

export function setupOfflineShell(): void {
  if (!import.meta.env.PROD) return;
  const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!window.isSecureContext && !local) return;
  updateWorker = registerSW({
    immediate: true,
    onOfflineReady: () => announce("ready"),
    onNeedRefresh: () => announce("update"),
    onRegisterError: () => {
      // No readiness claim is made when registration or precaching fails.
    },
  });
}

export async function acceptOfflineUpdate(): Promise<void> {
  await updateWorker?.(true);
}
