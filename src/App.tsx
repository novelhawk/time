import type { Component } from 'solid-js';
import TopToolbar from './components/TopToolbar';
import ClockBoard from './components/ClockBoard';
import EntryDetailDrawer from './components/EntryDetailDrawer';

const App: Component = () => {
  return (
    <div class="min-h-screen bg-background text-on-background flex flex-col transition-colors duration-200 font-mono">
      {/* Top Toolbar (Omnibox + View Toggle + Theme Toggle) */}
      <TopToolbar />

      {/* Main Clock Board (Vertical List or Bento Grid) */}
      <main class="flex-1 flex flex-col">
        <ClockBoard />
      </main>

      {/* Entry Detail Drawer / Inspector */}
      <EntryDetailDrawer />
    </div>
  );
};

export default App;

