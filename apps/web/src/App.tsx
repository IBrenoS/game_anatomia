import { Routes, Route } from 'react-router';
import { HomePage } from './pages/HomePage.js';
import { HostEntryPage } from './pages/HostEntryPage.js';
import { HostPage } from './pages/HostPage.js';
import { JoinPage } from './pages/JoinPage.js';
import { ScreenPage } from './pages/ScreenPage.js';
import { PlayerPage } from './pages/PlayerPage.js';

export function App() {
  return (
    <Routes>
      {/* Participant entry surfaces */}
      <Route path="/" element={<HomePage />} />
      <Route path="/join" element={<HomePage />} />
      <Route path="/join/:pin" element={<JoinPage />} />
      <Route path="/play/:pin" element={<PlayerPage />} />

      {/* Host surfaces */}
      <Route path="/host" element={<HostEntryPage />} />
      <Route path="/host/:pin" element={<HostPage />} />

      {/* Public screen / Projector */}
      <Route path="/screen/:pin" element={<ScreenPage />} />
    </Routes>
  );
}

export default App;
