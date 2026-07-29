// Entry point of the library published on npm.
//
// Two imports are needed to get a working player — the stylesheet belongs to the
// core, which is where the markup it styles is built:
//   import { DataFlowPlayer } from '@dataflow-animator/react';
//   import '@dataflow-animator/core/styles.css';
//
// Everything this file re-exports from the core comes from its TOP-LEVEL barrel,
// never from a subpath. That is deliberate: the core's published `exports` field
// only exposes `.`, `./styles.css` and `./schema.json`, so a subpath import here
// would resolve in this monorepo (the source alias short-circuits `exports`) and
// fail for everyone who installs the package. The barrel is the only contract
// that holds on both sides.

export { DataFlowPlayer } from './DataFlowPlayer';

// Isolated rendering of the visual core of a node (pictogram or panel), outside Stage —
// used by the doc for the types gallery, reusable by the consumer.
export { NodeView } from './components/nodes/NodeView';
export type { NodeViewProps } from './components/nodes/NodeView';

// The React-facing props type — the only type this package owns, since it is the
// only one that names React types.
export type { DataFlowPlayerProps } from './types';

// ─── Re-exported from @dataflow-animator/core ───────────────────────────────
//
// A consumer can import these from the core directly; they are mirrored here so
// that using the React binding never requires reaching for a second package.

// Extensibility: register your own icons.
//
// v3 — these drive the framework-agnostic registry in the core. An icon is SVG
// markup or a factory returning an SVGElement, instead of a ReactNode, and the
// getters return an SVGElement. Pointing them at the React registries would have
// left them silently inert, since the player no longer renders through it.
export {
  registerNodeIcon,
  renderNodeIcon as getNodeIcon,
  registerSubIcon,
  renderSubIcon as getSubIcon,
  // Default syntax highlighting (reusable / replaceable).
  highlightCode,
  escapeHtml,
  // Engine (advanced API: timeline compilation and evaluation).
  compile,
  evaluate,
  stepIndexAt,
  nextStop,
  prevStop,
  EMPTY_TIMELINE,
  computeLayout,
  // JSON Schema (for API doc / validation).
  dataFlowSchema,
} from '@dataflow-animator/core';

export type {
  IconSource,
  CompileResult,
  Timeline,
  Clip,
  ClipKind,
  Step,
  ActiveClip,
  MoveClip,
  ArrowClip,
  LoadingClip,
  SetContentClip,
  CommentClip,
  HighlightClip,
  SetVisibleClip,
  SetColorClip,
  ReflowClip,
  LayoutMap,
  NodePlacement,
  GeometryMap,
  NodeGeom,
  DataFlowSchema,
} from '@dataflow-animator/core';

// Specification types.
//
// Taken straight from the core rather than routed through `./types`: `./types`
// only gets them via `export type *`, and a name that transits through a star
// re-export of an EXTERNAL module cannot be resolved by the declaration bundler
// once the core is externalised.
export type {
  DataFlowSpec,
  Node,
  Connection,
  Zone,
  TreeSpec,
  TreeChildren,
  TreeEdgeStyle,
  Packet,
  Action,
  ActionType,
  ObjectContent,
  PacketContent,
  PacketBody,
  SqlResponseBody,
  SqlResponse,
  Direction,
  NodeType,
  PacketKind,
  LineStyle,
  PathShape,
  ContentType,
  Highlighter,
  HighlightLanguage,
  PlayerTheme,
  PlayerMode,
  // Backward-compatible aliases (removed in v2)
  StaticObject,
  StaticObjectType,
  DynamicObject,
  DynamicObjectType,
} from '@dataflow-animator/core';

// `useClock` was removed in v3: the player's clock lives in the core and is no
// longer a React hook.
