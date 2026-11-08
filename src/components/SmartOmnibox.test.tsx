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
});
