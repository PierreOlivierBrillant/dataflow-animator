// Public entry point of `@dataflow-animator/element`.
//
// This barrel IS the package's semver surface, and importing it REGISTERS
// `<dataflow-player>` — that side effect is the point of the package, which is
// why `package.json` marks this file as having side effects. With
// `"sideEffects": false` a bundler would be free to drop
// `import '@dataflow-animator/element'` entirely and the tag would never exist.
//
// Two imports are needed to get a working player:
//
//   import '@dataflow-animator/element';
//   import '@dataflow-animator/core/styles.css';
//
// The stylesheet is not optional. Without it the markup mounts and measures, but
// nothing has a size, a colour or a transition — a silent blank box.
//
// What this barrel deliberately does NOT do is mirror the core's runtime API
// (`registerNodeIcon`, `compile`, `dataFlowSchema`…), the way the React binding
// does. The React binding mirrors them so that using it never requires reaching
// for a second package; here that argument does not hold — the stylesheet import
// above already names the core, so a consumer has it in hand. Re-exporting it
// would be a second semver surface for no gain.

export {
  DataFlowPlayerElement,
  defineDataFlowPlayer,
  DEFAULT_TAG_NAME,
  MOUNTED_EVENT,
  ERROR_EVENT,
} from './DataFlowPlayerElement';

// ─── Types, straight from @dataflow-animator/core ───────────────────────────
//
// Taken from the core rather than redeclared: one set of spec types no matter
// which package a consumer imports from. Re-exported DIRECTLY here, never routed
// through a local `./types` in `export type *` — a name transiting through a star
// re-export of an EXTERNAL module cannot be resolved by the declaration bundler
// once the core is externalised (the trap the React binding already paid for).
export type {
  DataFlowSpec,
  PlayerTheme,
  PlayerMode,
  Density,
  Highlighter,
} from '@dataflow-animator/core';

import {
  DataFlowPlayerElement as Element,
  defineDataFlowPlayer as define,
} from './DataFlowPlayerElement';

declare global {
  interface HTMLElementTagNameMap {
    'dataflow-player': Element;
  }
}

// Auto-registration. Guarded inside (`typeof customElements === 'undefined'`
// returns early), so importing this module in an SSR bundle is inert rather than
// fatal. Call `defineDataFlowPlayer('some-other-tag')` yourself only to add a
// second tag name.
define();
