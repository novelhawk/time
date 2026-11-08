import { onMount, onCleanup, Show, type Component } from 'solid-js';
import TopToolbar from './components/TopToolbar';
import ClockBoard from './components/ClockBoard';
import EntryDetailDrawer from './components/EntryDetailDrawer';
import { toggleDarkMode } from './theme/materialTheme';
import {
  viewMode,
  setViewMode,
  isCustomTime,
  nowMs,
  resetToCurrentTime,
} from './store/clockStore';

const App: Component = () => {
  onMount(() => {
    function handleGlobalShortcuts(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setViewMode(viewMode() === 'list' ? 'grid' : 'list');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleDarkMode();
      }
    }

    window.addEventListener('keydown', handleGlobalShortcuts);
    onCleanup(() => window.removeEventListener('keydown', handleGlobalShortcuts));
  });

  return (
    <div class="min-h-screen bg-background text-on-background flex flex-col transition-colors duration-200 font-mono">
      {/* Top Toolbar (Omnibox + View Toggle + Theme Toggle) */}
      <TopToolbar />

      {/* Time-Scrubbing Active Indicator & One-Click Reset Banner */}
      <Show when={isCustomTime()}>
        <div class="w-full bg-primary-container/80 text-on-primary-container border-b border-primary/30 px-4 py-2 flex items-center justify-between text-xs font-mono transition-all animate-in fade-in slide-in-from-top-1">
          <div class="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>
                Custom reference time active: <strong>{new Date(nowMs()).toUTCString()}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => resetToCurrentTime()}
              class="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Return to live real-time ticking"
            >
              <span>Live Ticking</span>
              <span class="text-[10px] opacity-80">✕ Reset</span>
            </button>
          </div>
        </div>
      </Show>

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

