import { Routes, Route } from 'react-router';
import { HomePage } from './pages/HomePage.js';
import { JoinPage } from './pages/JoinPage.js';
import { HostPage } from './pages/HostPage.js';
import { ScreenPage } from './pages/ScreenPage.js';
import { PlayerPage } from './pages/PlayerPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/join/:pin" element={<JoinPage />} />
      <Route path="/host/:pin" element={<HostPage />} />
      <Route path="/screen/:pin" element={<ScreenPage />} />
      <Route path="/play/:pin" element={<PlayerPage />} />
    </Routes>
  );
}
