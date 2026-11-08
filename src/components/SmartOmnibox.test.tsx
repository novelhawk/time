import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from 'solid-js/web';
import { createRoot } from 'solid-js';
import SmartOmnibox from './SmartOmnibox';
import {
  initTimeEngine,
  isTimeEngineReady,
} from '../services/timeEngine';
import {
  searchQuery,
  setSearchQuery,
  searchResults,
  entries,
  addEntry,
} from '../store/clockStore';

describe('SmartOmnibox', () => {
  beforeAll(async () => {
    const wasmPath = path.resolve(process.cwd(), 'src/wasm-pkg/time_engine_wasm_bg.wasm');
    const wasmBytes = fs.readFileSync(wasmPath);
    await initTimeEngine(wasmBytes);
  });

  it('renders omnibox input', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <SmartOmnibox />, container);

    const input = container.querySelector('input');
    expect(input).toBeDefined();
    expect(input?.placeholder).toContain('Europe/Rome, Italy, Local+3, PT...');

    container.remove();
  });

  it('shows live search preview for "Italy" with offset group and Europe/Rome', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <SmartOmnibox />, container);

    const input = container.querySelector('input')!;
    input.focus();
    setSearchQuery('Italy');

    expect(searchQuery()).toBe('Italy');

    // Verify search results
    const results = searchResults();
    expect(results.length).toBeGreaterThan(0);

    const hasOffsetGroup = results.some(r => r.kind === 'offset_group');
    const hasRome = results.some(r => r.id === 'iana:Europe/Rome');

    expect(hasOffsetGroup).toBe(true);
    expect(hasRome).toBe(true);

    // Check live preview rows in DOM
    const labels = container.querySelectorAll('.font-mono.text-sm.font-semibold');
    const labelTexts = Array.from(labels).map(l => l.textContent);
    expect(labelTexts).toContain('UTC+01:00');
    expect(labelTexts).toContain('Europe/Rome');

    container.remove();
  });

  it('parses math expression "Europe/Rome + 5" in real time', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <SmartOmnibox />, container);

    const input = container.querySelector('input')!;
    input.focus();
    setSearchQuery('Europe/Rome + 5');

    const results = searchResults();
    expect(results.length).toBeGreaterThan(0);

    const expr = results.find(r => r.kind === 'computed_expression');
    expect(expr).toBeDefined();
    expect(expr?.primary_label).toBe('Europe/Rome + 05:00');
    expect(expr?.utc_offset_str).toBe('UTC+06:00');

    container.remove();
  });

  it('handles keyboard navigation and Enter to add clock', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <SmartOmnibox />, container);

    const input = container.querySelector('input')!;
    input.focus();
    setSearchQuery('Europe/Rome');

    expect(searchResults().length).toBeGreaterThan(0);

    // Press Enter to add
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    expect(entries()).toContain('iana:Europe/Rome');

    container.remove();
  });

  it('correctly shifts active seasonal abbreviation (CEST in July vs CET in November) via @ date syntax', () => {
    // 1. July: Daylight Saving Time active (CEST)
    setSearchQuery('Europe/Rome @ 2026-07-15 14:00');
    const julyResults = searchResults();
    expect(julyResults.length).toBeGreaterThan(0);
    const romeJuly = julyResults.find(r => r.id === 'iana:Europe/Rome');
    expect(romeJuly).toBeDefined();
    expect(romeJuly?.formatted_time).toBe('14:00:00');
    expect(romeJuly?.formatted_date).toBe('2026-07-15');
    expect(romeJuly?.utc_offset_str).toBe('UTC+02:00');

    const cestJuly = romeJuly?.abbreviations.find(b => b.code === 'CEST');
    expect(cestJuly?.is_currently_active).toBe(true);

    const cetJuly = romeJuly?.abbreviations.find(b => b.code === 'CET');
    expect(cetJuly?.is_currently_active).toBe(false);

    // 2. November: Standard Time active (CET)
    setSearchQuery('Europe/Rome @ 2026-11-08 14:00');
    const novResults = searchResults();
    expect(novResults.length).toBeGreaterThan(0);
    const romeNov = novResults.find(r => r.id === 'iana:Europe/Rome');
    expect(romeNov).toBeDefined();
    expect(romeNov?.formatted_time).toBe('14:00:00');
    expect(romeNov?.formatted_date).toBe('2026-11-08');
    expect(romeNov?.utc_offset_str).toBe('UTC+01:00');

    const cetNov = romeNov?.abbreviations.find(b => b.code === 'CET');
    expect(cetNov?.is_currently_active).toBe(true);

    const cestNov = romeNov?.abbreviations.find(b => b.code === 'CEST');
    expect(cestNov?.is_currently_active).toBe(false);

    setSearchQuery('');
  });
});
