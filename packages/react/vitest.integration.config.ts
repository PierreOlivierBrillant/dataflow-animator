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
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
  },
});
