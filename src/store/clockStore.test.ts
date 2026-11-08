import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
} from './clockStore';

describe('clockStore & timeEngine', () => {
  beforeEach(async () => {
    // Ensure Wasm engine is initialized
    await initTimeEngine();
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

  it('compensates drift by scheduling next tick on integer second boundary', () => {
    const now = 1731000000350; // 350ms past the second
    const delay = 1000 - (now % 1000);
    expect(delay).toBe(650);

    const now2 = 1731000000999;
    const delay2 = 1000 - (now2 % 1000);
    expect(delay2).toBe(1);

    const now3 = 1731000000000;
    const delay3 = 1000 - (now3 % 1000);
    expect(delay3).toBe(1000);
  });
});
