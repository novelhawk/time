import { describe, it, expect, beforeAll } from 'vitest';
import { render } from 'solid-js/web';
import ClockBoard from './ClockBoard';
import TopToolbar from './TopToolbar';
import EntryDetailDrawer from './EntryDetailDrawer';
import {
  initTimeEngine,
} from '../services/timeEngine';
import {
  viewMode,
  setViewMode,
  resolvedClocks,
  entries,
  addEntry,
  removeEntry,
  selectedEntryId,
  setSelectedEntryId,
  setLiveNowMs,
} from '../store/clockStore';

describe('ClockBoard, TopToolbar & EntryDetailDrawer', () => {
  beforeAll(async () => {
    await initTimeEngine();
  });

  it('toggles between list and grid view mode', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <TopToolbar />, container);

    setViewMode('list');
    expect(viewMode()).toBe('list');

    // Click view mode button
    const viewBtn = container.querySelector('button[aria-label^="Switch to"]') as HTMLButtonElement;
    expect(viewBtn).toBeDefined();

    viewBtn.click();
    expect(viewMode()).toBe('grid');

    viewBtn.click();
    expect(viewMode()).toBe('list');

    container.remove();
  });

  it('renders clock cards with time, offsets, and DST indicators', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <ClockBoard />, container);

    const cards = container.querySelectorAll('article');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const titles = Array.from(container.querySelectorAll('h2')).map(h => h.textContent);
    expect(titles.some(t => t?.includes('Local'))).toBe(true);
    expect(titles.some(t => t?.includes('UTC'))).toBe(true);

    container.remove();
  });

  it('opens EntryDetailDrawer when a clock card is clicked', () => {
    const boardContainer = document.createElement('div');
    const drawerContainer = document.createElement('div');
    document.body.appendChild(boardContainer);
    document.body.appendChild(drawerContainer);

    render(() => <ClockBoard />, boardContainer);
    render(() => <EntryDetailDrawer />, drawerContainer);

    expect(selectedEntryId()).toBeNull();

    // Click first clock card
    const firstCard = boardContainer.querySelector('article') as HTMLElement;
    firstCard.click();

    expect(selectedEntryId()).not.toBeNull();

    // Verify detail drawer renders headers, offsets matrix, and close button
    const drawerTitle = drawerContainer.querySelector('h2');
    expect(drawerTitle).toBeDefined();
    expect(drawerTitle?.textContent).toBeDefined();

    const offsetsMatrix = drawerContainer.querySelector('h3');
    expect(offsetsMatrix?.textContent).toContain('Offsets Matrix');

    // Close drawer
    const closeBtn = drawerContainer.querySelector('button[title^="Close drawer"]') as HTMLButtonElement;
    closeBtn.click();
    expect(selectedEntryId()).toBeNull();

    boardContainer.remove();
    drawerContainer.remove();
  });

  it('inspects Rome and verifies DST transition timeline in EntryDetailDrawer', () => {
    const drawerContainer = document.createElement('div');
    document.body.appendChild(drawerContainer);
    render(() => <EntryDetailDrawer />, drawerContainer);

    setSelectedEntryId('iana:Europe/Rome');

    expect(selectedEntryId()).toBe('iana:Europe/Rome');

    const drawerTitle = drawerContainer.querySelector('h2');
    expect(drawerTitle?.textContent).toBe('Europe/Rome');

    // Sibling zones should be listed
    const siblingsHeading = Array.from(drawerContainer.querySelectorAll('h3')).find(h =>
      h.textContent?.includes('Sibling Zones')
    );
    expect(siblingsHeading).toBeDefined();

    // Close
    setSelectedEntryId(null);
    drawerContainer.remove();
  });

  it('preserves card DOM node identity and hover state across time ticks without redrawing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <ClockBoard />, container);

    const cards = container.querySelectorAll('article[data-clock-card]');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const secondCard = cards[1] as HTMLElement;
    expect(secondCard).toBeDefined();

    // Hover over card
    secondCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Simulate time tick
    setLiveNowMs(Date.now() + 2000);

    const cardsAfterTick = container.querySelectorAll('article[data-clock-card]');
    const secondCardAfterTick = cardsAfterTick[1] as HTMLElement;

    // Strict DOM node identity is preserved: <article> was not destroyed or redrawn
    expect(secondCardAfterTick).toBe(secondCard);

    // Verify date is hidden (no calendar date string like 2026-11-08)
    expect(secondCard.textContent).not.toContain('2026-');

    container.remove();
  });
});
