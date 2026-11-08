import { describe, it, expect, beforeAll } from 'vitest';
import { render } from 'solid-js/web';
import App from './App';
import { initTimeEngine } from './services/timeEngine';
import {
  viewMode,
  setViewMode,
  setCustomTime,
  isCustomTime,
  resetToCurrentTime,
} from './store/clockStore';
import { useTheme } from './theme/materialTheme';

describe('App Global Shortcuts & Time Scrubbing', () => {
  beforeAll(async () => {
    await initTimeEngine();
  });

  it('handles "v" shortcut to toggle viewMode and "t" to toggle theme', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <App />, container);

    const [theme] = useTheme();

    // 1. "v" shortcut toggles viewMode
    setViewMode('list');
    expect(viewMode()).toBe('list');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(viewMode()).toBe('grid');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(viewMode()).toBe('list');

    // 2. "t" shortcut toggles theme
    const initialDark = theme().isDark;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    expect(theme().isDark).toBe(!initialDark);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    expect(theme().isDark).toBe(initialDark);

    container.remove();
  });

  it('displays custom time banner when scrubbing and restores live time via reset pill', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(() => <App />, container);

    expect(isCustomTime()).toBe(false);

    // Set custom time
    const targetMs = 1784000000000;
    setCustomTime(targetMs);
    expect(isCustomTime()).toBe(true);

    // Verify custom time banner appears in DOM
    const banner = container.querySelector('button[title^="Return to live"]') as HTMLButtonElement;
    expect(banner).toBeDefined();

    // Click reset pill
    banner.click();
    expect(isCustomTime()).toBe(false);

    container.remove();
  });
});
