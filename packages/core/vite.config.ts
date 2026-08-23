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
      //
      // The three muxers are external for a SECOND reason on top of that one:
      // `export/video/encoders.ts` reaches them through `import()`, and only an
      // external specifier survives as a real dynamic import in `dist`. Inlined,
      // rollup would fold them into the main chunk and every consumer would pay
      // ~50 kB for an export button they may never render — which is precisely
      // what the lazy import exists to avoid.
      //
      // The muxers are matched by their RESOLVED PATH as well as their name, and
      // that second half is not belt-and-braces. A dynamic import is tested
      // twice: once as the bare specifier (`webm-muxer`), then again as the
      // absolute file the resolver found
      // (`/…/node_modules/webm-muxer/build/webm-muxer.mjs`). Matching only the
      // first still lets the second through, and the muxer ends up bundled into
      // a local chunk that `dist` ships — externalised in appearance, inlined in
      // fact. prismjs never showed this because its imports are static, and a
      // static import is only ever asked about once.
      //
      // Even matched, rolldown still WRITES the chunks it had already planned;
      // `scripts/prune-orphan-chunks.mjs` deletes them after the build, since
      // nothing reaches them from `index.js`.
      external: [
        /^prismjs(\/|$)/,
        /(^|\/node_modules\/)(webm-muxer|mp4-muxer|gifenc)(\/|$)/,
      ],
    },
  },
});
