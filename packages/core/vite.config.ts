import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      // `dist/styles.css`, matching the `./styles.css` export. Library mode
      // EXTRACTS the stylesheet instead of injecting it, so `dist/index.js`
      // carries no CSS import and a consumer must import it explicitly — the
      // contract the README states.
      cssFileName: 'styles',
    },
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      // prismjs is a runtime `dependency`, never inlined: a consumer that
      // already ships Prism must not get a second copy. react-icons is absent on
      // purpose — it is a devDependency of the glyph GENERATOR, and the geometry
      // it produces is already committed in `subIconData.generated.ts`.
      external: (id: string) => /^prismjs(\/|$)/.test(id),
    },
  },
});
