import { dts } from 'rollup-plugin-dts';

// Bundle this package's OWN type surface into a single dist/index.d.ts, and keep
// the core's types OUT of it.
//
// The direction is the opposite of what it used to be. While the core was
// inlined, its declarations were flattened in here so that no published
// declaration referenced a workspace that was never published. Now that
// `@dataflow-animator/core` is a real runtime dependency, copying its types would
// be a fork waiting to drift: the declaration must REFERENCE them by import, so a
// consumer resolves ONE set of spec types whichever of the two packages they
// import from.
//
// That is what listing it in `external` does — rollup never loads the module, so
// `export type { DataFlowSpec } from '@dataflow-animator/core'` survives verbatim
// into the output. react and the other peers stay external for the same reason.
// `respectExternal: false` keeps the plugin from pulling external declarations
// back in.
//
// The `ignore-css` plugin that used to sit here is gone with the CSS import it
// existed for: this package no longer imports a stylesheet.
export default {
  input: 'src/index.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: (id) =>
    /^(react|react-dom|react-icons|prismjs|@dataflow-animator\/core)(\/|$)/.test(
      id
    ),
  plugins: [dts({ tsconfig: 'tsconfig.dts.json', respectExternal: false })],
};
