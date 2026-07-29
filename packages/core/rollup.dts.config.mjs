import { dts } from 'rollup-plugin-dts';

// The side-effect stylesheet import in `src/index.ts` carries no type; the dts
// bundler would otherwise try to parse it as TS. Resolve it to an empty module
// so it drops out of the flattened declaration entirely.
const ignoreCss = {
  name: 'ignore-css',
  resolveId: (id) => (id.endsWith('.css') ? id : null),
  load: (id) => (id.endsWith('.css') ? '' : null),
};

// Flatten the public type surface into a single self-contained dist/index.d.ts.
// A plain `tsc` declaration build would emit one `.d.ts` per source file and
// leave the published types stitched together by relative imports into `src/`,
// which is not in `files`. Flattening is what makes the declaration standalone.
// prismjs stays external so its types are referenced by import, not inlined.
export default {
  input: 'src/index.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: (id) => /^prismjs(\/|$)/.test(id),
  plugins: [
    ignoreCss,
    dts({ tsconfig: 'tsconfig.dts.json', respectExternal: false }),
  ],
};
