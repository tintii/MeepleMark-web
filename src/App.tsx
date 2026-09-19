import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { PlayList } from "./pages/PlayList";
import { NewPlay } from "./pages/NewPlay";
import { PlayRoute } from "./pages/PlayRoute";
import { Collection } from "./pages/Collection";
import { GameDetail } from "./pages/GameDetail";
import { TemplateEditor } from "./pages/TemplateEditor";
import { Players } from "./pages/Players";

function NavShell() {
  return (
    <nav className="nav-shell">
      <NavLink to="/" end>
        Plays
      </NavLink>
      <NavLink to="/collection">Collection</NavLink>
      <NavLink to="/players">Players</NavLink>
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <NavShell />
      <Routes>
        <Route path="/" element={<PlayList />} />
        <Route path="/play/new" element={<NewPlay />} />
        <Route path="/play/:id" element={<PlayRoute />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/collection/:gameId" element={<GameDetail />} />
        <Route path="/collection/:gameId/template" element={<TemplateEditor />} />
        <Route path="/players" element={<Players />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
