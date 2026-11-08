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
  setLiveNowMs,
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

  it('preserves hovered item selection and DOM node identity across time ticks without resetting to first item', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <SmartOmnibox />, container);

    const input = container.querySelector('input')!;
    input.focus();
    setSearchQuery('Europe');

    const results = searchResults();
    expect(results.length).toBeGreaterThan(1);

    const resultRows = container.querySelectorAll('[data-result-item]');
    expect(resultRows.length).toBeGreaterThan(1);

    const secondRow = resultRows[1] as HTMLElement;
    expect(secondRow).toBeDefined();

    // Hover over the second item
    secondRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Second row should now have active selection class
    expect(secondRow.className).toContain('border-l-primary');
    expect(resultRows[0].className).not.toContain('border-l-primary');

    // Simulate time tick by advancing liveNowMs
    setLiveNowMs(Date.now() + 2000);

    // Re-query rows after time tick
    const resultRowsAfterTick = container.querySelectorAll('[data-result-item]');
    const secondRowAfterTick = resultRowsAfterTick[1] as HTMLElement;

    // 1. Strict DOM identity is preserved (not redrawn / replaced)
    expect(secondRowAfterTick).toBe(secondRow);

    // 2. Selection remains on the hovered item and DOES NOT reset to first item
    expect(secondRowAfterTick.className).toContain('border-l-primary');
    expect(resultRowsAfterTick[0].className).not.toContain('border-l-primary');

    // 3. Date string is hidden in the search results
    const dateText = container.textContent;
    expect(dateText).not.toContain('2026-');

    setSearchQuery('');
    container.remove();
  });
});
