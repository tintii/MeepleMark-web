import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { setActiveWorkspace } from "../storage/scopedDb";
import { apiJson } from "./api";
import { AccountContext, type WorkspaceState } from "./accountState";
import { activateWorkspace, lockWorkspace, lockedAccount, onWorkspaceMessage, rememberedAccount, type RememberedAccount } from "./workspaceCoordinator";

interface AccountIdentity { accountId: string; username: string; displayName: string; role: "readonly" | "user" | "admin"; capabilities: { write: boolean; admin: boolean } }
interface ServerIdentity { protocolVersion: number; installationId: string; recoveryEpoch: string; setup: { required: boolean }; registration: { enabled: boolean; defaultRole: "readonly" | "user" } }

export function AccountProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>({ kind: "loading" });

  const switchToGuest = useCallback(() => {
    setActiveWorkspace({ kind: "guest" });
    setWorkspace({ kind: "guest" });
  }, []);

  const refresh = useCallback(async (allowUnlock = false) => {
    if (!allowUnlock && lockedAccount()) { switchToGuest(); return; }
    try {
      const [account, server] = await Promise.all([
        apiJson<AccountIdentity>("/api/v1/auth/session"),
        apiJson<ServerIdentity>("/api/v1/meta"),
      ]);
      const coordinated: RememberedAccount = { kind: "account", origin: window.location.origin, ...account, ...server };
      await activateWorkspace(coordinated);
      setWorkspace({ kind: "account", ...account, ...server });
    } catch {
      const remembered = rememberedAccount();
      if (remembered && !lockedAccount()) {
        setActiveWorkspace(remembered);
        setWorkspace(remembered);
      } else {
        switchToGuest();
      }
    }
  }, [switchToGuest]);

  const logoutLocally = useCallback(async (revokePending: boolean) => {
    if (workspace.kind === "account") {
      const account: RememberedAccount = { ...workspace, origin: window.location.origin };
      await lockWorkspace(account, revokePending);
    }
    switchToGuest();
  }, [workspace, switchToGuest]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    const update = () => void refresh();
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    window.addEventListener("meeplemark:permission-denied", update);
    return () => { window.removeEventListener("focus", update); window.removeEventListener("online", update); window.removeEventListener("meeplemark:permission-denied", update); };
  }, [refresh]);
  useEffect(() => onWorkspaceMessage((message) => {
    if (message.kind === "lock") switchToGuest();
    else {
      setActiveWorkspace(message.account);
      setWorkspace(message.account);
    }
  }), [switchToGuest]);
  const value = useMemo(() => ({ workspace, refresh, switchToGuest, logoutLocally }), [workspace, refresh, switchToGuest, logoutLocally]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
