import {
  createSignal,
  createMemo,
  createEffect,
  createComputed,
  createRoot,
  onCleanup,
  type Accessor,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import {
  initTimeEngine,
  isTimeEngineReady,
  getBrowserTimeZone,
  resolve_entries,
  search_time_query,
  get_entry_details,
  type ResolvedTimeEntry,
  type SearchResponse,
} from '../services/timeEngine';

export type ViewMode = 'list' | 'grid';

const STORAGE_KEY_ENTRIES = 'time_entries';
const STORAGE_KEY_VIEW_MODE = 'time_view_mode';
const DEFAULT_ENTRIES = ['local', 'iana:UTC'];

/**
 * Parses initial entries from URL search params (?z=...) or localStorage fallback
 */
function getInitialEntries(): string[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_ENTRIES];
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const zParam = searchParams.getAll('z').flatMap(s => s.split(',')).map(s => s.trim()).filter(Boolean);
    if (zParam.length > 0) {
      return zParam;
    }
  } catch (err) {
    console.warn('Failed to parse entries from URL:', err);
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => String(s).trim()).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn('Failed to read entries from localStorage:', err);
  }

  return [...DEFAULT_ENTRIES];
}

/**
 * Parses initial view mode from localStorage
 */
function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    if (stored === 'grid' || stored === 'list') {
      return stored;
    }
  } catch {}
  return 'list';
}

// ---------------------------------------------------------------------------
// Core Signals
// ---------------------------------------------------------------------------

const [entries, setEntries] = createSignal<string[]>(getInitialEntries());
const [viewMode, setViewModeSignal] = createSignal<ViewMode>(getInitialViewMode());
const [liveNowMs, setLiveNowMs] = createSignal<number>(Date.now());
const [customTimeMs, setCustomTimeMs] = createSignal<number | null>(null);
const [searchQuery, setSearchQuery] = createSignal<string>('');
const [selectedEntryId, setSelectedEntryId] = createSignal<string | null>(null);
const [localTz, setLocalTz] = createSignal<string>(getBrowserTimeZone());

// ---------------------------------------------------------------------------
// High-Precision Zero-Drift Clock Ticker
// ---------------------------------------------------------------------------

let timerId: ReturnType<typeof setTimeout> | undefined;

function stopTicker(): void {
  if (timerId !== undefined) {
    clearTimeout(timerId);
    timerId = undefined;
  }
}

function startTicker(): void {
  stopTicker();

  function scheduleNextTick(): void {
    const now = Date.now();
    // Time remaining until the next exact second integer boundary
    const delay = 1000 - (now % 1000);

    timerId = setTimeout(() => {
      setLiveNowMs(Date.now());
      scheduleNextTick();
    }, delay);
  }

  scheduleNextTick();
}

if (typeof window !== 'undefined') {
  startTicker();

  // Re-synchronize immediately when page becomes visible again
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setLiveNowMs(Date.now());
        startTicker();
      }
    });
  }

  // Handle browser back/forward buttons to sync entries
  window.addEventListener('popstate', () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const zParam = searchParams.getAll('z').flatMap(s => s.split(',')).map(s => s.trim()).filter(Boolean);
      if (zParam.length > 0) {
        setEntries(zParam);
      } else {
        setEntries([...DEFAULT_ENTRIES]);
      }
    } catch {}
  });

  // Automatically start Wasm initialization
  initTimeEngine().catch(err => {
    console.error('Failed to initialize Wasm engine in clockStore:', err);
  });
}

// ---------------------------------------------------------------------------
// Persistence Helpers (LocalStorage + URL Synchronization)
// ---------------------------------------------------------------------------

function persistEntries(currentEntries: string[]): void {
  if (typeof window === 'undefined') return;

  // 1. Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(currentEntries));
  } catch (err) {
    console.warn('Failed to save entries to localStorage:', err);
  }

  // 2. Persist to URL search parameters (?z=...)
  try {
    const url = new URL(window.location.href);
    if (currentEntries.length > 0) {
      url.searchParams.set('z', currentEntries.join(','));
    } else {
      url.searchParams.delete('z');
    }

    const newSearch = url.search;
    if (newSearch !== window.location.search) {
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch (err) {
    console.warn('Failed to sync entries with URL:', err);
  }
}

function persistViewMode(mode: ViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
  } catch (err) {
    console.warn('Failed to save view mode to localStorage:', err);
  }
}

