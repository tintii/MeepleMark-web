import type { RememberedAccount } from "../account/workspaceCoordinator";
import { csrfToken } from "../account/api";
import { openWorkspaceDb } from "../storage/scopedDb";
import { validateEntityDocument, type EntityType } from "../shared/documents";

export interface AdoptionPreview { games: number; players: number; plays: number; total: number }
export interface AdoptionProgress { staged: number; acknowledged: number; invalid: Array<{ type: EntityType; id: string; issues: unknown }>; changed: string[] }

export function guestWorkspaceId(): string {
  const key = "meeplemark:guest-workspace-id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

export async function adoptionPreview(): Promise<AdoptionPreview> {
  const db = await openWorkspaceDb({ kind: "guest" });
  const [games, players, plays] = await Promise.all([db.count("games"), db.count("players"), db.count("plays")]);
  return { games, players, plays, total: games + players + plays };
}

async function fingerprint(document: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function adoptGuestData(account: RememberedAccount): Promise<AdoptionProgress> {
  if (!account.capabilities.write) throw new Error("This account is read-only. Guest records remain unchanged.");
  const guest = await openWorkspaceDb({ kind: "guest" });
  const destination = await openWorkspaceDb(account);
  const sourceWorkspaceId = guestWorkspaceId();
  const progress: AdoptionProgress = { staged: 0, acknowledged: 0, invalid: [], changed: [] };
  const mappings = new Map<string, string>();
  const groups: Array<{ type: EntityType; values: unknown[] }> = [
    { type: "game", values: await guest.getAll("games") }, { type: "player", values: await guest.getAll("players") }, { type: "play", values: await guest.getAll("plays") },
  ];
  for (const group of groups) {
    for (const raw of group.values) {
      const original = group.type === "play" ? (raw as { play: Record<string, unknown> }).play : raw as Record<string, unknown>;
      const id = String(original.id);
      const issues = validateEntityDocument(group.type, id, original);
      if (issues.length) { progress.invalid.push({ type: group.type, id, issues }); continue; }
      const document = structuredClone(original);
      if (group.type === "play") {
        if (typeof document.gameRef === "string" && mappings.has(`game:${document.gameRef}`)) document.gameRef = mappings.get(`game:${document.gameRef}`);
        if (Array.isArray(document.players)) for (const player of document.players as Array<Record<string, unknown>>) if (typeof player.playerRef === "string" && mappings.has(`player:${player.playerRef}`)) player.playerRef = mappings.get(`player:${player.playerRef}`);
      }
      const item = { entityType: group.type, sourceId: id, sourceFingerprint: await fingerprint(original), document };
      await destination.put("adoptionMappings", { key: `${group.type}:${id}`, state: "staged", item, updatedAt: new Date().toISOString() });
      progress.staged += 1;
      const csrf = csrfToken();
      if (!csrf) throw new Error("Sign in again before adopting guest data.");
      const response = await fetch("/api/v1/adoption", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ context: { protocolVersion: account.protocolVersion, installationId: account.installationId, recoveryEpoch: account.recoveryEpoch, accountId: account.accountId }, sourceWorkspaceId, items: [item] }) });
      if (!response.ok) throw new Error(`Adoption paused (${response.status}). Guest data is unchanged.`);
      const result = (await response.json()).results[0] as { status: string; targetId: string };
      mappings.set(`${group.type}:${id}`, result.targetId);
      await destination.put("adoptionMappings", { key: `${group.type}:${id}`, state: result.status, item, targetId: result.targetId, updatedAt: new Date().toISOString() });
      if (result.status === "changed") progress.changed.push(`${group.type}:${id}`); else progress.acknowledged += 1;
    }
  }
  return progress;
}
