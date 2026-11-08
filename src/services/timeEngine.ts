import { createSignal, type Accessor } from 'solid-js';
import initWasm, {
  search_time_query as wasm_search_time_query,
  resolve_entries as wasm_resolve_entries,
  get_entry_details as wasm_get_entry_details,
  engine_healthcheck as wasm_engine_healthcheck,
} from '../wasm-pkg/time_engine_wasm';

export interface AbbreviationBadge {
  code: string;
  full_name: string;
  kind: 'generic_year_round' | 'standard_seasonal' | 'daylight_seasonal' | 'fixed_year_round' | string;
  is_currently_active: boolean;
  is_year_round: boolean;
}

export interface DstTransitionInfo {
  timestamp_ms: number;
  iso_utc: string;
  local_time_before: string;
  local_time_after: string;
  abbrev_before: string;
  abbrev_after: string;
  offset_before_seconds: number;
  offset_after_seconds: number;
  is_dst_after: boolean;
}

export interface ResolvedTimeEntry {
  id: string;
  kind: 'iana' | 'offset_group' | 'computed_expression' | string;
  primary_label: string;
  subtitle_context?: string | null;
  formatted_time: string;
  formatted_date: string;
  day_delta_from_local: number;
  utc_offset_str: string;
  gmt_offset_str: string;
  local_offset_str: string;
  offset_seconds: number;
  uses_dst: boolean;
  is_dst_active_now: boolean;
  abbreviations: AbbreviationBadge[];
  previous_transition?: DstTransitionInfo | null;
  next_transition?: DstTransitionInfo | null;
  sibling_iana_zones: string[];
  country_matches: string[];
}

export interface SearchResponse {
  parsed_expression_summary?: string | null;
  is_ambiguous: boolean;
  results: ResolvedTimeEntry[];
}

const [isReady, setIsReady] = createSignal(false);
let initPromise: Promise<void> | null = null;

/**
 * Detects the user's browser IANA timezone
 */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Asynchronously initialize the Wasm module from wasm-pkg
 */
export async function initTimeEngine(
  moduleOrPath?: BufferSource | WebAssembly.Module | string | URL
): Promise<void> {
  if (isReady()) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        let input = moduleOrPath;
        if (!input && typeof process !== 'undefined' && process.versions?.node) {
          try {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const wasmPath = path.resolve(process.cwd(), 'src/wasm-pkg/time_engine_wasm_bg.wasm');
            if (fs.existsSync(wasmPath)) {
              input = fs.readFileSync(wasmPath);
            }
          } catch (e) {
            console.error('WASM node fallback error:', e);
          }
        }
        if (input && !(input instanceof WebAssembly.Module) && typeof input !== 'string' && !(input instanceof URL)) {
          await initWasm({ module_or_path: input });
        } else {
          await initWasm(input);
        }
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize Wasm time engine:', err);
        initPromise = null;
        throw err;
      }
    })();
  }
  return initPromise;
}

/**
 * Reactive accessor indicating whether the Wasm engine is ready
 */
export const isTimeEngineReady: Accessor<boolean> = isReady;

/**
 * Returns the healthcheck status of the engine (e.g. number of available IANA timezones)
 */
export function engine_healthcheck(): string {
  if (!isReady()) return '0';
  return wasm_engine_healthcheck();
}

/**
 * Typed wrapper around search_time_query
 */
export function search_time_query(
  query: string,
  referenceEpochMs: number,
  localTz: string = getBrowserTimeZone()
): SearchResponse {
  if (!isReady()) {
    return {
      parsed_expression_summary: null,
      is_ambiguous: false,
      results: [],
    };
  }
  try {
    const res = wasm_search_time_query(query, referenceEpochMs, localTz);
    return (res as SearchResponse) || { parsed_expression_summary: null, is_ambiguous: false, results: [] };
  } catch (err) {
    console.error('search_time_query error:', err);
    return {
      parsed_expression_summary: null,
      is_ambiguous: false,
      results: [],
    };
  }
}

/**
 * Typed wrapper around resolve_entries
 */
export function resolve_entries(
  entryIds: string[],
  referenceEpochMs: number,
  localTz: string = getBrowserTimeZone()
): ResolvedTimeEntry[] {
  if (!isReady() || !entryIds || entryIds.length === 0) {
    return [];
  }
  try {
    const res = wasm_resolve_entries(entryIds, referenceEpochMs, localTz);
    return (res as ResolvedTimeEntry[]) || [];
  } catch (err) {
    console.error('resolve_entries error:', err);
    return [];
  }
}

/**
 * Typed wrapper around get_entry_details
 */
export function get_entry_details(
  entryId: string,
  referenceEpochMs: number,
  localTz: string = getBrowserTimeZone()
): ResolvedTimeEntry | null {
  if (!isReady() || !entryId) {
    return null;
  }
  try {
    const res = wasm_get_entry_details(entryId, referenceEpochMs, localTz);
    return (res as ResolvedTimeEntry) || null;
  } catch (err) {
    console.error('get_entry_details error:', err);
    return null;
  }
}