// ---------------------------------------------------------------------------
// Derived Signals & Memos (Rooted)
// ---------------------------------------------------------------------------

const {
  nowMs,
  isCustomTime,
  resolvedClocks,
  searchResponse,
  searchResults,
  selectedEntryDetails,
} = createRoot(() => {
  const nowMs = createMemo(() => customTimeMs() ?? liveNowMs());
  const isCustomTime = createMemo(() => customTimeMs() !== null);

  // Fine-grained reconciled stores to preserve object and DOM identity across time ticks
  const [clocksStore, setClocksStore] = createStore<{ list: ResolvedTimeEntry[] }>({ list: [] });
  const [searchStore, setSearchStore] = createStore<{
    summary: string | null;
    isAmbiguous: boolean;
    results: ResolvedTimeEntry[];
  }>({
    summary: null,
    isAmbiguous: false,
    results: [],
  });

  createComputed(() => {
    if (!isTimeEngineReady()) {
      setClocksStore('list', []);
      return;
    }
    const currentEntries = entries();
    const currentNow = nowMs();
    const tz = localTz();
    const freshClocks = resolve_entries(currentEntries, currentNow, tz);
    setClocksStore('list', reconcile(freshClocks, { key: 'id' }));
  });

  createComputed(() => {
    if (!isTimeEngineReady()) {
      setSearchStore({ summary: null, isAmbiguous: false, results: [] });
      return;
    }
    const q = searchQuery().trim();
    const currentNow = nowMs();
    const tz = localTz();
    const resp = search_time_query(q, currentNow, tz);
    setSearchStore('summary', resp.parsed_expression_summary ?? null);
    setSearchStore('isAmbiguous', resp.is_ambiguous);
    setSearchStore('results', reconcile(resp.results, { key: 'id' }));
  });

  const resolvedClocks = () => clocksStore.list;
  const searchResults = () => searchStore.results;
  const searchResponse = (): SearchResponse => ({
    parsed_expression_summary: searchStore.summary,
    is_ambiguous: searchStore.isAmbiguous,
    results: searchStore.results,
  });

  const selectedEntryDetails = createMemo(() => {
    if (!isTimeEngineReady()) return null;
    const id = selectedEntryId();
    if (!id) return null;
    const currentNow = nowMs();
    const tz = localTz();
    return get_entry_details(id, currentNow, tz);
  });

  if (typeof window !== 'undefined') {
    createEffect(() => {
      persistEntries(entries());
    });

    createEffect(() => {
      persistViewMode(viewMode());
    });
  }

  return {
    nowMs,
    isCustomTime,
    resolvedClocks,
    searchResponse,
    searchResults,
    selectedEntryDetails,
  };
});

export {
  nowMs,
  isCustomTime,
  resolvedClocks,
  searchResponse,
  searchResults,
  selectedEntryDetails,
};

// ---------------------------------------------------------------------------
// Store Actions
// ---------------------------------------------------------------------------

export function addEntry(id: string): void {
  const cleanId = id.trim();
  if (!cleanId) return;
  setEntries(prev => {
    if (prev.includes(cleanId)) return prev;
    const next = [...prev, cleanId];
    persistEntries(next);
    return next;
  });
}

export function removeEntry(id: string): void {
  const cleanId = id.trim();
  setEntries(prev => {
    const next = prev.filter(e => e !== cleanId);
    persistEntries(next);
    return next;
  });
  if (selectedEntryId() === cleanId) {
    setSelectedEntryId(null);
  }
}

export function toggleEntry(id: string): void {
  const cleanId = id.trim();
  if (entries().includes(cleanId)) {
    removeEntry(cleanId);
  } else {
    addEntry(cleanId);
  }
}

export function reorderEntries(newEntries: string[]): void {
  const next = newEntries.map(s => s.trim()).filter(Boolean);
  setEntries(next);
  persistEntries(next);
}

export function setViewMode(mode: ViewMode): void {
  setViewModeSignal(mode);
  persistViewMode(mode);
}

export function setCustomTime(timeMs: number | null): void {
  setCustomTimeMs(timeMs);
}

export function resetToCurrentTime(): void {
  setCustomTimeMs(null);
  setLiveNowMs(Date.now());
}

export {
  entries,
  viewMode,
  searchQuery,
  setSearchQuery,
  selectedEntryId,
  setSelectedEntryId,
  localTz,
  setLocalTz,
  liveNowMs,
  setLiveNowMs,
  startTicker,
  stopTicker,
};
