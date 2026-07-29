import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const watchMode = process.argv.includes('--watch');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The core is a source-only workspace: resolve its subpaths to source so
      // Vite INLINES it into the bundle (it is not in rollupOptions.external).
      '@dataflow-animator/core': fileURLToPath(
        new URL('../core/src', import.meta.url)
      ),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    emptyOutDir: false,
    sourcemap: true,
    // In --watch mode, watch ALL source files. `watch.include` is NOT additive:
    // as soon as it is set, Rollup narrows watching to the matching files only.
    // A CSS-only pattern (which Vite processes before Rollup, so it is otherwise
    // missed) would silently stop watching every `.ts`/`.tsx` in the graph — a
    // lib source edit would then never rebuild `dist/`, and the docs site (which
    // imports the built lib) would serve a stale bundle. The core is inlined from
    // `../core/src`, so it must be watched too — `include` is NOT additive, list
    // both patterns explicitly.
    watch: watchMode ? { include: ['src/**/*', '../core/src/**/*'] } : null,
    rollupOptions: {
      external: (id: string) =>
        /^(react|react-dom|react-icons|prismjs)(\/|$)/.test(id),
    },
  },
});
