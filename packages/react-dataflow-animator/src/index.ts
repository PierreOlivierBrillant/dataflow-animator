// Entry point of the library published on npm.
//
// Don't forget to import the stylesheet in your application:
//   import 'react-dataflow-animator/styles.css';

export { DataFlowPlayer } from './DataFlowPlayer';

// Specification and props types.
export type {
  DataFlowSpec,
  DataFlowPlayerProps,
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
} from './types';

// JSON Schema (for API doc / validation).
export { dataFlowSchema } from './schema';
export type { DataFlowSchema } from './schema';

// Extensibility: register your own icons.
//
// v3 — these now drive the framework-agnostic registry in the core. An icon is
// SVG markup or a factory returning an SVGElement, instead of a ReactNode, and
// the getters return an SVGElement. Pointing them at the React registries would
// have left them silently inert, since the player no longer renders through it.
export {
  registerNodeIcon,
  renderNodeIcon as getNodeIcon,
} from '@dataflow-animator/core/dom/icons/nodeIcons';
export {
  registerSubIcon,
  renderSubIcon as getSubIcon,
} from '@dataflow-animator/core/dom/icons/subIcons';
export type { IconSource } from '@dataflow-animator/core/dom/icons/registry';

// Isolated rendering of the visual core of a node (pictogram or panel), outside Stage —
// used by the doc for the types gallery, reusable by the consumer.
export { NodeView } from './components/nodes/NodeView';
export type { NodeViewProps } from './components/nodes/NodeView';

// Default syntax highlighting (reusable / replaceable).
export {
  highlightCode,
  escapeHtml,
} from '@dataflow-animator/core/highlight/highlight';

// Engine (advanced API: timeline compilation and evaluation).
export { compile } from '@dataflow-animator/core/engine/compiler';
export type { CompileResult } from '@dataflow-animator/core/engine/compiler';
export {
  evaluate,
  stepIndexAt,
  nextStop,
  prevStop,
  EMPTY_TIMELINE,
} from '@dataflow-animator/core/engine/timeline';
export type {
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
} from '@dataflow-animator/core/engine/timeline';
export { computeLayout } from '@dataflow-animator/core/engine/layout';
export type {
  LayoutMap,
  NodePlacement,
} from '@dataflow-animator/core/engine/layout';
export type {
  GeometryMap,
  NodeGeom,
} from '@dataflow-animator/core/engine/geometry';
// `useClock` was removed in v3: the player's clock lives in the core and is no
// longer a React hook.
