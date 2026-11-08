import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    conditions: ['browser', 'development'],
  },
  server: {
    deps: {
      inline: ['@material/material-color-utilities'],
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        inline: ['@material/material-color-utilities'],
      },
    },
  },
});

