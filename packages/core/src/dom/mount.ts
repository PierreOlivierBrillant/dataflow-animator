import type {
  DataFlowSpec,
  Highlighter,
  Node,
  ObjectContent,
  Packet,
} from '../types';
import { compile } from '../engine/compiler';
import {
  clamp,
  easeInOutCubic,
  evaluate,
  type ActiveClip,
  type ArrowClip,
  type CommentClip,
  type FlowClip,
  type MoveClip,
  type SetContentClip,
} from '../engine/timeline';
import { computeLayout, treeEdgeStyle, type LayoutMap } from '../engine/layout';
import type { Density } from '../engine/scale';
import {
  collectArrowConnections,
  computePortOffsets,
} from '../engine/portOffsets';
import {
  connection,
  pathTip,
  pointAtArc,
  type GeometryMap,
  type NodeGeom,
} from '../engine/geometry';
import { refNode } from '../engine/pins';
import { highlightCode } from '../highlight/highlight';
import { clipOpacity, contentCrossfade } from '../render/clipOpacity';
import { h, s, setStyle, syncStyle } from './el';
import {
  applyArrowElement,
  createArrowElement,
  type ArrowDescriptor,
  type ArrowElement,
} from './arrowElement';
import {
  applyCommentElement,
  createCommentElement,
  type CommentElement,
  type CommentElementOptions,
} from './commentElement';
import { applyCodeFontScale, measureCodeFit } from './contentElement';
import {
  applyPacketPose,
  createPacketElement,
  type PacketPose,
} from './packetElement';
import { netColorMap } from './netColors';
import { HOP_RADIUS, lerp } from './stageConstants';
import { reconcileKeyed, reorder, type KeyedItem } from './reconcile';
import {
  buildZoneLabel,
  buildZoneRect,
  computeZoneBounds,
  zoneKey,
} from './zones';
import {
  buildFlowPath,
  connectionKey,
  createWireContext,
  labelSideMap,
  routeCircuit,
  routesByNodePair,
  type WireContext,
} from './wireModel';
import {
  createGeometryTracker,
  INITIAL_METRICS,
  sameMetrics,
  type StageMetrics,
} from './geometryTracker';
import { settle } from './settle';
import { buildStageModel, type StageModel } from './stageModel';
import { createDebugOverlay } from './debugOverlay';
import {
  autoRotationMap,
  computeNodeStateAtT,
  type NodeStateAtT,
} from './nodeStateAtT';
import {
  applyNodeElement,
  createNodeElement,
  type NodeElement,
  type NodeElementOptions,
} from './nodeElement';
import { computeTreeStateAtT, type TreeStateAtT } from './treeStateAtT';

/** Options accepted by {@link mountStage}. */
export interface StageOptions {
  /** Sizing preset. Default: `'comfortable'` — `Stage`'s own default. */
  density?: Density;
  /**
   * Syntax highlighter for `code` panel bodies. Default: `highlightCode`.
   *
   * It has to reach the stage and not just the JSON dialog: React passes the
   * resolved highlighter to `<Stage>`, where it colours every panel. A renderer
   * that accepted the option and kept using its own default would silently drop
   * a consumer's highlighter for all panel content.
   */
  highlight?: Highlighter;
  /** Renders the timeline debug overlay. Default: false. */
  debug?: boolean;
}

/** Handle returned by {@link mountStage}. */
export interface StageHandle {
  /**
   * The `.rdfa-stage` root. Exposed so a caller that composes the stage with
   * sibling chrome can place it without guessing which child it is.
   */
  readonly el: HTMLElement;
  /**
   * Moves the stage to `t`, MUTATING the DOM that is already there.
   *
   * This is the animated read path: nothing is rebuilt that has not genuinely
   * changed shape, and the convergence loop is not re-run unless the geometry
   * can actually have moved (see `shouldRemeasure` below).
   */
  update(t: number): void;
  /** Detaches the rendered content and releases any resources it holds. */
  destroy(): void;
  /**
   * Measurements the convergence loop performed, and whether it ended on the
   * equality bailout rather than on its budget. Diagnostic only — see
   * `settle.ts` for why the budget is a faithfulness parameter.
   */
  readonly passes: number;
  readonly converged: boolean;
}

/**
 * The measurement budget React spends on a diagram whose nodes never move on
 * their own: one synchronous pass plus three across `requestAnimationFrame`.
 * See `settle.ts`.
 */
const BASE_PASSES = 4;

/**
 * Extra measurements granted to a circuit. Each change of the resolved pin
 * nudge costs React one `forceRemeasure`, and the letterbox effect can add
 * another; the nudge is a pure function of the settled height, so it reaches a
 * fixed point rather than oscillating.
 */
const CIRCUIT_EXTRA_PASSES = 12;

/**
 * Smallest change in a code block's fit ratio worth re-rendering for — the
 * tolerance `Stage`'s `handleCodeFit` applies before it stores a new ratio.
 *
 * It is what TERMINATES the font-fit fixed point: shrinking the font changes the
 * box, which changes the ratio by an ever smaller amount. Without the deadband
 * the two would chase each other indefinitely.
 */
