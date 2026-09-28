import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { apiJson, csrfToken } from "../account/api";
import { useAccount } from "../account/accountState";
import { Dialog } from "../components/Dialog";
import { GroupedSection, PageHeader } from "../components/PageHeader";

type Role = "readonly" | "user" | "admin";
interface AdminUser { id: string; username: string; displayName: string; role: Role; disabled: boolean; createdAt: string }
interface UserPage { items: AdminUser[]; page: number; limit: number; total: number }
interface Overview { totalAccounts: number; enabledAccounts: number; activeAdmins: number }
interface AuditEvent { id: string; occurred_at: string; source: string; actor_id: string | null; target_id: string | null; action: string; before_summary: object; after_summary: object }

function csrfHeaders(): HeadersInit {
  const token = csrfToken();
  if (!token) throw new Error("Sign in again before making administrative changes.");
  return { "X-CSRF-Token": token };
}

export function Admin() {
  const { workspace, refresh } = useAccount();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserPage | null>(null);
  const [audit, setAudit] = useState<{ items: AuditEvent[]; total: number } | null>(null);
  const [settings, setSettings] = useState<{ enabled: boolean; defaultRole: "readonly" | "user" } | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRoleFilter] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [recovery, setRecovery] = useState<{ username: string; code: string } | null>(null);

  const load = useCallback(async () => {
    if (workspace.kind !== "account" || !workspace.capabilities.admin || !navigator.onLine) return;
    const query = new URLSearchParams({ page: String(page), limit: "25", ...(search ? { search } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) });
    try {
      const [nextOverview, nextUsers, nextSettings, nextAudit] = await Promise.all([
        apiJson<Overview>("/api/v1/admin/overview"), apiJson<UserPage>(`/api/v1/admin/users?${query}`),
        apiJson<{ enabled: boolean; defaultRole: "readonly" | "user" }>("/api/v1/admin/registration"),
        apiJson<{ items: AuditEvent[]; total: number }>("/api/v1/admin/audit?page=1&limit=25"),
      ]);
      setOverview(nextOverview); setUsers(nextUsers); setSettings(nextSettings); setAudit(nextAudit); setError(null);
    } catch (reason) {
      setOverview(null); setUsers(null); setSettings(null); setAudit(null);
      setError(reason instanceof Error ? reason.message : "Administration could not be loaded.");
      await refresh();
    }
  }, [page, refresh, role, search, status, workspace]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  if (workspace.kind === "loading") return <div className="page"><PageHeader title="Administration" subtitle="Checking access…" /></div>;
  if (workspace.kind !== "account") return <Navigate to="/account" replace />;
  if (!workspace.capabilities.admin) return <div className="page"><PageHeader title="Administration" subtitle="Access denied" /><p role="alert">An enabled administrator account is required.</p></div>;
  if (!navigator.onLine) return <div className="page"><PageHeader title="Administration" subtitle="Connection required" /><p role="alert">Administration is available only while connected. No action will be queued.</p></div>;

  const mutate = async (operation: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await operation(); setNotice(message); await refresh(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Administrative action failed."); await refresh(); }
    finally { setBusy(false); }
  };

  const updateRole = (user: AdminUser, nextRole: Role) => void mutate(() => apiJson(`/api/v1/admin/users/${user.id}/role`, { method: "PUT", headers: csrfHeaders(), body: JSON.stringify({ role: nextRole }) }), `${user.username} is now ${nextRole}.`);
  const updateStatus = (user: AdminUser) => void mutate(() => apiJson(`/api/v1/admin/users/${user.id}/status`, { method: "PUT", headers: csrfHeaders(), body: JSON.stringify({ disabled: !user.disabled }) }), `${user.username} ${user.disabled ? "enabled" : "disabled"}.`);
  const revoke = (user: AdminUser) => void mutate(() => apiJson(`/api/v1/admin/users/${user.id}/revoke-sessions`, { method: "POST", headers: csrfHeaders() }), `Sessions revoked for ${user.username}.`);
  const issueRecovery = (user: AdminUser) => void mutate(async () => { const value = await apiJson<{ code: string }>(`/api/v1/admin/users/${user.id}/recovery`, { method: "POST", headers: csrfHeaders() }); setRecovery({ username: user.username, code: value.code }); }, `Recovery code issued for ${user.username}.`);
  const confirmDelete = () => { if (!deleteTarget) return; const target = deleteTarget; void mutate(() => apiJson(`/api/v1/admin/users/${target.id}`, { method: "DELETE", headers: csrfHeaders(), body: JSON.stringify({ confirmation: deleteConfirmation }) }), `${target.username} deleted.`).then(() => { setDeleteTarget(null); setDeleteConfirmation(""); }); };
  const saveRegistration = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!settings) return; void mutate(() => apiJson("/api/v1/admin/registration", { method: "PUT", headers: csrfHeaders(), body: JSON.stringify(settings) }), "Registration settings saved."); };

  return <div className="page page-wide admin-page">
    <PageHeader title="Administration" subtitle="Manage installation access. Administrators cannot browse another account's game content." />
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="save-status" role="status">{notice}</p>}
    {overview && <div className="admin-summary" aria-label="Account summary"><div><strong>{overview.totalAccounts}</strong><span>Total accounts</span></div><div><strong>{overview.enabledAccounts}</strong><span>Enabled</span></div><div><strong>{overview.activeAdmins}</strong><span>Active admins</span></div></div>}
    <GroupedSection title="Accounts">
      <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}>
        <label className="field"><span className="field-label">Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Username or display name" /></label>
        <label className="field"><span className="field-label">Role</span><select value={role} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All</option><option value="readonly">Read-only</option><option value="user">User</option><option value="admin">Admin</option></select></label>
        <label className="field"><span className="field-label">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        <button type="submit">Apply filters</button>
      </form>
      <div className="admin-user-list">{users?.items.map((user) => <article className="admin-user-card" key={user.id}>
        <div><h3>{user.displayName}</h3><p className="type-caption">@{user.username} · {user.disabled ? "Disabled" : "Enabled"} · Created {new Date(user.createdAt).toLocaleDateString()}</p></div>
        <label className="compact-field"><span className="field-label">Role</span><select aria-label={`Role for ${user.username}`} disabled={busy} value={user.role} onChange={(event) => updateRole(user, event.target.value as Role)}><option value="readonly">Read-only</option><option value="user">User</option><option value="admin">Admin</option></select></label>
        <div className="action-row"><button disabled={busy} onClick={() => updateStatus(user)}>{user.disabled ? "Enable" : "Disable"}</button><button disabled={busy} onClick={() => revoke(user)}>Revoke sessions</button><button disabled={busy || user.disabled} onClick={() => issueRecovery(user)}>Issue recovery</button><button className="destructive-button" disabled={busy} onClick={() => setDeleteTarget(user)}>Delete</button></div>
      </article>)}</div>
      {users && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(users.total / users.limit))}</span><button disabled={page * users.limit >= users.total} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
    </GroupedSection>
    <GroupedSection title="Registration">{settings && <form onSubmit={saveRegistration}>
      <label className="checkbox-field"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> Open public registration</label>
      <label className="field"><span className="field-label">Default role for new accounts</span><select value={settings.defaultRole} onChange={(event) => setSettings({ ...settings, defaultRole: event.target.value as "readonly" | "user" })}><option value="user">User</option><option value="readonly">Read-only</option></select></label>
      <p className="type-caption">Changing this default does not alter existing accounts.</p><button disabled={busy} type="submit">Save registration</button>
    </form>}</GroupedSection>
    <GroupedSection title="Audit history"><div className="audit-list">{audit?.items.map((event) => <article key={event.id}><strong>{event.action}</strong><span>{new Date(event.occurred_at).toLocaleString()} · {event.source}</span><code>{JSON.stringify({ before: event.before_summary, after: event.after_summary })}</code></article>)}</div>{audit && <p className="type-caption">Showing {audit.items.length} of {audit.total} events.</p>}</GroupedSection>
    {recovery && <Dialog title={`Recovery for ${recovery.username}`} message="Shown once. Send this code through a private channel; it expires in 24 hours." onCancel={() => setRecovery(null)}><code className="recovery-code">{recovery.code}</code><button autoFocus onClick={() => setRecovery(null)}>Done</button></Dialog>}
    {deleteTarget && <Dialog title={`Delete ${deleteTarget.username}?`} message="This removes live server data and sessions. Offline browser copies and retained backups cannot be remotely erased." onCancel={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} pending={busy}><label className="field"><span className="field-label">Type {deleteTarget.username} to confirm</span><input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><button disabled={busy || deleteConfirmation !== deleteTarget.username} className="destructive-button" onClick={confirmDelete}>Delete account</button><button disabled={busy} onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }}>Cancel</button></Dialog>}
  </div>;
}
