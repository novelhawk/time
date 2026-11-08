import { type Component, For, Show } from 'solid-js';
import { useTheme, toggleDarkMode } from './theme/materialTheme';
import { engine_healthcheck } from './services/timeEngine';
import {
  resolvedClocks,
  entries,
  removeEntry,
  viewMode,
  setViewMode,
  setSelectedEntryId,
} from './store/clockStore';
import SmartOmnibox from './components/SmartOmnibox';
import AbbreviationPills from './components/AbbreviationPills';

const App: Component = () => {
  const [theme] = useTheme();

  return (
    <div class="min-h-screen bg-background text-on-background flex flex-col transition-colors duration-200 font-mono">
      {/* Minimalist Top Bar */}
      <header class="w-full border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Minimalist Brand: "time" */}
          <div class="flex items-center gap-3 shrink-0">
            <h1 class="text-xl font-light tracking-widest uppercase text-primary select-none">time</h1>
            <span class="hidden sm:inline-block text-[10px] text-on-surface-variant/60 font-mono" id="engine-healthcheck">
              {engine_healthcheck()} tz
            </span>
          </div>

          {/* Smart Omnibox (Centered & Real-Time) */}
          <div class="flex-1 max-w-2xl">
            <SmartOmnibox />
          </div>

          {/* Top Right Controls (Theme + View Mode) */}
          <div class="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div class="inline-flex rounded-lg border border-outline-variant/50 p-0.5 bg-surface-container-low text-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                class={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode() === 'list'
                    ? 'bg-surface-container-highest text-on-surface font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="List View"
                aria-label="List view"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                class={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode() === 'grid'
                    ? 'bg-surface-container-highest text-on-surface font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                title="Grid View"
                aria-label="Grid view"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              id="toggle-dark-mode"
              onClick={() => toggleDarkMode()}
              class="p-2 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title={`Switch to ${theme().isDark ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle dark mode"
            >
              <Show
                when={theme().isDark}
                fallback={
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                }
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </Show>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Saved Clocks */}
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:px-6">
        <div
          class={
            viewMode() === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'
          }
        >
          <For each={resolvedClocks()}>
            {clock => (
              <div
                class="group bg-surface-container border border-outline-variant/50 hover:border-outline rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                onClick={() => setSelectedEntryId(clock.id)}
              >
                {/* Top: Labels, Context, Badges, Delete */}
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-base font-semibold text-on-surface tracking-tight truncate">
                        {clock.primary_label}
                      </span>
                      <Show when={clock.subtitle_context}>
                        <span class="text-xs text-on-surface-variant/80 font-sans truncate">
                          {clock.subtitle_context}
                        </span>
                      </Show>
                    </div>

                    <div class="mt-1 flex items-center gap-2 flex-wrap text-xs text-on-surface-variant font-mono">
                      <span>{clock.utc_offset_str}</span>
                      <span>•</span>
                      <span>{clock.local_offset_str}</span>
                      <Show when={clock.abbreviations.length > 0}>
                        <span>•</span>
                        <AbbreviationPills abbreviations={clock.abbreviations} size="xs" />
                      </Show>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      removeEntry(clock.id);
                    }}
                    class="opacity-0 group-hover:opacity-100 p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-all cursor-pointer"
                    title="Remove clock"
                    aria-label={`Remove ${clock.primary_label}`}
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Bottom: Big Monospace Time & Date */}
                <div class="mt-6 flex items-baseline justify-between">
                  <div class="text-3xl sm:text-4xl font-bold tracking-wider text-on-surface font-mono">
                    {clock.formatted_time}
                  </div>
                  <div class="text-xs text-on-surface-variant flex items-center gap-1.5 font-mono">
                    <span>{clock.formatted_date}</span>
                    <Show when={clock.day_delta_from_local !== 0}>
                      <span class="px-1 py-0.5 rounded text-[10px] font-bold bg-tertiary-container text-on-tertiary-container">
                        {clock.day_delta_from_local > 0 ? '+1d' : '-1d'}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </main>
    </div>
  );
};

export default App;

