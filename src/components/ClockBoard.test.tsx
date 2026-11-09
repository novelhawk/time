import { describe, it, expect, beforeAll } from 'vitest';
import { render } from 'solid-js/web';
import ClockBoard from './ClockBoard';
import ClockCard from './ClockCard';
import TopToolbar from './TopToolbar';
import EntryDetailDrawer from './EntryDetailDrawer';
import {
  initTimeEngine,
  type ResolvedTimeEntry,
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
  reorderEntries,
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

  it('renders TopToolbar with symmetrical 3-item flex layout to center the search bar', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <TopToolbar />, container);

    const toolbarContainer = container.querySelector('header > div') as HTMLElement;
    expect(toolbarContainer).toBeDefined();
    expect(toolbarContainer.className).toContain('flex');
    expect(toolbarContainer.className).toContain('justify-between');

    // 3 children: left spacer, center omnibox container, right buttons container
    const children = Array.from(toolbarContainer.children) as HTMLElement[];
    expect(children.length).toBe(3);

    const [leftSpacer, centerOmnibox, rightButtons] = children;

    // 1. Left spacer: flex-1
    expect(leftSpacer.getAttribute('aria-hidden')).toBe('true');
    expect(leftSpacer.className).toContain('flex-1');

    // 2. Center container: grow-[2] and max-w-2xl
    expect(centerOmnibox.className).toContain('grow-[2]');
    expect(centerOmnibox.className).toContain('max-w-2xl');
    expect(centerOmnibox.querySelector('input')).toBeDefined();

    // 3. Right container: flex-1 with justify-end
    expect(rightButtons.className).toContain('flex-1');
    expect(rightButtons.className).toContain('justify-end');
    expect(rightButtons.querySelectorAll('button').length).toBe(2);

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

  it('allows drag and dropping cards to reorder entries in list and grid views', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <ClockBoard />, container);

    // Initial entries should contain at least 2 items
    reorderEntries(['local', 'iana:UTC']);
    expect(entries()).toEqual(['local', 'iana:UTC']);

    const cards = container.querySelectorAll('article[data-clock-card]');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const firstCard = cards[0] as HTMLElement;
    const secondCard = cards[1] as HTMLElement;

    expect(firstCard.getAttribute('data-clock-id')).toBe('local');
    expect(secondCard.getAttribute('data-clock-id')).toBe('iana:UTC');

    // Create mock DataTransfer
    const mockDataTransfer = {
      data: {} as Record<string, string>,
      effectAllowed: 'none',
      dropEffect: 'none',
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k] || '';
      },
    };

    // 1. Drag start on first card (index 0)
    const dragStartEvt = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragStartEvt, 'dataTransfer', { value: mockDataTransfer });
    firstCard.dispatchEvent(dragStartEvt);

    // 2. Drag over second card (index 1)
    const dragOverEvt = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvt, 'dataTransfer', { value: mockDataTransfer });
    secondCard.dispatchEvent(dragOverEvt);

    // 3. Drop onto second card (index 1)
    const dropEvt = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvt, 'dataTransfer', { value: mockDataTransfer });
    secondCard.dispatchEvent(dropEvt);

    // Verify entries were reordered
    expect(entries()).toEqual(['iana:UTC', 'local']);

    // Verify localStorage updated
    const saved = localStorage.getItem('time_entries');
    expect(saved).toBe(JSON.stringify(['iana:UTC', 'local']));

    // Verify URL query parameter (?z=...)
    expect(window.location.search).toContain('iana%3AUTC%2Clocal');

    // Clean up / reset
    reorderEntries(['local', 'iana:UTC']);
    container.remove();
  });

  it('places day offset DT pill in offsets row and flushes timer to the right in list and grid views', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mockClockDelta: ResolvedTimeEntry = {
      id: 'iana:Asia/Tokyo',
      kind: 'iana',
      primary_label: 'Tokyo',
      subtitle_context: 'Japan',
      formatted_time: '08:45:00',
      formatted_date: '2026-11-09',
      day_delta_from_local: 1,
      utc_offset_str: 'UTC+09:00',
      gmt_offset_str: 'GMT+9',
      local_offset_str: 'Local +08:00',
      abbreviations: [{ code: 'JST', is_currently_active: true, is_year_round: true }],
      uses_dst: false,
      next_transition: null,
      sibling_iana_zones: ['Asia/Tokyo'],
      epoch_ms: 1794181500000,
    };

    // 1. List View
    const listDispose = render(() => <ClockCard clock={mockClockDelta} viewMode="list" />, container);
    const listCard = container.querySelector('article')!;
    expect(listCard.textContent).toContain('DT+1');

    const listTime = listCard.querySelector('time')!;
    expect(listTime.textContent).toBe('08:45:00');

    // The timer container should only hold <time> and be flushed to the right
    const listTimeContainer = listTime.parentElement!;
    expect(listTimeContainer.children.length).toBe(1);
    expect(listTimeContainer.className).toContain('justify-end');
    expect(listTimeContainer.className).toContain('text-right');
    expect(listTimeContainer.textContent?.trim()).toBe('08:45:00');

    listDispose();
    container.innerHTML = '';

    // 2. Grid View
    const gridDispose = render(() => <ClockCard clock={mockClockDelta} viewMode="grid" />, container);
    const gridCard = container.querySelector('article')!;
    expect(gridCard.textContent).toContain('DT+1');

    const gridTime = gridCard.querySelector('time')!;
    expect(gridTime.textContent).toBe('08:45:00');

    const gridTimeContainer = gridTime.parentElement!;
    expect(gridTimeContainer.children.length).toBe(1);
    expect(gridTimeContainer.className).toContain('justify-end');
    expect(gridTimeContainer.className).toContain('text-right');
    expect(gridTimeContainer.className).toContain('border-t');
    expect(gridTimeContainer.textContent?.trim()).toBe('08:45:00');

    gridDispose();
    container.innerHTML = '';

    // 3. Zero day delta: DT pill must NOT appear
    const mockClockZero: ResolvedTimeEntry = {
      ...mockClockDelta,
      id: 'local',
      primary_label: 'Local',
      day_delta_from_local: 0,
    };
    const zeroDispose = render(() => <ClockCard clock={mockClockZero} viewMode="list" />, container);
    const zeroCard = container.querySelector('article')!;
    expect(zeroCard.textContent).not.toContain('DT');
    expect(zeroCard.textContent).toContain('08:45:00');

    zeroDispose();
    container.remove();
  });
});
