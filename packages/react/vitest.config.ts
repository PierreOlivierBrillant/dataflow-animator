import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@dataflow-animator/core': fileURLToPath(
        new URL('../core/src', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
      // These floors are high because this package is SMALL: once the binding
      // stopped inlining the core, what remained is `DataFlowPlayer`, `NodeView`,
      // `styleMap` and their tests, all well covered — so the floors sit just
      // under the measured 97.67/89.58/100/97.67 rather than at a token value.
      // The two zero-coverage rows (`index.ts`, `types.ts`) are pure re-export
      // barrels with no executable body.
      thresholds: {
        lines: 97,
        statements: 97,
        functions: 100,
        branches: 89,
      },
    },
  },
});
