import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Point at the schema SOURCE only, so the tests (which validate demo specs
      // against the JSON Schema) never pull a built bundle in. It resolves into
      // the core now: `dataFlowSchema` is owned there, and the React package only
      // re-exports it.
      '@dataflow-animator/react': fileURLToPath(
        new URL('../../packages/core/src/schema.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
