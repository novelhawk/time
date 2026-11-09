import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRoot } from 'solid-js';
import {
  initTimeEngine,
  isTimeEngineReady,
  search_time_query,
  resolve_entries,
  get_entry_details,
} from '../services/timeEngine';
import {
  entries,
  addEntry,
  removeEntry,
  toggleEntry,
  nowMs,
  resolvedClocks,
  searchQuery,
  setSearchQuery,
  searchResults,
  viewMode,
  setViewMode,
  setCustomTime,
  resetToCurrentTime,
  isCustomTime,
  computeTickTarget,
  computeNextDelay,
} from './clockStore';

describe('clockStore & timeEngine', () => {
  beforeAll(async () => {
    // Ensure Wasm engine is initialized with loaded bytes in Node/Vitest
    const wasmPath = path.resolve(process.cwd(), 'src/wasm-pkg/time_engine_wasm_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initTimeEngine(wasmBytes);
  });

  it('initializes the Wasm time engine', () => {
    expect(isTimeEngineReady()).toBe(true);
  });

  it('resolves default clock entries', () => {
    createRoot(dispose => {
      const clocks = resolvedClocks();
      expect(clocks.length).toBeGreaterThanOrEqual(2);

      const localClock = clocks.find(c => c.id === 'local');
      expect(localClock).toBeDefined();
      expect(localClock?.primary_label).toContain('Local');

      const utcClock = clocks.find(c => c.id === 'iana:UTC');
      expect(utcClock).toBeDefined();
      expect(utcClock?.utc_offset_str).toBe('UTC+00:00');

      dispose();
    });
  });

  it('updates localStorage and URL query string when adding/removing entries', () => {
    createRoot(dispose => {
      const initialCount = entries().length;

      // Add Tokyo
      addEntry('iana:Asia/Tokyo');
      expect(entries()).toContain('iana:Asia/Tokyo');
      expect(entries().length).toBe(initialCount + 1);

      // Verify localStorage was updated
      const stored = JSON.parse(localStorage.getItem('time_entries') || '[]');
      expect(stored).toContain('iana:Asia/Tokyo');

      // Verify URL query parameter ?z=
      const url = new URL(window.location.href);
      const zParam = url.searchParams.get('z');
      expect(zParam).toContain('iana:Asia/Tokyo');

      // Remove Tokyo
      removeEntry('iana:Asia/Tokyo');
      expect(entries()).not.toContain('iana:Asia/Tokyo');
      const updatedStored = JSON.parse(localStorage.getItem('time_entries') || '[]');
      expect(updatedStored).not.toContain('iana:Asia/Tokyo');

      const updatedUrl = new URL(window.location.href);
      expect(updatedUrl.searchParams.get('z') || '').not.toContain('iana:Asia/Tokyo');

      dispose();
    });
  });

  it('persists and updates viewMode in localStorage', () => {
    createRoot(dispose => {
      setViewMode('grid');
      expect(viewMode()).toBe('grid');
      expect(localStorage.getItem('time_view_mode')).toBe('grid');

      setViewMode('list');
      expect(viewMode()).toBe('list');
      expect(localStorage.getItem('time_view_mode')).toBe('list');

      dispose();
    });
  });

  it('updates searchResults reactively on query change', () => {
    createRoot(dispose => {
      setSearchQuery('Italy');
      expect(searchQuery()).toBe('Italy');

      const results = searchResults();
      expect(results.length).toBeGreaterThan(0);

      const hasRome = results.some(r => r.id === 'iana:Europe/Rome');
      const hasOffsetGroup = results.some(r => r.kind === 'offset_group');
      expect(hasRome).toBe(true);
      expect(hasOffsetGroup).toBe(true);

      setSearchQuery('');
      dispose();
    });
  });

  it('supports custom reference time / time scrubbing', () => {
    createRoot(dispose => {
      expect(isCustomTime()).toBe(false);

      const fixedMs = 1731099600000; // Nov 8, 2024
      setCustomTime(fixedMs);

      expect(isCustomTime()).toBe(true);
      expect(nowMs()).toBe(fixedMs);

      // Verify resolved clocks use the custom date
      const clocks = resolvedClocks();
      expect(clocks.length).toBeGreaterThan(0);
      expect(clocks[0].formatted_date).toBe('2024-11-08');

      // Reset to live
      resetToCurrentTime();
      expect(isCustomTime()).toBe(false);
      expect(nowMs()).toBeGreaterThan(1731099600000);

      dispose();
    });
  });

  it('rounds up to updated second when falling short within 50ms and compensates drift', () => {
    // 1. Mid-second: stays on current second
    const midSecond = 1731000000350;
    expect(computeTickTarget(midSecond)).toBe(1731000000000);
    expect(computeNextDelay(1731000000000, midSecond)).toBe(650);

    // 2. Before 50ms window (60ms short): stays on current second
    const beforeWindow = 1731000000940;
    expect(computeTickTarget(beforeWindow)).toBe(1731000000000);
    expect(computeNextDelay(1731000000000, beforeWindow)).toBe(60);

    // 3. Exactly on 50ms threshold (50ms short): rounds up early
    const onThreshold = 1731000000950;
    const targetThreshold = computeTickTarget(onThreshold);
    expect(targetThreshold).toBe(1731000001000);
    expect(computeNextDelay(targetThreshold, onThreshold)).toBe(1050);

    // 4. Timer falls short by 2ms (998ms into second): rounds up to new second early
    // and avoids redundant micro-tick by targeting the following second
    const fallsShort = 1731000000998;
    const targetEarly = computeTickTarget(fallsShort);
    expect(targetEarly).toBe(1731000001000);
    expect(computeNextDelay(targetEarly, fallsShort)).toBe(1002);

    // 5. Timer falls short by 1ms (999ms into second)
    const shortBy1ms = 1731000000999;
    const target1ms = computeTickTarget(shortBy1ms);
    expect(target1ms).toBe(1731000001000);
    expect(computeNextDelay(target1ms, shortBy1ms)).toBe(1001);

    // 6. Exactly on boundary
    const exactBoundary = 1731000001000;
    const targetExact = computeTickTarget(exactBoundary);
    expect(targetExact).toBe(1731000001000);
    expect(computeNextDelay(targetExact, exactBoundary)).toBe(1000);

    // 7. Slightly late tick (15ms past boundary)
    const slightlyLate = 1731000001015;
    const targetLate = computeTickTarget(slightlyLate);
    expect(targetLate).toBe(1731000001000);
    expect(computeNextDelay(targetLate, slightlyLate)).toBe(985);

    // 8. Heavy throttle / lag past target + 1000ms: clamped to 0
    const heavilyThrottled = 1731000002100;
    expect(computeNextDelay(1731000001000, heavilyThrottled)).toBe(0);
  });
});
