import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const watchMode = process.argv.includes('--watch');

// NO `resolve.alias` here, on purpose — the same load-bearing absence as in
// `packages/react/vite.config.ts`.
//
// The core is consumed TWO ways in this repo (see ARCHITECTURE.md, "Two ways to
// consume the core"):
//   - vitest, `tsc` and the validation harness resolve `@dataflow-animator/core`
//     to `../core/src` through an alias, which short-circuits the package's
//     `exports` field;
//   - THIS build must do the opposite and treat the core as an external runtime
//     dependency, so the published bundle imports it instead of inlining it.
//
// Adding an alias back here would silently re-inline the whole engine into
// `dist/index.js` with every test still green — the tests go through the alias
// either way. What catches it is the shape of the artefact, and this package
// renders no markup of its own, so `rdfa-` is a valid canary here (unlike in the
// React bundle, whose pre-mount placeholder makes it a false positive).
export default defineConfig({
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
    // `watch.include` is NOT additive: as soon as it is set, Rollup narrows
    // watching to the matching files only. Only `src/**/*` is listed — the core
    // is external, so its sources cannot affect this bundle; it rebuilds through
    // its own `npm run dev -w @dataflow-animator/core`.
    watch: watchMode ? { include: ['src/**/*'] } : null,
    rollupOptions: {
      external: (id: string) =>
        /^(prismjs|@dataflow-animator\/core)(\/|$)/.test(id),
    },
  },
});
