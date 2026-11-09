import { Show, type Component } from 'solid-js';
import { useTheme, toggleDarkMode } from '../theme/materialTheme';
import { viewMode, setViewMode } from '../store/clockStore';
import SmartOmnibox from './SmartOmnibox';

export const TopToolbar: Component = () => {
  const [theme] = useTheme();

  function toggleViewMode() {
    setViewMode(viewMode() === 'list' ? 'grid' : 'list');
  }

  return (
    <header class="w-full border-b border-outline-variant/30 bg-surface/85 backdrop-blur-md sticky top-0 z-40 px-3 py-2.5 sm:px-6">
      <div class="max-w-6xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
        {/* Left Balancing Spacer (flex-grow: 1) */}
        <div class="flex-1 min-w-0" aria-hidden="true" />

        {/* Centered Minimalist Omnibox (flex-grow: 2 + max-w-2xl) */}
        <div class="grow-[2] max-w-2xl min-w-0">
          <SmartOmnibox />
        </div>

        {/* Right Action Buttons (flex-grow: 1 with buttons right-aligned) */}
        <div class="flex-1 flex items-center justify-end gap-1.5 shrink-0">
          {/* View Mode Switcher (List <-> Grid) */}
          <button
            type="button"
            onClick={toggleViewMode}
            class="p-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all active:scale-95 cursor-pointer"
            title={`Switch to ${viewMode() === 'list' ? 'Grid' : 'List'} view`}
            aria-label={`Switch to ${viewMode() === 'list' ? 'Grid' : 'List'} view`}
          >
            <Show
              when={viewMode() === 'grid'}
              fallback={
                /* Icon representing Grid view when currently in List */
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              }
            >
              {/* Icon representing List view when currently in Grid */}
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" stroke-width="3" />
                <line x1="3" y1="12" x2="3.01" y2="12" stroke-width="3" />
                <line x1="3" y1="18" x2="3.01" y2="18" stroke-width="3" />
              </svg>
            </Show>
          </button>

          {/* Theme Toggle Button (Light <-> Dark) */}
          <button
            type="button"
            id="toggle-dark-mode"
            onClick={() => toggleDarkMode()}
            class="p-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all active:scale-95 cursor-pointer"
            title={`Switch to ${theme().isDark ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme mode"
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
  );
};

export default TopToolbar;
