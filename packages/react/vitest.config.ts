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
      // Raised again at step 3.2, which deleted `schema.ts` — a pure passthrough
      // that inlined the core's JSON Schema and scored 0%, dragging every number
      // down. What remains is `DataFlowPlayer`, `NodeView`, `styleMap` and their
      // tests, all well covered, so the floors move up to just under the measured
      // 97.67/89.58/100/97.67. The two zero-coverage rows left (`index.ts`,
      // `types.ts`) are pure re-export barrels with no executable body.
      thresholds: {
        lines: 97,
        statements: 97,
        functions: 100,
        branches: 89,
      },
    },
  },
});
