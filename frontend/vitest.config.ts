import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Map absolute resolved path of App.js → mock so all components see the same mock
      [path.resolve(__dirname, 'wailsjs/go/main/App')]: path.resolve(__dirname, 'src/test/mocks/wailsjs.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // Two-tier thresholds (issue #51).
      //
      // Global values are a *ratchet floor*, set just below current actuals — a
      // regression gate, not an aspiration. When new untested code lands and
      // coverage drops, CI fails. Raise these whenever real coverage rises so it
      // never falls back. Chasing a global 95% is deliberately avoided: the last
      // few % live in CodeMirror closures (QueryEditor) and App.tsx orchestration
      // glue, which are exercised by e2e — unit-testing them is brittle.
      //
      // Pure-logic dirs get a higher bar: lib/ and hooks/ are cheap to test and
      // should stay near-fully covered, so they're floored well above the global.
      thresholds: {
        lines: 91,
        functions: 90,
        branches: 82,
        statements: 90,
        'src/lib/**': {
          lines: 99,
          functions: 100,
          branches: 90,
          statements: 97,
        },
        'src/hooks/**': {
          lines: 97,
          functions: 95,
          branches: 82,
          statements: 95,
        },
      },
    },
  },
});
