import { createSignal, type Accessor } from 'solid-js';
import {
  argbFromHex,
  DynamicColor,
  DynamicScheme,
  MaterialDynamicColors,
  hexFromArgb,
  Hct,
  SchemeTonalSpot,
  SchemeNeutral,
} from '@material/material-color-utilities';

export interface ThemeSettings {
  color: string;
  isDark: boolean;
  contrastLevel: number;
}

const STORAGE_KEY = 'theme_settings';
const DEFAULT_COLOR = '#FF8811';
const DEFAULT_CONTRAST = 0;

export function detectSystemDarkMode(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function createTheme(seedColor: string, isDark: boolean, contrastLevel: number): DynamicScheme {
  const argb = argbFromHex(seedColor);
  const hctSeedColor = Hct.fromInt(argb);
  return new SchemeTonalSpot(hctSeedColor, isDark, contrastLevel, '2025', 'phone');
}

export function applyDynamicTheme(element: HTMLElement, scheme: DynamicScheme): void {
  for (const [key, value] of Object.entries(MaterialDynamicColors)) {
    if (value instanceof DynamicColor && !key.endsWith('PaletteKeyColor')) {
      const tokenName = value.name.replace(/_/g, '-');
      const argb = value.getArgb(scheme);
      const hex = hexFromArgb(argb);
      element.style.setProperty(`--md-sys-color-${tokenName}`, hex);
    }
  }
}

function loadInitialThemeSettings(): ThemeSettings {
  const detected = detectSystemDarkMode();
  const defaultTheme: ThemeSettings = {
    color: DEFAULT_COLOR,
    isDark: detected,
    contrastLevel: DEFAULT_CONTRAST,
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return defaultTheme;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        color: typeof parsed.color === 'string' ? parsed.color : defaultTheme.color,
        isDark: typeof parsed.isDark === 'boolean' ? parsed.isDark : defaultTheme.isDark,
        contrastLevel:
          typeof parsed.contrastLevel === 'number' ? parsed.contrastLevel : defaultTheme.contrastLevel,
      };
    }
  } catch (err) {
    console.warn('Failed to parse theme settings from localStorage:', err);
  }

  return defaultTheme;
}

function saveThemeSettings(settings: ThemeSettings): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to persist theme settings to localStorage:', err);
    }
  }
}

// Reactive Solid.js theme controller
const [theme, setThemeSignal] = createSignal<ThemeSettings>(loadInitialThemeSettings());

export function applyThemeToElement(
  element: HTMLElement = document.documentElement,
  settings: ThemeSettings = theme()
): void {
  const scheme = createTheme(settings.color, settings.isDark, settings.contrastLevel);
  applyDynamicTheme(element, scheme);

  if (settings.isDark) {
    element.classList.add('dark');
    element.style.colorScheme = 'dark';
  } else {
    element.classList.remove('dark');
  }
}

export function updateTheme(
  updates: Partial<ThemeSettings> | ((prev: ThemeSettings) => ThemeSettings)
): void {
  setThemeSignal((prev) => {
    const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
    saveThemeSettings(next);
    if (typeof document !== 'undefined') {
      applyThemeToElement(document.documentElement, next);
    }
    return next;
  });
}

export function toggleDarkMode(): void {
  updateTheme((prev) => ({ ...prev, isDark: !prev.isDark }));
}

export function useTheme(): [
  Accessor<ThemeSettings>,
  (updates: Partial<ThemeSettings> | ((prev: ThemeSettings) => ThemeSettings)) => void
] {
  return [theme, updateTheme];
}

export function getTimeShiftedSeedColor(baseColor: string, date: Date = new Date()): string {
  const argb = argbFromHex(baseColor);
  const hct = Hct.fromInt(argb);
  // Shift hue smoothly across 24-hour cycle (+/- 12 degrees)
  const hours = date.getHours() + date.getMinutes() / 60;
  const hueShift = Math.sin(((hours - 6) / 24) * 2 * Math.PI) * 12;
  const shiftedHct = Hct.from(hct.hue + hueShift, hct.chroma, hct.tone);
  return hexFromArgb(shiftedHct.toInt());
}

// Immediately apply theme in browser environment
if (typeof window !== 'undefined') {
  applyThemeToElement(document.documentElement, theme());

  // Listen to system dark mode changes if user hasn't saved a custom dark mode preference
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      updateTheme({ isDark: e.matches });
    }
  });
}
