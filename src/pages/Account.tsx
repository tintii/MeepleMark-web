import { useEffect, useState, type FormEvent } from "react";
import { GroupedSection, PageHeader } from "../components/PageHeader";
import { apiJson, csrfToken } from "../account/api";
import { useAccount } from "../account/accountState";
import { SyncStatusPanel } from "../components/SyncStatus";
import { Link } from "react-router-dom";
import { AdoptionPanel } from "../components/AdoptionPanel";
import { WorkspaceExportSection } from "../components/WorkspaceExportSection";

export function Account() {
  const { workspace, refresh, switchToGuest, logoutLocally } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [installation, setInstallation] = useState<{ setup: { required: boolean }; registration: { enabled: boolean; defaultRole: "readonly" | "user" } } | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  useEffect(() => { if (workspace.kind === "guest") void apiJson<{ setup: { required: boolean }; registration: { enabled: boolean; defaultRole: "readonly" | "user" } }>("/api/v1/meta").then(setInstallation).catch(() => setInstallation(null)); }, [workspace.kind]);

  const submit = async (operation: () => Promise<unknown>, allowUnlock = false): Promise<void> => {
    setBusy(true);
    setError(null);
    try { await operation(); await refresh(allowUnlock); } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed."); } finally { setBusy(false); }
  };

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void submit(() => apiJson("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username: data.get("username"), password: data.get("password") }) }), true);
  };
  const setup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void submit(() => apiJson("/api/v1/auth/setup", { method: "POST", body: JSON.stringify({ code: data.get("code"), password: data.get("password") }) }), true);
  };
  const register = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void submit(() => apiJson("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ username: data.get("username"), displayName: data.get("displayName") || undefined, password: data.get("password") }) }), true);
  };
  const changePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const csrf = csrfToken();
    if (!csrf) { setError("Sign in again before changing your password."); return; }
    void submit(() => apiJson("/api/v1/auth/password", { method: "POST", headers: { "X-CSRF-Token": csrf }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }));
  };
  const logout = () => {
    const csrf = csrfToken();
    void (async () => {
      setBusy(true);
      setError(null);
      await logoutLocally(true);
      if (csrf) {
        try {
          await apiJson("/api/v1/auth/logout", { method: "POST", headers: { "X-CSRF-Token": csrf } });
          await logoutLocally(false);
        } catch {
          // The locked partition records revoke-pending for the next deliberate sign-in.
        }
      }
      setBusy(false);
    })();
  };

  if (workspace.kind === "loading") return <div className="page"><PageHeader title="Account" subtitle="Checking this installation…" /></div>;

  return (
    <div className="page">
      <PageHeader title="Account" subtitle={workspace.kind === "account" ? `Using ${workspace.displayName}'s synchronized workspace.` : "Using the local guest workspace."} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <WorkspaceExportSection />
      {workspace.kind === "guest" ? (
        <>
          {installation?.setup.required ? <GroupedSection title="Finish installation setup">
            <p>Create the first administrator in the browser before opening this server to other people.</p>
            <Link className="button-link" to="/setup">Create first administrator</Link>
          </GroupedSection> : <GroupedSection title="Create account">
            {installation?.registration.enabled ? <form onSubmit={register}>
              <label className="field"><span className="field-label">Username</span><input name="username" autoComplete="username" minLength={3} maxLength={64} required /></label>
              <label className="field"><span className="field-label">Display name <span className="field-hint">(optional)</span></span><input name="displayName" autoComplete="name" maxLength={128} /></label>
              <label className="field"><span className="field-label">Password</span><input name="password" type="password" minLength={12} maxLength={1024} autoComplete="new-password" required /><span className="field-hint">Use at least 12 characters.</span></label>
              <button disabled={busy || !navigator.onLine} type="submit">Create account</button>
              {!navigator.onLine && <p className="type-caption">Connect to this server to create an account. Guest scoring remains available offline.</p>}
            </form> : <p>Registration is currently closed. You can still sign in or continue as a guest.</p>}
          </GroupedSection>}
          <GroupedSection title="Sign in">
            <form onSubmit={login}>
              <label className="field"><span className="field-label">Username</span><input name="username" autoComplete="username" required /></label>
              <label className="field"><span className="field-label">Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
              <button disabled={busy} type="submit">Sign in</button>
            </form>
          </GroupedSection>
          <GroupedSection title="Activation or password recovery">
            <p className="type-caption">Email recovery is not available. Ask an administrator for a one-use code if you need to activate an operator-created account or reset your password.</p>
            <button type="button" aria-expanded={showRecovery} onClick={() => setShowRecovery((value) => !value)}>{showRecovery ? "Hide code form" : "Use a recovery or activation code"}</button>
            {showRecovery && <form onSubmit={setup}>
              <label className="field"><span className="field-label">Setup code</span><input name="code" autoComplete="one-time-code" required /></label>
              <label className="field"><span className="field-label">New password</span><input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
              <button disabled={busy} type="submit">Set password and sign in</button>
            </form>}
          </GroupedSection>
          <p><button type="button" onClick={switchToGuest}>Continue as guest</button></p>
        </>
      ) : (
        <>
          <GroupedSection title="Workspace">
            <dl className="account-facts"><div><dt>Account</dt><dd>{workspace.username}</dd></div><div><dt>Role</dt><dd>{workspace.role}</dd></div><div><dt>Installation</dt><dd>{workspace.installationId}</dd></div></dl>
            {!workspace.capabilities.write && <p className="form-error" role="status">This account is read-only. You can browse downloaded records; pending edits remain held locally.</p>}
            <SyncStatusPanel action />
            <p><Link to="/conflicts">Review conflicts</Link></p>
            {workspace.capabilities.admin && <p><Link className="button-link" to="/admin">Open administration</Link></p>}
          </GroupedSection>
          <AdoptionPanel account={{ ...workspace, kind: "account", origin: window.location.origin }} />
          <GroupedSection title="Change password">
            <form onSubmit={changePassword}>
              <label className="field"><span className="field-label">Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <label className="field"><span className="field-label">New password</span><input name="newPassword" type="password" minLength={12} autoComplete="new-password" required /></label>
              <button disabled={busy} type="submit">Change password</button>
            </form>
          </GroupedSection>
          <button type="button" onClick={logout} disabled={busy}>Sign out</button>
        </>
      )}
    </div>
  );
}
