import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { PlayList } from "./pages/PlayList";
import { NewPlay } from "./pages/NewPlay";
import { PlayRoute } from "./pages/PlayRoute";
import { Collection } from "./pages/Collection";
import { GameDetail } from "./pages/GameDetail";
import { TemplateEditor } from "./pages/TemplateEditor";
import { Players } from "./pages/Players";
import { PRODUCT_NAME } from "./product";
import { OfflineReadyIndicator, OfflineUpdateStatus } from "./components/OfflineStatus";
import { Account } from "./pages/Account";
import { AccountProvider } from "./account/AccountContext";
import { useAccount } from "./account/accountState";
import { SyncCoordinator } from "./components/SyncStatus";
import { Conflicts } from "./pages/Conflicts";
import { ThemeToggle } from "./components/ThemeToggle";
import { Admin } from "./pages/Admin";
import { OfflineHelp } from "./pages/OfflineHelp";
import { Setup } from "./pages/Setup";
import { IosInstallHint } from "./components/IosInstallHint";
import { useEffect, useState, type ReactNode } from "react";
import { apiJson } from "./account/api";
import { FailurePage } from "./components/FailurePage";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

function E2eRenderFailure() {
  if (import.meta.env.VITE_E2E === "true" && new URLSearchParams(window.location.search).has("e2eRenderFailure")) throw new Error("E2E render failure");
  return null;
}

function SetupNotice() {
  const { pathname } = useLocation();
  const [notice, setNotice] = useState<{ dismissKey: string; pathname: string } | null>(null);

  useEffect(() => {
    let current = true;
    if (pathname === "/setup") return () => { current = false; };
    void apiJson<{ installationId: string; setup: { required: boolean } }>("/api/v1/meta").then((meta) => {
      const key = `meeplemark:setup-notice-dismissed:${meta.installationId}`;
      let dismissed = false;
      try { dismissed = localStorage.getItem(key) === "1"; } catch { /* Show the notice when storage is unavailable. */ }
      if (current) setNotice(meta.setup.required && !dismissed ? { dismissKey: key, pathname } : null);
    }).catch(() => { if (current) setNotice(null); });
    return () => { current = false; };
  }, [pathname]);

  if (!notice || notice.pathname !== pathname || pathname === "/setup") return null;
  const dismiss = () => { try { localStorage.setItem(notice.dismissKey, "1"); } catch { /* Dismiss for this page load. */ } setNotice(null); };
  return <aside className="setup-notice" aria-label="Installation setup reminder">
    <span role="status">This installation still needs its first administrator.</span>
    <Link to="/setup">Set up now</Link>
    <button type="button" onClick={dismiss}>Dismiss</button>
  </aside>;
}

function WriteRoute({ children }: { children: ReactNode }) {
  const { workspace } = useAccount();
  if (workspace.kind === "account" && !workspace.capabilities.write) return <div className="page"><h1 className="type-title">Read-only account</h1><p>You can browse downloaded records, but this route changes account data. Pending edits are retained on this device.</p></div>;
  return children;
}

function NavShell() {
  const { workspace } = useAccount();
  return (
    <header className="app-chrome">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="app-chrome-inner">
        <div className="product-cluster">
          <NavLink className="product-name" to="/" aria-label={`${PRODUCT_NAME} home`}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
            <span>Meeple<span className="product-name-accent">Mark</span></span>
          </NavLink>
          <OfflineReadyIndicator />
        </div>
        <nav className="nav-shell" aria-label="Primary navigation">
          <NavLink to="/" end>
            <span className="nav-icon" aria-hidden="true"><svg data-icon="dice" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="8" cy="8" r="1.5" /><circle cx="16" cy="8" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></svg></span>
            <span>Plays</span>
          </NavLink>
          <NavLink to="/collection">
            <span className="nav-icon" aria-hidden="true"><svg data-icon="game-stack" viewBox="0 0 24 24"><rect x="3" y="4" width="16" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="5" y="10" width="16" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="3" y="16" width="16" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg></span>
            <span>Collection</span>
          </NavLink>
          <NavLink to="/players">
            <span className="nav-icon" aria-hidden="true"><svg data-icon="meeple" viewBox="0 0 24 24"><circle cx="12" cy="5" r="3" /><path d="M7.5 9h9l1.2 3 3.3 1.5-2 4-3-1.5v5H8v-5l-3 1.5-2-4L6.3 12l1.2-3Z" /></svg></span>
            <span>Players</span>
          </NavLink>
        </nav>
        <div className="app-chrome-actions">
          {workspace.kind === "account" && workspace.capabilities.admin && <NavLink className="app-chrome-link" to="/admin">Admin</NavLink>}
          <IosInstallHint />
          <a
            className="github-link"
            href="https://github.com/tintii/MeepleMark-web"
            target="_blank"
            rel="noreferrer"
            aria-label="MeepleMark on GitHub (opens in a new tab)"
          >
            <svg className="github-link-icon" aria-hidden="true" viewBox="0 0 19 19">
              <use href={`${import.meta.env.BASE_URL}icons.svg#github-icon`} />
            </svg>
          </a>
          <NavLink className="app-chrome-link" to="/account" aria-label="Account and workspace"><span aria-live="polite">{workspace.kind === "account" ? workspace.displayName : workspace.kind === "loading" ? "…" : "Guest"}</span></NavLink>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function RoutedApp() {
  const { workspace } = useAccount();
  return (
    <>
      <E2eRenderFailure />
      <SyncCoordinator />
      <NavShell />
      <OfflineUpdateStatus />
      <SetupNotice />
      <main id="main-content">
        {workspace.kind === "loading" ? <div className="page"><p className="type-caption" role="status">Opening workspace…</p></div> : (
          <Routes>
            <Route path="/" element={<PlayList />} />
            <Route path="/play/new" element={<WriteRoute><NewPlay /></WriteRoute>} />
            <Route path="/play/:id" element={<WriteRoute><PlayRoute /></WriteRoute>} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/collection/:gameId" element={<GameDetail />} />
            <Route path="/collection/:gameId/template" element={<WriteRoute><TemplateEditor /></WriteRoute>} />
            <Route path="/players" element={<Players />} />
            <Route path="/account" element={<Account />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/help/offline" element={<OfflineHelp />} />
            <Route path="*" element={<FailurePage code={404} title="Page not found" explanation="That address does not match a page in MeepleMark." actions={<Link className="button-link primary-button" to="/">Home</Link>} />} />
          </Routes>
        )}
      </main>
    </>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AccountProvider>
          <RoutedApp />
        </AccountProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
