import { createSignal, onMount, type Component } from 'solid-js';
import init, { engine_healthcheck } from './wasm-pkg/time_engine_wasm';
import { useTheme, toggleDarkMode } from './theme/materialTheme';

const App: Component = () => {
  const [theme] = useTheme();
  const [timezonesCount, setTimezonesCount] = createSignal<string>('Loading timezones...');

  onMount(async () => {
    try {
      await init();
      const count = engine_healthcheck();
      setTimezonesCount(`${count} IANA timezones loaded`);
    } catch (err) {
      console.error('Failed to initialize Wasm engine:', err);
      setTimezonesCount('Failed to load Wasm engine');
    }
  });

  return (
    <main class="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-6 transition-colors duration-200 font-mono">
      <div class="w-full max-w-md bg-surface-container border border-outline-variant rounded-2xl p-6 shadow-xl text-center flex flex-col items-center gap-6">
        <div>
          <h1 class="text-3xl font-light tracking-widest uppercase text-primary">time</h1>
          <p class="text-xs text-on-surface-variant mt-1" id="engine-healthcheck">
            {timezonesCount()}
          </p>
        </div>

        {/* Material 3 Dynamic Theme Properties */}
        <div class="w-full bg-surface-container-low rounded-xl p-4 border border-outline-variant/50 text-left text-xs space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-on-surface-variant">Theme Seed Color:</span>
            <span class="font-bold text-on-surface flex items-center gap-2">
              <span
                class="inline-block w-3.5 h-3.5 rounded-full border border-outline"
                style={{ "background-color": theme().color }}
              />
              {theme().color}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-on-surface-variant">Mode:</span>
            <span class="font-bold text-on-surface">{theme().isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-on-surface-variant">Contrast Level:</span>
            <span class="font-bold text-on-surface">{theme().contrastLevel}</span>
          </div>
        </div>

        {/* Controls */}
        <div class="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            id="toggle-dark-mode"
            onClick={() => toggleDarkMode()}
            class="px-5 py-2.5 rounded-full bg-primary text-on-primary font-medium text-xs tracking-wider uppercase transition hover:opacity-90 active:scale-95 cursor-pointer shadow-sm"
          >
            Switch to {theme().isDark ? 'Light' : 'Dark'} Mode
          </button>
        </div>
      </div>
    </main>
  );
};

export default App;
