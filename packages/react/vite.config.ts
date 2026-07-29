import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const watchMode = process.argv.includes('--watch');

// NO `resolve.alias` here, on purpose — and that absence is load-bearing.
//
// The core is consumed TWO ways in this repo:
//   - the harness, vitest and tsc resolve `@dataflow-animator/core` to
//     `../core/src` through an alias, which short-circuits the package's
//     `exports` field and is the only way to reach the deep subpaths the harness
//     needs (`/dom/mount`, `/engine/timeline`, `/render/clipOpacity`…);
//   - THIS build must do the opposite and treat the core as an external runtime
//     dependency, so the published bundle imports it instead of inlining it.
//
// Adding an alias back here would silently re-inline the whole engine and
// stylesheet into `dist/index.js` — the bundle would grow ~40x and ship a second
// copy of the core, with every test still green.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      // No `cssFileName`: this package imports no stylesheet at all. The CSS
      // belongs to the core and ships as `@dataflow-animator/core/styles.css`.
    },
    emptyOutDir: false,
    sourcemap: true,
    // In --watch mode, watch ALL source files. `watch.include` is NOT additive:
    // as soon as it is set, Rollup narrows watching to the matching files only.
    // Only `src/**/*` is listed: the core is external now, so its sources cannot
    // affect this bundle — it rebuilds through its own
    // `npm run dev -w @dataflow-animator/core`, and the docs site watches both
    // dists.
    watch: watchMode ? { include: ['src/**/*'] } : null,
    rollupOptions: {
      external: (id: string) =>
        /^(react|react-dom|react-icons|prismjs|@dataflow-animator\/core)(\/|$)/.test(
          id
        ),
    },
  },
});
