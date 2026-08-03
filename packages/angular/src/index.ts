// Public entry point of `@dataflow-animator/angular`.
//
// This barrel IS the package's semver surface. Unlike the custom element's, it has
// NO side effects: an Angular consumer imports the component and lists it in their
// `imports`, so there is nothing to register.
//
// Two imports are needed to get a working player:
//
//   import { DataFlowPlayerComponent } from '@dataflow-animator/angular';
//   // plus, once, anywhere global:
//   import '@dataflow-animator/core/styles.css';   // or angular.json → "styles"
//
// The stylesheet is not optional. Without it the markup mounts and measures, but
// nothing has a size, a colour or a transition — a silent blank box.
//
// What this barrel deliberately does NOT do is mirror the core's runtime API
// (`registerNodeIcon`, `compile`, `dataFlowSchema`…), the way the React binding
// does. Same reasoning as the custom element: the stylesheet import above already
// names the core, so a consumer has it in hand, and re-exporting it would be a
// second semver surface for no gain.

export {
  DataFlowPlayerComponent,
  type DataFlowPlayerMountedEvent,
  type DataFlowPlayerErrorEvent,
} from './DataFlowPlayerComponent';

// ─── Types, straight from @dataflow-animator/core ───────────────────────────
//
// Taken from the core rather than redeclared: one set of spec types no matter
// which package a consumer imports from. Re-exported DIRECTLY here, never routed
// through a local `./types` in an `export type *` — a name transiting through a
// star re-export of an EXTERNAL module cannot be resolved by a declaration
// bundler once the core is externalised (the trap the React binding already paid
// for).
export type {
  DataFlowSpec,
  PlayerTheme,
  PlayerMode,
  Density,
  Highlighter,
  PlayerLabels,
} from '@dataflow-animator/core';