const CODE_FIT_EPSILON = 0.005;

/**
 * The convergence state. Geometry is not the whole picture: a `code` panel also
 * negotiates a COMMON font scale across every code block on the stage, and that
 * scale changes the panels' size — so it belongs in the same fixed point rather
 * than in a loop of its own.
 */
interface FrameMetrics extends StageMetrics {
  codeFontScale: number;
}

/** What the last convergence pass produced, reused to build the wire layer. */
interface SettledFrame {
  metrics: StageMetrics;
  layout: LayoutMap;
  autoRotation: Map<string, number>;
  labelSides: Map<string, 'left' | 'right'>;
  model: StageModel;
}

/** The only inline declaration a flow charge ever carries. */
const FLOW_STYLE_KEYS = ['--rdfa-flow'];

/** A retained flow-charge group: the `<g>` and the dots `apply` moves. */
interface FlowElement {
  g: SVGGElement;
  dots: SVGCircleElement[];
}

/**
 * The stage alone: the diagram, without the control bar or a clock. Emits the
 * `.rdfa-*` markup that `styles/dataflow.css` styles, with no framework runtime.
 *
 * Most callers want {@link mountPlayer} instead; this is the entry point for a
 * host that supplies its own chrome and drives `update(t)` itself.
 *
 * RETAINED MODE. The tree is built once and MUTATED as `t` moves, never rebuilt.
 *
 * The design rule that makes this trustworthy is `build === create + apply`:
 * every element module exposes a `create` that builds only what is independent
 * of `t`, and an `apply` that writes everything that depends on it. Mounting
 * runs both; updating runs `apply` alone. `mount(t₀) + update(t)` is therefore
 * identical to `mount(t)` BY CONSTRUCTION — both paths execute the same writer —
 * rather than by empirical agreement that a gate could only ever spot-check.
 *
 * Two states deliberately survive across updates and make the rendering
 * path-dependent, faithfully to React: `iconGeomByNode` (captured once, never
 * rewritten) and `codeRatios` (gated by a deadband). See `update` below.
 *
 * The layers are split by what can move what. Overlays (arrows, packets,
 * comments, zones) are absolutely positioned: they read the settled geometry and cannot
 * perturb it, so they are reconciled after the loop. A `set_content` panel is
 * not an overlay — it lives inside its node and makes it GROW — so it is applied
 * before the loop, which converges with it in place.
 */
