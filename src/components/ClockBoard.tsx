import { For, Show, type Component } from 'solid-js';
import {
  resolvedClocks,
  viewMode,
  removeEntry,
  setSelectedEntryId,
} from '../store/clockStore';
import ClockCard from './ClockCard';

export const ClockBoard: Component = () => {
  const clocks = () => resolvedClocks();
  const mode = () => viewMode();

  return (
    <section class="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 flex-1 flex flex-col" aria-label="Clock Board">
      <Show
        when={clocks().length > 0}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center p-12 text-center text-on-surface-variant font-mono">
            <div class="w-12 h-12 mb-4 rounded-2xl border border-outline-variant/50 bg-surface-container flex items-center justify-center text-primary">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p class="text-sm font-medium text-on-surface">No clocks on your board</p>
            <p class="text-xs opacity-60 mt-1 max-w-xs">
              Search above (e.g., "Europe/Rome", "Italy", "Local+3") or press <kbd class="px-1.5 py-0.5 rounded border border-outline-variant/60 bg-surface-container text-[10px]"> / </kbd> to add your first clock.
            </p>
          </div>
        }
      >
        <div
          class={
            mode() === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-200'
              : 'flex flex-col gap-3 transition-all duration-200'
          }
        >
          <For each={clocks()}>
            {clock => (
              <ClockCard
                clock={clock}
                viewMode={mode()}
                onSelect={() => setSelectedEntryId(clock.id)}
                onRemove={() => removeEntry(clock.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  );
};

export default ClockBoard;
