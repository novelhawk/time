import {
  createSignal,
  createMemo,
  Show,
  For,
  onMount,
  onCleanup,
  type Component,
} from 'solid-js';
import {
  selectedEntryId,
  setSelectedEntryId,
  selectedEntryDetails,
  entries,
  addEntry,
  removeEntry,
} from '../store/clockStore';
import type { DstTransitionInfo } from '../services/timeEngine';
import AbbreviationPills from './AbbreviationPills';

function formatTransitionDateTime(isoUtc: string): string {
  try {
    const d = new Date(isoUtc);
    return d.toUTCString();
  } catch {
    return isoUtc;
  }
}

function formatOffsetSec(sec: number): string {
  const sign = sec < 0 ? '-' : '+';
  const abs = Math.abs(sec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const EntryDetailDrawer: Component = () => {
  const [siblingFilter, setSiblingFilter] = createSignal('');
  let drawerRef: HTMLDivElement | undefined;

  const detail = () => selectedEntryDetails();
  const isOpen = () => selectedEntryId() !== null;
  const isSaved = () => (detail() ? entries().includes(detail()!.id) : false);

  function closeDrawer() {
    setSelectedEntryId(null);
    setSiblingFilter('');
  }

  // Handle Escape key to close
  onMount(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen()) {
        closeDrawer();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  const filteredSiblings = createMemo(() => {
    const d = detail();
    if (!d || !d.sibling_iana_zones) return [];
    const filter = siblingFilter().trim().toLowerCase();
    if (!filter) return d.sibling_iana_zones;
    return d.sibling_iana_zones.filter(z => z.toLowerCase().includes(filter));
  });

  return (
    <Show when={isOpen() && detail()}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200"
        onClick={closeDrawer}
        aria-modal="true"
        role="dialog"
      >
        {/* Drawer Panel */}
        <div
          ref={drawerRef}
          class="w-full max-w-xl bg-surface border-l border-outline-variant/60 shadow-2xl h-full flex flex-col font-mono select-none overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Bar Header */}
          <div class="p-5 border-b border-outline-variant/30 bg-surface-container-low flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-xl font-bold text-on-surface tracking-tight truncate">
                  {detail()!.primary_label}
                </h2>
                <Show when={detail()!.subtitle_context}>
                  <span class="text-xs text-on-surface-variant font-sans truncate opacity-80">
                    {detail()!.subtitle_context}
                  </span>
                </Show>
              </div>

              {/* Live Big Time */}
              <div class="mt-2 flex items-baseline gap-3">
                <time class="text-3xl sm:text-4xl font-bold text-primary tracking-wider tabular-nums">
                  {detail()!.formatted_time}
                </time>
              </div>
            </div>

            {/* Header Right Actions */}
            <div class="flex items-center gap-2 shrink-0">
              {/* Quick Add / Remove Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (isSaved()) {
                    removeEntry(detail()!.id);
                  } else {
                    addEntry(detail()!.id);
                  }
                }}
                class={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSaved()
                    ? 'bg-secondary-container text-on-secondary-container border border-outline-variant/50 hover:bg-error-container hover:text-on-error-container'
                    : 'bg-primary text-on-primary hover:opacity-90 shadow-sm'
                }`}
                title={isSaved() ? 'Remove from board' : 'Add to board'}
              >
                <Show
                  when={isSaved()}
                  fallback={
                    <>
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add</span>
                    </>
                  }
                >
                  <svg class="w-3.5 h-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Added</span>
                </Show>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={closeDrawer}
                class="p-2 rounded-xl border border-outline-variant/50 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                title="Close drawer (Esc)"
                aria-label="Close drawer"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div class="flex-1 overflow-y-auto p-5 space-y-6">
            {/* 1. Offsets Matrix */}
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
                Offsets Matrix
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div class="bg-surface-container p-3 rounded-xl border border-outline-variant/40">
                  <span class="text-[10px] text-on-surface-variant block uppercase tracking-wider">UTC Offset</span>
                  <span class="text-sm font-bold text-on-surface font-mono">{detail()!.utc_offset_str}</span>
                </div>
                <div class="bg-surface-container p-3 rounded-xl border border-outline-variant/40">
                  <span class="text-[10px] text-on-surface-variant block uppercase tracking-wider">GMT Offset</span>
                  <span class="text-sm font-bold text-on-surface font-mono">{detail()!.gmt_offset_str}</span>
                </div>
                <div class="bg-surface-container p-3 rounded-xl border border-outline-variant/40">
                  <span class="text-[10px] text-on-surface-variant block uppercase tracking-wider">Local Delta</span>
                  <span class="text-sm font-bold text-on-surface font-mono">{detail()!.local_offset_str}</span>
                </div>
              </div>
            </div>

            {/* 2. Abbreviations & Seasonality Breakdown */}
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
                Abbreviations & Seasonality
              </h3>

              <div class="bg-surface-container border border-outline-variant/40 rounded-xl overflow-hidden divide-y divide-outline-variant/20">
                <Show
                  when={detail()!.abbreviations.length > 0}
                  fallback={
                    <div class="p-3 text-xs text-on-surface-variant opacity-60">
                      Standard offset timezone (no named seasonal abbreviation codes).
                    </div>
                  }
                >
                  <For each={detail()!.abbreviations}>
                    {abbr => (
                      <div class="p-3 flex items-center justify-between gap-3 text-xs">
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class={`px-2 py-0.5 rounded font-mono font-bold tracking-tight ${
                              abbr.is_year_round
                                ? 'bg-surface-container-high border border-outline text-on-surface'
                                : abbr.is_currently_active
                                ? 'bg-primary-container text-on-primary-container border-dashed border-primary'
                                : 'bg-surface-container-low text-on-surface-variant/60 border-dashed border-outline-variant opacity-60'
                            }`}
                          >
                            {abbr.code}
                          </span>
                          <span class="font-sans text-on-surface truncate">{abbr.full_name}</span>
                        </div>

                        <div class="flex items-center gap-2 shrink-0 text-[11px]">
                          <span
                            class={`px-1.5 py-0.5 rounded font-mono ${
                              abbr.is_year_round
                                ? 'bg-surface-container-highest text-on-surface'
                                : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/40'
                            }`}
                          >
                            {abbr.is_year_round ? '● Year-Round' : '◌ Seasonal DST'}
                          </span>

                          <span
                            class={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                              abbr.is_currently_active
                                ? 'bg-primary/20 text-primary border border-primary/40'
                                : 'text-on-surface-variant/40'
                            }`}
                          >
                            {abbr.is_currently_active ? 'Active Now' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            {/* 3. DST Transition Timeline */}
            <div>
              <h3 class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
                DST Transition Timeline
              </h3>

              <div class="bg-surface-container border border-outline-variant/40 rounded-xl p-4">
                <Show
                  when={detail()!.uses_dst && (detail()!.previous_transition || detail()!.next_transition)}
                  fallback={
                    <div class="flex items-center gap-2 text-xs text-on-surface-variant opacity-75">
                      <svg class="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      <span>No DST transitions — this timezone observes a fixed offset year-round.</span>
                    </div>
                  }
                >
                  <div class="space-y-4">
                    {/* Previous Transition */}
                    <Show when={detail()!.previous_transition}>
                      {prev => (
                        <div class="relative pl-6 border-l-2 border-outline-variant/50 pb-2">
                          <span class="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-outline" />
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-bold text-on-surface">Most Recent Transition</span>
                            <span class="text-[10px] text-on-surface-variant opacity-75">
                              {formatTransitionDateTime(prev().iso_utc)}
                            </span>
                          </div>
                          <div class="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap font-mono">
                            <span class="font-semibold text-on-surface">{prev().abbrev_before} ({formatOffsetSec(prev().offset_before_seconds)})</span>
                            <span>→</span>
                            <span class="font-semibold text-primary">{prev().abbrev_after} ({formatOffsetSec(prev().offset_after_seconds)})</span>
                            <span class="opacity-60 text-[10px]">
                              (Local clock changed {prev().local_time_before.slice(11, 16)} → {prev().local_time_after.slice(11, 16)})
                            </span>
                          </div>
                        </div>
                      )}
                    </Show>

                    {/* Next Transition */}
                    <Show when={detail()!.next_transition}>
                      {next => (
                        <div class="relative pl-6 border-l-2 border-primary">
                          <span class="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-bold text-primary">Upcoming DST Transition</span>
                            <span class="text-[10px] text-on-surface-variant font-mono">
                              {formatTransitionDateTime(next().iso_utc)}
                            </span>
                          </div>
                          <div class="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap font-mono">
                            <span class="font-semibold text-on-surface">{next().abbrev_before} ({formatOffsetSec(next().offset_before_seconds)})</span>
                            <span class="text-primary font-bold">→</span>
                            <span class="font-semibold text-primary">{next().abbrev_after} ({formatOffsetSec(next().offset_after_seconds)})</span>
                            <span class="opacity-75 text-[10px]">
                              (Clock jumps {next().local_time_before.slice(11, 16)} → {next().local_time_after.slice(11, 16)})
                            </span>
                          </div>
                        </div>
                      )}
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            {/* 4. Sibling Timezones Sharing This Offset */}
            <div>
              <div class="flex items-center justify-between gap-3 mb-2.5">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Sibling Zones Sharing Offset ({detail()!.sibling_iana_zones.length})
                </h3>

                {/* Sibling Filter Search Input */}
                <input
                  type="text"
                  value={siblingFilter()}
                  onInput={e => setSiblingFilter(e.currentTarget.value)}
                  placeholder="Filter siblings..."
                  class="px-2.5 py-1 text-xs rounded-lg border border-outline-variant/60 bg-surface-container placeholder:text-on-surface-variant/40 text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div class="bg-surface-container border border-outline-variant/40 rounded-xl p-3 max-h-52 overflow-y-auto">
                <div class="flex flex-wrap gap-1.5">
                  <For each={filteredSiblings()}>
                    {sibling => {
                      const siblingId = `iana:${sibling}`;
                      const isSiblingSaved = () => entries().includes(siblingId);
                      const isCurrent = () => detail()!.id === siblingId;

                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent()) return;
                            setSelectedEntryId(siblingId);
                          }}
                          class={`px-2 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrent()
                              ? 'bg-primary text-on-primary font-bold'
                              : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/50'
                          }`}
                          title={`Switch to ${sibling}`}
                        >
                          <span>{sibling}</span>
                          <Show when={isSiblingSaved()}>
                            <span class="text-[9px] opacity-75">✓</span>
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default EntryDetailDrawer;
