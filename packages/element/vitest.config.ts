import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@dataflow-animator/core': fileURLToPath(
        new URL('../core/src', import.meta.url)
      ),
    },
  },
  test: {
    // `node` by default, so the SSR-safety test (importing the barrel with no
    // `HTMLElement` and no `customElements` in scope) gets the environment it
    // needs for free. Files that drive the element opt into jsdom with a
    // per-file environment directive.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      // Set at the measured value. Lines/statements/functions are fully covered
      // and stay pinned there — the package is small enough that anything less
      // means an untested piece of public API.
      //
      // Branches stop at 96 because exactly two arms cannot be reached from the
      // environment that instruments the class: the `class {}` fallback of
      // `ElementBase` and the `typeof customElements === 'undefined'` bail-out are
      // the SSR halves, taken only under the `node` environment of
      // `ssr.test.ts` — which is precisely the file that proves them, and whose
      // coverage v8 does not merge back into the jsdom run of the same source.
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 96,
      },
    },
  },
});
