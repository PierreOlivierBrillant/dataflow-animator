// Public entry point of `@dataflow-animator/core`.
//
// This barrel IS the package's semver surface: everything reachable from here is
// a promise, everything else is plumbing that may move without notice. The
// framework wrappers consume the same exports as any other caller — there is no
// privileged back door.
//
// Two imports are needed to get a working player:
//
//   import { mountPlayer } from '@dataflow-animator/core';
//   import '@dataflow-animator/core/styles.css';
//
// The stylesheet is not optional. Without it the markup mounts and measures, but
// nothing has a size, a colour or a transition — a silent blank box.

// The one import that makes the build emit `dist/styles.css`. It carries no
// value into the JS bundle: Vite's library mode extracts it, so a consumer of
// the built package still has to import `./styles.css` explicitly (which is why
// this is a side-effect import, not a re-export).
import './styles/dataflow.css';

// ─── Mounting ───────────────────────────────────────────────────────────────
// The whole player — stage, control bar, keyboard shortcuts, clock — in one
// call. `PlayerHandle.destroy()` releases everything it took.
export { mountPlayer } from './dom/player';
export type { PlayerOptions, PlayerHandle } from './dom/player';
// The chrome's strings — what `PlayerOptions.labels` overrides, key by key. The
// English defaults live in the core and are resolved there, so a wrapper passes
// this through untouched instead of re-declaring defaults of its own.
export type { PlayerLabels } from './dom/labels';
// The English defaults as a value, for a host that renders chrome of its own
// BEFORE `mountPlayer` runs — the React binding's pre-mount placeholder reads
// `loading` from here. Exported so that host can fall back to the core's string
// instead of writing a default that drifts from it.
export { DEFAULT_PLAYER_LABELS } from './dom/labels';

// The stage on its own, for a host that brings its own chrome and drives
// `update(t)` itself. `mountPlayer` is built on top of it.
export { mountStage } from './dom/mount';
export type { StageOptions, StageHandle } from './dom/mount';

// ─── Clock ──────────────────────────────────────────────────────────────────
// The rAF playback clock `mountPlayer` creates for itself. Exported so a host
// can drive `mountStage` with the same semantics (capped delta on tab return,
// `playTo` for step navigation) instead of reinventing them.
export { createPlayerClock } from './dom/clock';
export type { PlayerClock, PlayerClockOptions } from './dom/clock';

// ─── Isolated node rendering ────────────────────────────────────────────────
// The visual core of a single node — pictogram, shape, signal pad or panel —
// with no stage around it. What a type gallery or a spec editor's preview needs.
export { renderNodeVisual } from './dom/nodeElement';
export type { NodeVisualOptions } from './dom/nodeElement';

// ─── Icon registries ────────────────────────────────────────────────────────
// Extensibility point: an icon is SVG markup or a `() => SVGElement` factory. A
// registration wins over every built-in. Markup is parsed lazily, on first
// resolution, so registering never touches the DOM and is safe at module scope
// in an SSR bundle. The `render*` getters return a live `SVGElement`; the
// `*Types`/`*Names` getters enumerate what is currently resolvable, built-ins
// and registrations together.
export {
  registerNodeIcon,
  renderNodeIcon,
  nodeIconTypes,
} from './dom/icons/nodeIcons';
export {
  registerSubIcon,
  renderSubIcon,
  subIconNames,
} from './dom/icons/subIcons';
export type { IconSource } from './dom/icons/registry';

// ─── Syntax highlighting ────────────────────────────────────────────────────
// The default highlighter for `code` panels and the JSON dialog (a Prism
// wrapper), and the escaping it falls back to. Both are replaceable: any
// `Highlighter` passed as the `highlight` option takes over.
export { highlightCode, escapeHtml } from './highlight/highlight';

// ─── Engine ─────────────────────────────────────────────────────────────────
// `compile(spec)` → `Timeline`, `evaluate(timeline, t)` → the clips active at
// `t`. Both are pure and DOM-free: a caller can inspect, test or drive the
// animation without ever mounting it.
export { compile } from './engine/compiler';
export type { CompileResult } from './engine/compiler';
export {
  evaluate,
  stepIndexAt,
  nextStop,
  prevStop,
  EMPTY_TIMELINE,
} from './engine/timeline';
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
  SetIconClip,
  RotateClip,
  FlowClip,
  ToggleClip,
  ReflowClip,
} from './engine/timeline';

// Node placement, resolved from the spec alone (ratios, before any measurement).
export { computeLayout } from './engine/layout';
export type { LayoutMap, LayoutOptions, NodePlacement } from './engine/layout';

// Measured geometry — what the renderer resolves at mount and feeds to the
// overlay layers. Types only: producing it requires a live DOM.
export type { GeometryMap, NodeGeom } from './engine/geometry';

// Sizing preset shared by `PlayerOptions.density` and `StageOptions.density`.
export type { Density } from './engine/scale';

// ─── Spec serialisation ─────────────────────────────────────────────────────
// The canonical JSON form of a spec — the same bytes the player's export dialog
// shows, so a caller can use it as a stable structural key.
export { serializeSpec } from './export/json';

// ─── Specification ──────────────────────────────────────────────────────────
// Every type of the JSON specification: `DataFlowSpec` and everything it names.
export * from './types';

// JSON Schema of the specification (API doc / validation), generated from
// `types.ts` and therefore always in step with it.
export { dataFlowSchema } from './schema';
export type { DataFlowSchema } from './schema';
