import { openWorkspaceDb, setActiveWorkspace, type AccountWorkspace } from "../storage/scopedDb";

export interface RememberedAccount extends AccountWorkspace {
  protocolVersion: number;
  recoveryEpoch: string;
  username: string;
  displayName: string;
}

const ACTIVE_KEY = "meeplemark:active-workspace";
const LOCKED_KEY = "meeplemark:locked-workspace";
let generation = 0;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function announce(detail: { kind: "activate"; account: RememberedAccount } | { kind: "lock"; accountId: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("meeplemark:workspace", { detail }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("meeplemark-workspace");
    channel.postMessage(detail);
    channel.close();
  }
}

function parseAccount(value: string | null): RememberedAccount | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as RememberedAccount;
    return parsed.kind === "account" && typeof parsed.accountId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function rememberedAccount(): RememberedAccount | null {
  return parseAccount(storage()?.getItem(ACTIVE_KEY) ?? null);
}

export function lockedAccount(): RememberedAccount | null {
  return parseAccount(storage()?.getItem(LOCKED_KEY) ?? null);
}

export async function activateWorkspace(account: RememberedAccount, broadcast = true): Promise<number> {
  const db = await openWorkspaceDb(account);
  const transaction = db.transaction("syncMeta", "readwrite");
  await transaction.objectStore("syncMeta").put({ key: "workspace-lock", locked: false, revokePending: false, updatedAt: new Date().toISOString() });
  await transaction.done;
  storage()?.setItem(ACTIVE_KEY, JSON.stringify(account));
  if (lockedAccount()?.accountId === account.accountId) storage()?.removeItem(LOCKED_KEY);
  setActiveWorkspace(account);
  generation += 1;
  if (broadcast) announce({ kind: "activate", account });
  return generation;
}

export async function lockWorkspace(account: RememberedAccount, revokePending: boolean, broadcast = true): Promise<number> {
  const db = await openWorkspaceDb(account);
  const transaction = db.transaction("syncMeta", "readwrite");
  await transaction.objectStore("syncMeta").put({ key: "workspace-lock", locked: true, revokePending, updatedAt: new Date().toISOString() });
  await transaction.done;
  storage()?.removeItem(ACTIVE_KEY);
  storage()?.setItem(LOCKED_KEY, JSON.stringify(account));
  setActiveWorkspace({ kind: "guest" });
  generation += 1;
  if (broadcast) announce({ kind: "lock", accountId: account.accountId });
  return generation;
}

export function workspaceGeneration(): number {
  return generation;
}

export function isCurrentGeneration(expected: number): boolean {
  return expected === generation;
}

export function onWorkspaceMessage(listener: (message: { kind: "activate"; account: RememberedAccount } | { kind: "lock"; accountId: string }) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const local = (event: Event) => listener((event as CustomEvent).detail);
  window.addEventListener("meeplemark:workspace", local);
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("meeplemark-workspace");
  if (channel) channel.onmessage = (event) => listener(event.data);
  return () => { window.removeEventListener("meeplemark:workspace", local); channel?.close(); };
}

