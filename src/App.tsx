import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { PlayList } from "./pages/PlayList";
import { NewPlay } from "./pages/NewPlay";
import { PlayRoute } from "./pages/PlayRoute";
import { Collection } from "./pages/Collection";
import { GameDetail } from "./pages/GameDetail";
import { TemplateEditor } from "./pages/TemplateEditor";
import { Players } from "./pages/Players";
import { PRODUCT_NAME } from "./product";
import { OfflineStatus } from "./components/OfflineStatus";
import { Account } from "./pages/Account";
import { AccountProvider } from "./account/AccountContext";
import { useAccount } from "./account/accountState";
import { SyncCoordinator } from "./components/SyncStatus";
import { Conflicts } from "./pages/Conflicts";
import { ThemeToggle } from "./components/ThemeToggle";
import { Admin } from "./pages/Admin";
import type { ReactNode } from "react";

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
        <NavLink className="product-name" to="/" aria-label={`${PRODUCT_NAME} home`}>
          <img src="/favicon.svg" alt="" />
          <span>Meeple<span className="product-name-accent">Mark</span></span>
        </NavLink>
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
      <SyncCoordinator />
      <NavShell />
      <OfflineStatus />
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
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        )}
      </main>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AccountProvider>
        <RoutedApp />
      </AccountProvider>
    </BrowserRouter>
  );
}

export default App;
