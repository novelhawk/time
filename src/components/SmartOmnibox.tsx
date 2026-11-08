import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  Show,
  For,
  type Component,
} from 'solid-js';
import {
  searchQuery,
  setSearchQuery,
  searchResponse,
  searchResults,
  entries,
  addEntry,
  removeEntry,
  setSelectedEntryId,
  setCustomTime,
} from '../store/clockStore';
import type { ResolvedTimeEntry } from '../services/timeEngine';
import AbbreviationPills from './AbbreviationPills';

export function entryToEpochMs(entry: ResolvedTimeEntry): number {
  const iso = `${entry.formatted_date}T${entry.formatted_time}Z`;
  const utcMs = Date.parse(iso);
  return utcMs - entry.offset_seconds * 1000;
}

export const SmartOmnibox: Component = () => {
  let inputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [isOpen, setIsOpen] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const results = () => searchResults();
  const response = () => searchResponse();
  const savedEntries = () => entries();

  // Automatically open dropdown when a search query is present
  createEffect(() => {
    if (searchQuery().trim().length > 0) {
      setIsOpen(true);
    }
  });

  // Reset selected index whenever the query results change
  createEffect(() => {
    results();
    setSelectedIndex(0);
  });

  // Close dropdown on click outside
  onMount(() => {
    function handleDocumentClick(e: MouseEvent) {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    // Global keyboard shortcut: '/' or 'Cmd/Ctrl + K' to focus omnibox
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (
        (isCmdK || isSlash) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef?.focus();
        setIsOpen(true);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleGlobalKeyDown);

    onCleanup(() => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    });
  });

  function handleKeyDown(e: KeyboardEvent) {
    const list = results();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex(prev => (list.length > 0 ? (prev + 1) % list.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex(prev => (list.length > 0 ? (prev - 1 + list.length) % list.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = list[selectedIndex()] || list[0];
      if (current) {
        if (searchQuery().includes('@')) {
          const targetMs = entryToEpochMs(current);
          if (!isNaN(targetMs)) {
            setCustomTime(targetMs);
          }
        }
        addEntry(current.id);
        setSearchQuery('');
        setIsOpen(false);
      }
    } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
      const current = list[selectedIndex()];
      if (current) {
        e.preventDefault();
        setSelectedEntryId(current.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchQuery('');
      setIsOpen(false);
      inputRef?.blur();
    }
  }

  function handleSelectResult(entry: ResolvedTimeEntry) {
    addEntry(entry.id);
    setSearchQuery('');
    setIsOpen(false);
  }

  function handleInspect(e: MouseEvent, entryId: string) {
    e.stopPropagation();
    setSelectedEntryId(entryId);
  }

  function isEntrySaved(id: string): boolean {
    return savedEntries().includes(id);
  }

  return (
    <div ref={containerRef} class="relative w-full max-w-3xl mx-auto select-none">
      {/* Omnibox Search Input */}
      <div class="relative flex items-center">
        {/* Search Icon */}
        <div class="absolute left-3.5 text-on-surface-variant pointer-events-none flex items-center justify-center">
          <svg class="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchQuery()}
          onInput={e => {
            setSearchQuery(e.currentTarget.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Europe/Rome, Italy, Local+3, PT..."
          aria-label="Search timezone or time expression"
          aria-expanded={isOpen() && searchQuery().trim().length > 0}
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          class="w-full bg-surface-container-high/70 backdrop-blur-md text-on-surface placeholder:text-on-surface-variant/45 border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary rounded-2xl py-3 pl-10 pr-24 text-sm font-mono transition-all shadow-sm outline-none"
        />

        {/* Right Action / Clear / Shortcut Badge */}
        <div class="absolute right-3 flex items-center gap-1.5 text-xs text-on-surface-variant">
          <Show when={searchQuery().length > 0}>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
                inputRef?.focus();
              }}
              class="p-1 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Clear search (Esc)"
              aria-label="Clear search"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Show>

          <span class="hidden sm:inline-block px-1.5 py-0.5 rounded border border-outline-variant/50 bg-surface-container text-[10px] font-mono opacity-60">
            {searchQuery().length > 0 ? 'ESC' : '/'}
          </span>
        </div>
      </div>

      {/* Live Preview Dropdown */}
      <Show when={isOpen() && searchQuery().trim().length > 0}>
        <div class="absolute top-full left-0 right-0 mt-2 z-50 bg-surface-container/95 backdrop-blur-2xl border border-outline-variant/60 rounded-2xl shadow-2xl overflow-hidden max-h-[72vh] flex flex-col">
          {/* Header Status Bar (Disambiguation & Math Summary) */}
          <div class="px-4 py-2 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant font-mono">
            <div class="flex items-center gap-2 overflow-hidden">
              <Show when={response().is_ambiguous}>
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-medium tracking-tight whitespace-nowrap">
                  Ambiguous Query • Multiple Results
                </span>
              </Show>

              <Show when={response().parsed_expression_summary}>
                <span class="truncate opacity-80" title={response().parsed_expression_summary ?? ''}>
                  Parsed: <span class="text-primary font-semibold">{response().parsed_expression_summary}</span>
                </span>
              </Show>
            </div>

            <div class="hidden sm:flex items-center gap-2 text-[10px] opacity-60 whitespace-nowrap">
              <span>↑↓ select</span>
              <span>•</span>
              <span>↵ add</span>
              <span>•</span>
              <span>Tab inspect</span>
            </div>
          </div>

          {/* Results List */}
          <div class="overflow-y-auto divide-y divide-outline-variant/20">
            <Show
              when={results().length > 0}
              fallback={
                <div class="p-6 text-center text-xs text-on-surface-variant font-mono">
                  No matching timezones found for "{searchQuery()}"
                </div>
              }
            >
              <For each={results()}>
                {(entry, index) => {
                  const isSelected = () => selectedIndex() === index();
                  const saved = () => isEntrySaved(entry.id);

                  return (
                    <div
                      class={`group flex items-center justify-between p-3.5 transition-all cursor-pointer ${
                        isSelected()
                          ? 'bg-surface-container-highest border-l-4 border-l-primary pl-3'
                          : 'hover:bg-surface-container-high'
                      }`}
                      onClick={() => handleSelectResult(entry)}
                      onMouseEnter={() => setSelectedIndex(index())}
                    >
                      {/* Left: Zone Name, Badges, Offsets */}
                      <div class="flex flex-col gap-1.5 min-w-0 pr-4">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-mono text-sm font-semibold text-on-surface tracking-tight truncate">
                            {entry.primary_label}
                          </span>

                          {/* Kind Badge */}
                          <Show when={entry.kind === 'offset_group'}>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary-container text-on-secondary-container border border-outline-variant/40">
                              Offset Group • {entry.sibling_iana_zones.length} zones
                            </span>
                          </Show>

                          <Show when={entry.kind === 'computed_expression'}>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-primary-container text-on-primary-container border border-outline-variant/40">
                              Shifted Time
                            </span>
                          </Show>

                          {/* Subtitle / Country Context */}
                          <Show when={entry.subtitle_context}>
                            <span class="text-xs text-on-surface-variant truncate font-sans opacity-85">
                              {entry.subtitle_context}
                            </span>
                          </Show>
                        </div>

                        {/* Monospace Offset Pills + Abbreviations */}
                        <div class="flex items-center gap-2 flex-wrap font-mono text-[11px] text-on-surface-variant">
                          <span class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50">
                            {entry.utc_offset_str}
                          </span>
                          <span class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50">
                            {entry.gmt_offset_str}
                          </span>
                          <span
                            class="px-1.5 py-0.5 rounded bg-surface-container-low border border-outline-variant/50"
                            title="Delta compared to your current local time"
                          >
                            {entry.local_offset_str}
                          </span>

                          <Show when={entry.abbreviations.length > 0}>
                            <span class="opacity-40">•</span>
                            <AbbreviationPills abbreviations={entry.abbreviations} size="xs" />
                          </Show>
                        </div>
                      </div>

                      {/* Right: Live Ticking Time Preview + Actions */}
                      <div class="flex items-center gap-3 shrink-0">
                        {/* Live Ticking Time */}
                        <div class="flex flex-col items-end text-right font-mono">
                          <span class="text-base font-bold text-on-surface tracking-wider">
                            {entry.formatted_time}
                          </span>
                          <div class="flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <span>{entry.formatted_date}</span>
                            <Show when={entry.day_delta_from_local !== 0}>
                              <span
                                class="px-1 py-0.2 rounded text-[9px] font-bold bg-tertiary-container text-on-tertiary-container"
                                title={`Date shifted ${entry.day_delta_from_local > 0 ? '+1' : '-1'} day relative to your local time`}
                              >
                                {entry.day_delta_from_local > 0 ? '+1d' : '-1d'}
                              </span>
                            </Show>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div class="flex items-center gap-1">
                          {/* Scrub Board Action Button */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              const targetMs = entryToEpochMs(entry);
                              if (!isNaN(targetMs)) {
                                setCustomTime(targetMs);
                              }
                              setSearchQuery('');
                              setIsOpen(false);
                            }}
                            class="p-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            title="Scrub all clocks on board to this target time"
                            aria-label="Scrub board to this time"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 15 15" />
                              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                            </svg>
                          </button>

                          {/* Inspect Button */}
                          <button
                            type="button"
                            onClick={e => handleInspect(e, entry.id)}
                            class="p-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Inspect DST transitions and sibling zones (Tab)"
                            aria-label="Inspect details"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                          </button>

                          {/* Add / Added Button */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (saved()) {
                                removeEntry(entry.id);
                              } else {
                                addEntry(entry.id);
                              }
                            }}
                            class={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                              saved()
                                ? 'bg-secondary-container text-on-secondary-container border border-outline-variant/60 hover:bg-error-container hover:text-on-error-container'
                                : 'bg-primary text-on-primary hover:opacity-90 shadow-sm'
                            }`}
                            title={saved() ? 'Remove from your clocks' : 'Add to your clocks (Enter)'}
                          >
                            <Show
                              when={saved()}
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
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default SmartOmnibox;
