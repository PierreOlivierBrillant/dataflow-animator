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
      // Raised at step 2.6b. The React renderer — untested `Controls.tsx`,
      // `dynamic/`, `tex/` and the rest, which had dragged the numbers down
      // since the smoke test stopped exercising them in 2.6a — is gone. What
      // remains is `DataFlowPlayer`, `NodeView`, `styleMap` and their tests, all
      // well covered, so the floors move back up to just under the measured
      // 93.4/87.75/85.71/93.4. The zero-coverage rows (`index.ts`, `schema.ts`,
      // `types.ts`) are pure re-export barrels with no executable body.
      thresholds: {
        lines: 93,
        statements: 93,
        functions: 85,
        branches: 87,
      },
    },
  },
});
