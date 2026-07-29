import { dts } from 'rollup-plugin-dts';

// Side-effect CSS imports (`import './styles/dataflow.css'`) carry no type; the
// dts bundler would otherwise try to parse them as TS. Resolve them to an empty
// module so they drop out of the flattened declaration entirely.
const ignoreCss = {
  name: 'ignore-css',
  resolveId: (id) => (id.endsWith('.css') ? id : null),
  load: (id) => (id.endsWith('.css') ? '' : null),
};

// Flatten the public type surface into a single self-contained dist/index.d.ts.
// The spec types are imported from the source-only @dataflow-animator/core
// workspace (resolved via tsconfig paths); bundling inlines them so NO published
// declaration references the private core package. React and other peers stay
// external so their types are referenced by import, not inlined.
export default {
  input: 'src/index.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: (id) => /^(react|react-dom|react-icons|prismjs)(\/|$)/.test(id),
  plugins: [ignoreCss, dts({ tsconfig: 'tsconfig.dts.json', respectExternal: false })],
};
