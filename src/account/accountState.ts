import { createContext, useContext } from "react";

export type AccountRole = "readonly" | "user" | "admin";
export interface AccountCapabilities { write: boolean; admin: boolean }
interface AccountIdentity { accountId: string; username: string; displayName: string; role: AccountRole; capabilities: AccountCapabilities }
interface ServerIdentity { protocolVersion: number; installationId: string; recoveryEpoch: string; setup: { required: boolean }; registration: { enabled: boolean; defaultRole: "readonly" | "user" } }
export type WorkspaceState =
  | { kind: "loading" }
  | { kind: "guest" }
  | ({ kind: "account" } & AccountIdentity & ServerIdentity);

export interface AccountContextValue {
  workspace: WorkspaceState;
  refresh(allowUnlock?: boolean): Promise<void>;
  switchToGuest(): void;
  logoutLocally(revokePending: boolean): Promise<void>;
}

export const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}