export function mountStage(
  container: HTMLElement,
  spec: DataFlowSpec,
  t: number,
  options: StageOptions = {}
): StageHandle {
  const { timeline } = compile(spec);

  const root = h('div', { class: 'rdfa-stage' });

  // The two overlay layers are created EMPTY, up front. Document order among
  // the root's children is imposed explicitly by `reorderRoot` rather than by
  // insertion order, because several `.rdfa-*` layers share a z-index and break
  // the tie on source order — which must therefore not drift with update
  // history.
  const arrowSvg = s('svg', { class: 'rdfa-arrow-svg' });
  const overlay = h('div', { class: 'rdfa-overlay' });
  root.appendChild(arrowSvg);
  root.appendChild(overlay);

  // The defaults are exactly what React resolves when the corresponding props
  // are omitted, so an options-free call renders what it always did — which is
  // what keeps the A/B grid at 0.0000%.
  const {
    density = 'comfortable',
    highlight = highlightCode,
    debug = false,
  } = options;

  // React renders `<DebugOverlay>` as the LAST child of `.rdfa-stage`, after the
  // overlay layer; `reorderRoot` reproduces that position on every reorder.
  const debugOverlay = debug ? createDebugOverlay(timeline) : undefined;
  if (debugOverlay) root.appendChild(debugOverlay.el);

  // ─── Spec-derived invariants ──────────────────────────────────────────────
  const initialLayout = computeLayout(spec, { aspect: INITIAL_METRICS.aspect });
  const initialAutoRotation = autoRotationMap(initialLayout);
  const initialLabelSides = labelSideMap(
    spec,
    initialLayout,
    initialAutoRotation
  );
  const initialModel = buildStageModel({
    spec,
    layout: initialLayout,
    metrics: INITIAL_METRICS,
    density,
    labelSides: initialLabelSides,
  });

  // Shared by the port-offset computation and the `move`/`arrow` clip key
  // fallback below — one collection, as in `Stage`.
  const lineConnections = collectArrowConnections(spec);
  const packetById = new Map<string, Packet>(
    spec.packets.map((p) => [p.id, p])
  );
  const netColorById = netColorMap(spec);
  const isCircuit = (spec.direction ?? 'left-to-right') === 'circuit';
  const isTree = (spec.direction ?? 'left-to-right') === 'tree';

  // ─── Retained layers ──────────────────────────────────────────────────────
  const nodeEls = new Map<string, NodeElement>();
  const arrowEls = new Map<string, ArrowElement>();
  const flowEls = new Map<string, FlowElement>();
  const packetEls = new Map<string, HTMLElement>();
  const commentEls = new Map<string, CommentElement>();
  let nodeOrder: HTMLElement[] = [];
  let zoneRects: HTMLElement[] = [];
  let zoneLabels: HTMLElement[] = [];

  // ─── Per-frame state, refreshed by `refreshFrame` ─────────────────────────
  let currentT = t;
  let active: ActiveClip[] = [];
  let state: NodeStateAtT;
  let contentByNode: Record<
    string,
    { content: ObjectContent; opacity: number }
  > = {};
  let revealByNode: Record<string, number> = {};
  let activeContentNodeIds = new Set<string>();
  /** `direction: 'tree'` only: the moving layout and the edges to draw at `t`. */
  let treeState: TreeStateAtT | null = null;

  /**
   * Recomputes everything that is a pure function of `t`. No DOM is touched
   * here — this only decides WHAT the frame should look like.
   *
   * `initialAutoRotation` rather than the settled one, deliberately: that is
   * what the frozen-`t` renderer already did, and the A/B grid agrees with React
   * to the pixel on it. Rotation is a function of the layout and not of `t`, so
   * using the same map on every frame is exactly as faithful as using it once.
   */
  const refreshFrame = (tMs: number): void => {
    currentT = tMs;
    active = evaluate(timeline, tMs);
    state = computeNodeStateAtT(spec, active, initialAutoRotation);

    // A node's own `content` shows at full opacity; an active `set_content`
    // overrides it and crossfades. `contentCrossfade` is EASED and drives both
    // the opacity and the icon→panel geometry lerp below — easing them together
    // is what removes the mechanical feel of a linear morph, so they must stay
    // the same number.
    contentByNode = {};
    for (const node of spec.nodes) {
      if (node.content)
        contentByNode[node.id] = { content: node.content, opacity: 1 };
    }
    activeContentNodeIds = new Set<string>();
    for (const a of active) {
      if (a.clip.kind !== 'set_content') continue;
      const clip = a.clip as SetContentClip;
      activeContentNodeIds.add(clip.objectId);
      contentByNode[clip.objectId] = {
        content: clip.content,
        opacity: contentCrossfade(clip, tMs),
      };
    }
    // Revealed fraction: the top-down `clip-path` wipe. Deliberately DECOUPLED
    // from measurement (no geometry input), so it is correct at any `t`.
    revealByNode = {};
    for (const nodeId in contentByNode) {
      const op = contentByNode[nodeId].opacity;
      if (op < 1) revealByNode[nodeId] = op;
    }

    // Tree mode: node positions are a function of `t` too (a rotation glides
    // them), and so is the set of parent→child edges. `initialLayout` is the
    // right base at any time because `treeLayout` — unlike `circularLayout` —
    // ignores the aspect, so a tree's static layout never changes across
    // measurement passes.
    treeState = isTree
      ? computeTreeStateAtT(spec, initialLayout, active, tMs)
      : null;

    // Here rather than in `update`, so the overlay is also correct on the very
    // first frame — this is the one place `active` is recomputed.
    debugOverlay?.update(tMs, active.length);
  };

  // ─── Convergence state ────────────────────────────────────────────────────
  const tracker = createGeometryTracker(root);

  // Seeded with render#1's state, so the wire layer is buildable even if the
  // very first measurement matches the seeds and `apply` never runs.
  let settled: SettledFrame = {
    metrics: INITIAL_METRICS,
    layout: initialLayout,
    autoRotation: initialAutoRotation,
    labelSides: initialLabelSides,
    model: initialModel,
  };
  /** Bumped whenever `settled` is replaced, so derived caches can invalidate. */
  let settledStamp = 0;

  /**
   * Pre-panel ("icon") geometry of nodes driven by an active `set_content`,
   * captured on the FIRST measurement that produced a geometry for them and
   * never overwritten afterwards — as React captures it, and never rewrites it
   * either.
   *
   * This is the renderer's main path dependence, and it is inherited rather than
   * introduced: a fresh `mount` mid-crossfade captures a panel that is already
   * partly grown, where an `update` that walked in from an earlier `t` captured
   * the true icon box. React behaves identically, so "fixing" it here would be a
   * behaviour change, not a bug fix.
   */
  const iconGeomByNode: Record<string, NodeGeom> = {};

  /** Per-block fit ratios, gated by the same deadband `handleCodeFit` applies. */
  const codeRatios: Record<string, number> = {};

  const captureIconGeometry = (geometry: GeometryMap): void => {
    for (const id of activeContentNodeIds) {
      if (!iconGeomByNode[id] && geometry[id])
        iconGeomByNode[id] = geometry[id];
    }
  };

  /**
   * Builds the options one node is drawn from, or `undefined` when the node
   * should not be in the DOM at all (no placement, or fully faded out — React
   * renders nothing in both cases).
   */
  const nodeOptionsFor = (
    node: Node,
    model: StageModel
  ): NodeElementOptions | undefined => {
    const placement = model.placements[node.id];
    if (!placement) return undefined;
    const opacity = state.visibility[node.id] ?? 1;
    if (opacity <= 0) return undefined;
    const content = contentByNode[node.id];
    return {
      placement,
      highlight,
      content: content?.content,
      contentOpacity: content?.opacity,
      reveal: revealByNode[node.id],
      contentLimit: content ? model.contentLimits[node.id] : undefined,
      iconOverride: state.icon[node.id],
      closed: state.closed[node.id],
      loading: state.loading.has(node.id),
      highlighted: state.highlighted.has(node.id),
      opacity: opacity < 1 ? opacity : undefined,
      rotation: state.rotation[node.id],
      colorOverride: state.recolored.has(node.id)
        ? state.color[node.id]
        : undefined,
    };
  };

  /**
   * Reconciles the node layer. Returns whether the node SET changed, which is
   * one of the two things that can move the geometry without a resize.
   */
  const applyNodes = (model: StageModel): boolean => {
    const desired: KeyedItem<{ node: Node; opts: NodeElementOptions }>[] = [];
    for (const node of spec.nodes) {
      const opts = nodeOptionsFor(node, model);
      if (opts) desired.push({ key: node.id, data: { node, opts } });
    }

    let setChanged = false;
    const handles = reconcileKeyed({
      map: nodeEls,
      desired,
      create: (data) => {
        setChanged = true;
        const handle = createNodeElement(data.node);
        // Attached immediately so `apply` can measure through it; `reorderRoot`
        // puts it in its final position.
        root.appendChild(handle.el);
        return handle;
      },
      apply: (handle, data) => applyNodeElement(handle, data.node, data.opts),
      remove: (handle, key) => {
        setChanged = true;
        handle.el.remove();
        // A node that left takes its code block with it, exactly as an
        // unmounting `CodeBlock` drops its entry on the React side. Leaving the
        // ratio behind would keep pinning the COMMON font scale to a panel that
        // is no longer drawn.
        delete codeRatios[key];
      },
    });
    nodeOrder = handles.map((handle) => handle.el);
    return setChanged;
  };

  /**
   * Re-measures every code block and returns the COMMON scale: the minimum
   * across all of them, so no block overflows and — more visibly — every block
   * on the stage renders at exactly the same size.
   *
   * `Math.min(1, ...[])` is 1, which is also React's value before any block has
   * reported, so an all-text stage costs nothing.
   */
  const measureCodeFontScale = (): number => {
    for (const [id, handle] of nodeEls) {
      const target = handle.codeFit;
      if (!target) {
        delete codeRatios[id];
        continue;
      }
      const ratio = measureCodeFit(target);
      if (Math.abs((codeRatios[id] ?? 1) - ratio) >= CODE_FIT_EPSILON)
        codeRatios[id] = ratio;
    }
    return Math.min(1, ...Object.values(codeRatios));
  };

  const applyCodeScale = (scale: number): void => {
    for (const handle of nodeEls.values()) {
      if (handle.codeFit) applyCodeFontScale(handle.codeFit, scale);
    }
  };

  const applyMetrics = (metrics: FrameMetrics): void => {
    // `computeLayout` depends on the measured aspect, so the layout is part of
    // what each pass recomputes — not just the placements derived from it.
    const layout = computeLayout(spec, { aspect: metrics.aspect });
    const autoRotation = autoRotationMap(layout);
    const labelSides = labelSideMap(spec, layout, autoRotation);
    const model = buildStageModel({
      spec,
      layout,
      // A rotation in flight places the nodes from the interpolated layout —
      // sizes and limits keep coming from the static one, so a gliding node
      // never changes size on the way.
      placementLayout: treeState?.reflowing ? treeState.layout : undefined,
      metrics,
      density,
      labelSides,
    });
    setStyle(root, model.stageVars);
    applyNodes(model);
    applyCodeScale(metrics.codeFontScale);
    captureIconGeometry(metrics.geometry);
    settled = { metrics, layout, autoRotation, labelSides, model };
    settledStamp++;
  };

  const maxPasses =
    BASE_PASSES + (initialModel.frameAspect ? CIRCUIT_EXTRA_PASSES : 0);

  const initialFrame: FrameMetrics = { ...INITIAL_METRICS, codeFontScale: 1 };

  const run = (): { passes: number; converged: boolean } =>
    settle<FrameMetrics>({
      initial: initialFrame,
      measure: (previous) => {
        // Order is free: `measureCodeFit` restores the inline font before
        // returning, so the geometry read sees exactly the DOM the pass
        // started with either way.
        const codeFontScale = measureCodeFontScale();
        return { ...tracker.measure(previous), codeFontScale };
      },
      same: (a, b) => a.codeFontScale === b.codeFontScale && sameMetrics(a, b),
      apply: applyMetrics,
      maxPasses,
    });

  /**
   * The model this frame's nodes are placed from.
   *
   * The settled one everywhere except while a tree rotation is in flight: there
   * the placements are a function of `t`, and no geometry change triggers a
   * settle pass, so the frame has to derive them itself. Rebuilding the whole
   * model is deliberate — `buildStageModel` is the single place placements come
   * from — and cheap: it is two O(n²) passes over a handful of tree nodes, and
   * only on the frames of a rotation.
   */
  const frameModel = (): StageModel =>
    treeState?.reflowing
      ? buildStageModel({
          spec,
          layout: settled.layout,
          placementLayout: treeState.layout,
          metrics: settled.metrics,
          density,
          labelSides: settled.labelSides,
        })
      : settled.model;

  // ─── Geometry-derived caches ──────────────────────────────────────────────
  // Port offsets, the wire context and the circuit routes depend on the LAYOUT
  // and the measured geometry, never on `t`. Recomputing them every frame would
  // put A* routing on the animation path for nothing.
  let wireStamp = -1;
  let wireCache: {
    portOffsets: Record<string, { start: number; end: number }>;
    ctx: WireContext;
    circuit: ReturnType<typeof routeCircuit>;
    routeByNodePair: ReturnType<typeof routesByNodePair>;
  } | null = null;

  const wireData = (): NonNullable<typeof wireCache> => {
    if (wireStamp === settledStamp && wireCache) return wireCache;
    const { metrics, layout, autoRotation, labelSides, model } = settled;
    const portOffsets = computePortOffsets(
      lineConnections,
      layout,
      model.routeAspect,
      spec.direction ?? 'left-to-right',
      new Set(
        spec.nodes.filter((n) => n.merge_edges === false).map((n) => n.id)
      )
    );
    const ctx = createWireContext(
      spec,
      layout,
      model.routeAspect,
      portOffsets,
      autoRotation
    );
    const circuit = routeCircuit(
      spec,
      metrics.geometry,
      ctx,
      labelSides,
      model.k
    );
    wireCache = {
      portOffsets,
      ctx,
      circuit,
      routeByNodePair: routesByNodePair(spec, circuit.routes),
    };
    wireStamp = settledStamp;
    return wireCache;
  };

  // Zones read the settled geometry and nothing else, so they are rebuilt when
  // the geometry settles rather than per frame.
  let zoneStamp = -1;
  const rebuildZones = (): void => {
    if (zoneStamp === settledStamp) return;
    for (const el of zoneRects) el.remove();
    for (const el of zoneLabels) el.remove();
    zoneRects = [];
    zoneLabels = [];
    const bounds = computeZoneBounds(spec.zones, settled.metrics.geometry);
    (spec.zones ?? []).forEach((zone, i) => {
      const b = bounds[zoneKey(zone, i)];
      if (!b) return;
      const rect = buildZoneRect(zone, b);
      zoneRects.push(rect);
      root.appendChild(rect);
      if (zone.label) {
        const label = buildZoneLabel(zone, b);
        zoneLabels.push(label);
        root.appendChild(label);
      }
    });
    zoneStamp = settledStamp;
  };

  /**
   * Imposes React's document order on the stage root: zones behind everything,
   * then the arrow layer, the nodes, the zone labels, and the front overlay.
   */
  const reorderRoot = (): void => {
    reorder(root, [
      ...zoneRects,
      arrowSvg,
      ...nodeOrder,
      ...zoneLabels,
      overlay,
      ...(debugOverlay ? [debugOverlay.el] : []),
    ]);
  };

  /**
   * Interpolated geometry for anything that ATTACHES to a node.
   *
   * Mid-crossfade a node is neither its icon nor its full panel. Wires, arrows,
   * packets and comment tails read this so they track the box actually on
   * screen. The factor is `contentCrossfade`, the same eased number driving the
   * opacity. Zones and node PLACEMENTS keep reading the raw geometry, as in
   * `Stage`.
   *
   * A gliding tree node is the same idea applied to POSITION instead of size:
   * the box keeps its measured dimensions and takes the placement it is drawn
   * at this frame, so the parent→child edges follow it through the rotation
   * without a DOM re-measure.
   */
  const effectiveGeometryNow = (model: StageModel): GeometryMap => {
    const { geometry, width, height } = settled.metrics;
    let effective: GeometryMap = geometry;
    let overridden = false;
    for (const a of active) {
      if (a.clip.kind !== 'set_content') continue;
      const nodeId = (a.clip as SetContentClip).objectId;
      const iconGeom = iconGeomByNode[nodeId];
      const currGeom = geometry[nodeId];
      if (!iconGeom || !currGeom) continue;
      const p = contentByNode[nodeId]?.opacity ?? 0;
      if (p >= 1) continue;
      if (!overridden) {
        effective = { ...geometry };
        overridden = true;
      }
      const lH = lerp(iconGeom.labelH ?? 0, currGeom.labelH ?? 0, p);
      const lW = lerp(iconGeom.labelW ?? 0, currGeom.labelW ?? 0, p);
      // Tinted badge outset: resolves toward 0 as the (untinted) panel takes
      // over, so the attachment point never jumps.
      const bo = lerp(
        iconGeom.borderOutset ?? 0,
        currGeom.borderOutset ?? 0,
        p
      );
      effective[nodeId] = {
        id: currGeom.id,
        x: lerp(iconGeom.x, currGeom.x, p),
        y: lerp(iconGeom.y, currGeom.y, p),
        width: lerp(iconGeom.width, currGeom.width, p),
        height: lerp(iconGeom.height, currGeom.height, p),
        ...(lH > 0 ? { labelH: lH } : {}),
        ...(lW > 0 ? { labelW: lW } : {}),
        ...(bo > 0 ? { borderOutset: bo } : {}),
        // Same stage scale as the icon (arrow↔node gap at scale).
        ...(currGeom.scale != null ? { scale: currGeom.scale } : {}),
      };
    }
    // Position last, and unconditionally: where a gliding node IS this frame is
    // decided by the layout, never by a crossfade, which only owns its size.
    if (treeState?.reflowing && width && height) {
      if (!overridden) effective = { ...geometry };
      for (const id in geometry) {
        const placement = model.placements[id];
        if (!placement) continue;
        effective[id] = {
          ...effective[id],
          x: placement.cx * width,
          y: placement.cy * height,
        };
      }
    }
    return effective;
  };

  /**
   * Reconciles every layer that depends on the settled geometry but cannot
   * influence it: zones, wires, arrows, flow charges, packets, comment bubbles.
   *
   * All of them live in absolutely-positioned layers, so they cannot change what
   * `measure()` reads about the nodes — which is why reconciling them after the
   * loop is equivalent to doing it on every pass.
   */
  const reconcileOverlays = (): void => {
    rebuildZones();

    const model = frameModel();
    const { metrics } = settled;
    const { portOffsets, ctx, circuit, routeByNodePair } = wireData();
    const effectiveGeometry = effectiveGeometryNow(model);
    // Identity when nothing is mid-crossfade.
    const obstacles = Object.values(effectiveGeometry);

    // ─── Arrows: tree edges, baseline connections, then `arrow` clips ───────
    const arrowDesired: KeyedItem<ArrowDescriptor>[] = [];

    // Parent→child edges of a `tree`, drawn from the topology reached at `t` so
    // they re-route as the nodes glide through a rotation. Styling is resolved
    // per edge from the `tree` block, keyed by CHILD id so it follows the node
    // through rotations. Anchored bottom-of-parent → top-of-child (vertical
    // axis), and never port-spread: a hierarchy link is the only thing joining
    // its two nodes.
    if (spec.tree) {
      for (const edge of treeState?.edges ?? []) {
        const f = effectiveGeometry[edge.from];
        const tg = effectiveGeometry[edge.to];
        if (!f || !tg || edge.progress <= 0) continue;
        const style = treeEdgeStyle(spec.tree, edge.to);
        arrowDesired.push({
          key: `tree:${edge.from}|${edge.to}`,
          data: {
            from: f,
            to: tg,
            startPortOffset: 0,
            endPortOffset: 0,
            style: style.style,
            path: style.path,
            arrow_head: style.arrow_head,
            text: style.text,
            color: style.color,
            highlighted: style.highlighted,
            progress: edge.progress,
            obstacles,
            axis: 'vertical',
            fromContour: ctx.contourFor(edge.from),
            toContour: ctx.contourFor(edge.to),
          },
        });
      }
    }

    (spec.connections ?? []).forEach((link, i) => {
      const f = effectiveGeometry[refNode(link.from)];
      const tg = effectiveGeometry[refNode(link.to)];
      if (!f || !tg) return;
      const key = connectionKey(link, i);
      const ports = ctx.portsFor(key, link.from, link.to);
      arrowDesired.push({
        key: `conn:${key}`,
        data: {
          from: f,
          to: tg,
          startPortOffset: ports.start,
          endPortOffset: ports.end,
          style: link.style,
          // In a circuit, connections are orthogonal wires with no head.
          path: link.path ?? (isCircuit ? 'step' : undefined),
          arrow_head: link.arrow_head ?? (isCircuit ? 'none' : undefined),
          text: link.text,
          progress: 1,
          color:
            (link.id && state.connectionColor[link.id]) ||
            link.color ||
            netColorById.get(refNode(link.from)),
          highlighted:
            link.highlighted || (!!link.id && state.highlighted.has(link.id)),
          obstacles,
          axis: ctx.axisFor(link.from, link.to),
          fromContour: ctx.contourFor(link.from),
          toContour: ctx.contourFor(link.to),
          route: circuit.routes.get(key),
          hops: circuit.hops.get(key),
          hopRadius: HOP_RADIUS * model.scale,
        },
      });
    });

    // Progressive arrows drawn by an `arrow` action — after the baseline
    // connections, matching React's document order inside the SVG.
    for (const a of active) {
      if (a.clip.kind !== 'arrow') continue;
      const clip = a.clip as ArrowClip;
      const f = effectiveGeometry[refNode(clip.fromId)];
      const tg = effectiveGeometry[refNode(clip.toId)];
      if (!f || !tg) continue;
      // An arrow between two connected nodes shares the connection's port
      // spread, so the animated line lands exactly on the static one.
      let lineKey = clip.id;
      if (!portOffsets[lineKey]) {
        const matchingLine = lineConnections.find(
          (c) => c.from === refNode(clip.fromId) && c.to === refNode(clip.toId)
        );
        if (matchingLine) lineKey = matchingLine.key;
      }
      const ports = ctx.portsFor(lineKey, clip.fromId, clip.toId);
      arrowDesired.push({
        key: `arrow:${clip.id}`,
        data: {
          from: f,
          to: tg,
          startPortOffset: ports.start,
          endPortOffset: ports.end,
          style: clip.style,
          path: clip.path,
          arrow_head: clip.arrow_head,
          text: clip.text,
          progress: a.progress,
          obstacles,
          axis: ctx.axisFor(clip.fromId, clip.toId),
          fromContour: ctx.contourFor(clip.fromId),
          toContour: ctx.contourFor(clip.toId),
        },
      });
    }

    const arrowHandles = reconcileKeyed({
      map: arrowEls,
      desired: arrowDesired,
      create: () => {
        const el = createArrowElement();
        arrowSvg.appendChild(el.g);
        return el;
      },
      apply: (el, desc) => applyArrowElement(el, desc),
      remove: (el) => el.g.remove(),
    });

    // ─── Flow charges: dots riding the wire route(s) ─────────────────────────
    const flowDesired: KeyedItem<{
      clip: FlowClip;
      points: ReturnType<typeof buildFlowPath>;
    }>[] = [];
    for (const a of active) {
      if (a.clip.kind !== 'flow') continue;
      const clip = a.clip as FlowClip;
      const points = buildFlowPath(
        clip.route,
        effectiveGeometry,
        ctx.contourFor,
        ctx.axisFor,
        obstacles,
        routeByNodePair
      );
      if (points.length < 2) continue;
      flowDesired.push({ key: `flow:${clip.id}`, data: { clip, points } });
    }

    const flowHandles = reconcileKeyed({
      map: flowEls,
      desired: flowDesired,
      create: (data) => {
        const g = s('g');
        const dots: SVGCircleElement[] = [];
        for (let j = 0; j < data.clip.count; j++) {
          const dot = s('circle', { class: 'rdfa-flow-charge' });
          dots.push(dot);
          g.appendChild(dot);
        }
        arrowSvg.appendChild(g);
        return { g, dots };
      },
      apply: (el, { clip, points }) => {
        const lapMs = Math.max(1, clip.endMs - clip.animStartMs);
        const raw = (currentT - clip.animStartMs) / lapMs;
        const phase = clip.reverse ? -raw : raw;
        const r = String(3.4 * model.scale);
        el.dots.forEach((dot, j) => {
          let u = phase + j / clip.count;
          u = clip.loop ? ((u % 1) + 1) % 1 : clamp(u, 0, 1);
          const p = pointAtArc(points, u);
          dot.setAttribute('cx', String(p.x));
          dot.setAttribute('cy', String(p.y));
          dot.setAttribute('r', r);
          // Constant key set: the declaration is either there or removed, and
          // `syncStyle` drops the empty attribute either way.
          syncStyle(
            dot,
            clip.color ? { '--rdfa-flow': clip.color } : {},
            FLOW_STYLE_KEYS
          );
        });
      },
      remove: (el) => el.g.remove(),
    });

    reorder(arrowSvg, [
      ...arrowHandles.map((el) => el.g),
      ...flowHandles.map((el) => el.g),
    ]);

    // ─── Packets (move clips) ───────────────────────────────────────────────
    // A packet rides the SAME `connection()` path an arrow between the two
    // nodes would draw, at the eased progress of its clip.
    const packetDesired: KeyedItem<{ object: Packet; pose: PacketPose }>[] = [];
    for (const a of active) {
      if (a.clip.kind !== 'move') continue;
      const clip = a.clip as MoveClip;
      const f = effectiveGeometry[refNode(clip.fromId)];
      const tg = effectiveGeometry[refNode(clip.toId)];
      const object = packetById.get(clip.objectId);
      if (!f || !tg || !object) continue;
      // Same key fallback as the arrow clips: a move along an existing
      // connection adopts its port spread.
      let moveKey = clip.id;
      if (!portOffsets[moveKey]) {
        const matchingLine = lineConnections.find(
          (c) => c.from === refNode(clip.fromId) && c.to === refNode(clip.toId)
        );
        if (matchingLine) moveKey = matchingLine.key;
      }
      const movePorts = ctx.portsFor(moveKey, clip.fromId, clip.toId);
      const conn = connection(
        f,
        tg,
        obstacles,
        movePorts.start,
        movePorts.end,
        undefined,
        ctx.axisFor(clip.fromId, clip.toId),
        ctx.contourFor(clip.fromId),
        ctx.contourFor(clip.toId)
      );
      const pt = pathTip(conn, easeInOutCubic(a.progress));
      const opacity = clipOpacity(clip, currentT);
      packetDesired.push({
        key: `packet:${clip.id}`,
        data: {
          object,
          pose: {
            x: pt.x,
            y: pt.y,
            opacity,
            scale: 0.8 + 0.2 * opacity,
          },
        },
      });
    }

    const packetHandles = reconcileKeyed({
      map: packetEls,
      desired: packetDesired,
      create: (data) => {
        const el = createPacketElement(data.object, highlight);
        overlay.appendChild(el);
        return el;
      },
      apply: (el, data) => applyPacketPose(el, data.pose),
      remove: (el) => el.remove(),
    });

    // ─── Comment bubbles ────────────────────────────────────────────────────
    // Same front layer as the packets, AFTER them — `Stage` emits the two lists
    // in this order and `.rdfa-comment` (z-index 6) has no z-index of its own to
    // fall back on, so document order is what decides overlap.
    const commentDesired: KeyedItem<CommentElementOptions>[] = [];
    for (const a of active) {
      if (a.clip.kind !== 'comment') continue;
      const clip = a.clip as CommentClip;
      const anchor = clip.nextToId
        ? effectiveGeometry[clip.nextToId]
        : undefined;
      // `nextToId` given but unknown (bad ID) → the bubble is dropped, rather
      // than silently promoted to an omniscient one.
      if (clip.nextToId && !anchor) continue;
      commentDesired.push({
        key: `comment:${clip.id}`,
        data: {
          node: anchor,
          text: clip.text,
          // Bubbles fade on the clip's own PROGRESS, not `clipOpacity`.
          opacity: a.progress,
          stageW: metrics.width,
          stageH: metrics.height,
        },
      });
    }

    const commentHandles = reconcileKeyed({
      map: commentEls,
      desired: commentDesired,
      create: (data) => {
        const handle = createCommentElement(data.text, !data.node);
        // Attached before `apply` because placement is a function of the
        // bubble's own rendered size, which needs it in the document.
        overlay.appendChild(handle.el);
        return handle;
      },
      apply: (handle, data) => applyCommentElement(handle, data),
      remove: (handle) => handle.el.remove(),
    });

    reorder(overlay, [
      ...packetHandles,
      ...commentHandles.map((handle) => handle.el),
    ]);

    reorderRoot();
  };

  // ─── Initial mount ────────────────────────────────────────────────────────
  refreshFrame(t);
  // Nodes must exist before the loop starts: `settle` measures BEFORE it
  // applies, so the first measurement has to see the real tree — including any
  // `set_content` panel, which is what makes its node grow.
  applyNodes(initialModel);
  setStyle(root, initialModel.stageVars);
  container.appendChild(root);

  let outcome = run();
  reconcileOverlays();

  const onGeometryChange = (): void => {
    outcome = run();
    reconcileOverlays();
  };

  // Fonts settle AFTER mount: when the webfont lands, every label reflows, the
  // node boxes resize, and React's own ResizeObserver re-converges panel A. A
  // panel B without one would stay frozen on the fallback-font geometry and
  // diff against a settled panel A — so this is required for agreement, not an
  // optimisation.
  tracker.observe(onGeometryChange);

  return {
    el: root,
    update(tMs: number) {
      refreshFrame(tMs);

      // React's `Stage` decides in a layout effect whether the icon→panel
      // transition needs a synchronous re-measure, and these are its two
      // predicates, ported literally. Both are evaluated against the geometry
      // measured BEFORE this frame's content was applied — which is precisely
      // what makes the captured icon geometry the icon's and not the panel's.
      const geometry = settled.metrics.geometry;
      // NB: Array.from rather than spread — Docusaurus Babel in "loose" mode
      // transpiles iterable spread to `[].concat(iterable)`, which does not
      // flatten a Set.
      const hasNew = Array.from(activeContentNodeIds).some(
        (id) => !iconGeomByNode[id] && geometry[id]
      );
      const hasGone = Object.keys(iconGeomByNode).some(
        (id) => !activeContentNodeIds.has(id)
      );
      captureIconGeometry(geometry);
      for (const id of Object.keys(iconGeomByNode)) {
        if (!activeContentNodeIds.has(id)) delete iconGeomByNode[id];
      }

      // Applying the nodes is unconditional — it is the mutation this whole
      // step exists for. Re-MEASURING is not: geometry only moves when a panel
      // grows or shrinks, or when a node enters or leaves the tree.
      const setChanged = applyNodes(frameModel());

      if (hasNew || hasGone || setChanged) {
        outcome = run();
        // A `set_visible` reveal puts a node in the tree that the
        // ResizeObserver has never seen, and a hide leaves it holding one that
        // is gone; re-observing re-synchronises both directions, and is the
        // vanilla counterpart of React's MutationObserver.
        if (setChanged) tracker.observe(onGeometryChange);
      }

      reconcileOverlays();
    },
    destroy() {
      tracker.disconnect();
      root.remove();
      nodeEls.clear();
      arrowEls.clear();
      flowEls.clear();
      packetEls.clear();
      commentEls.clear();
    },
    get passes() {
      return outcome.passes;
    },
    get converged() {
      return outcome.converged;
    },
  };
}
