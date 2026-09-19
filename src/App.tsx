import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PlayList } from "./pages/PlayList";
import { NewPlay } from "./pages/NewPlay";
import { PlayScoring } from "./pages/PlayScoring";

// Minimal shell — just enough to prove the wiring end-to-end. No game
// collection, no player directory, no scorepad/template grid yet: see
// README.md's Status section.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayList />} />
        <Route path="/play/new" element={<NewPlay />} />
        <Route path="/play/:id" element={<PlayScoring />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
