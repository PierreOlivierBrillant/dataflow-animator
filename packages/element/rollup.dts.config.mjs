import { dts } from 'rollup-plugin-dts';

// Bundle this package's OWN type surface into a single dist/index.d.ts, and keep
// the core's types OUT of it.
//
// `@dataflow-animator/core` is a real runtime dependency, so copying its
// declarations in here would be a fork waiting to drift: the declaration must
// REFERENCE them by import, so a consumer resolves ONE set of spec types
// whichever of the packages they import from. Listing it in `external` is what
// does that — rollup never loads the module, so
// `export type { DataFlowSpec } from '@dataflow-animator/core'` survives verbatim
// into the output. `respectExternal: false` keeps the plugin from pulling
// external declarations back in.
export default {
  input: 'src/index.ts',
  output: { file: 'dist/index.d.ts', format: 'es' },
  external: (id) => /^(prismjs|@dataflow-animator\/core)(\/|$)/.test(id),
  plugins: [dts({ tsconfig: 'tsconfig.dts.json', respectExternal: false })],
};
