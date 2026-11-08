import { createSignal, onMount, type Component } from 'solid-js';
import init, { engine_healthcheck } from './wasm-pkg/time_engine_wasm';

const App: Component = () => {
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
    <main class="min-h-screen flex flex-col items-center justify-center p-6">
      <div class="text-center font-mono">
        <h1 class="text-3xl font-light tracking-widest uppercase mb-4 text-neutral-300">time</h1>
        <p class="text-sm text-neutral-400" id="engine-healthcheck">
          {timezonesCount()}
        </p>
      </div>
    </main>
  );
};

export default App;
