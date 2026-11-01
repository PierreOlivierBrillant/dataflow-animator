import type { DataFlowSpec } from '../types';
import type { LayoutMap } from '../engine/layout';
import { computeScale, type Density } from '../engine/scale';
import {
  computeContentLimits,
  computePlacements,
  type ContentLimit,
  type ContentRoom,
} from '../engine/placements';
import { circuitFrameAspect, letterbox, type Frame } from './frame';
import { DESIGN_H } from './stageConstants';
import type { StageMetrics } from './geometryTracker';

/**
 * The pure sizing/positioning pipeline — the port of `Stage.tsx` lines 399–459
 * and 1119–1200.
 *
 * No DOM, no measurement of its own: it turns `(spec, layout, metrics)` into the
 * numbers the renderer writes out. Keeping it pure is what makes the convergence
 * loop tractable — each pass is just this function applied to a fresh
 * measurement.
 */

export interface StageModel {
  /** 0 outside a circuit — the diagram then fills the container. */
  frameAspect: number;
  frame: Frame;
  /** Aspect the ROUTER reasons in: the frame's for a circuit, the stage's else. */
  routeAspect: number;
  scale: number;
  /**
   * Width cap of labels, panels, packets and bubbles, in DESIGN px — NOT
   * multiplied by `k`. The stylesheet multiplies it by `--rdfa-scale`, which
   * already carries `k`, exactly as it does every literal length.
   */
  maxW: number;
  contentMaxW: number;
  contentMaxH: number;
  /** Content follows icon scale exactly. */
  contentScale: number;
  /** `frame.h / DESIGN_H` — the design-space multiplier. */
  k: number;
  nudgedLayout: LayoutMap;
  /** Changes when a resolved pin nudge moves; drives an extra measurement. */
  nudgeKey: string;
  /** Per-node `set_content` ceiling, already multiplied by `k` (render units). */
  contentLimits: Record<string, ContentLimit>;
  placements: Record<string, { cx: number; cy: number }>;
  /** Custom properties for the `.rdfa-stage` root, ready for `setStyle`. */
  stageVars: Record<string, string>;
}

export interface StageModelInput {
  spec: DataFlowSpec;
  /** `computeLayout(spec, { aspect })` — the STATIC layout. */
  layout: LayoutMap;
  /**
   * Layout the placements are computed from. Differs from `layout` in tree mode
   * only, where an active reflow interpolates node positions.
   */
  placementLayout?: LayoutMap;
  metrics: StageMetrics;
  density: Density;
  labelSides?: Map<string, 'left' | 'right'>;
  /** Nodes currently showing a panel that shrinks to fit (`shrinksToFit`):
   *  they get the off-centre limits and slide into their room. */
  slidingNodes?: ReadonlySet<string>;
  /** Nodes that show a panel at SOME point — known in advance from the spec. */
  panelNodes?: ReadonlySet<string>;
}

export function buildStageModel(input: StageModelInput): StageModel {
  const { spec, layout, metrics, density, labelSides } = input;
  const { geometry, aspect, width, height } = metrics;

  // A `circuit` schematic is drawn in a FIXED-aspect frame centred in the stage
  // (letterbox), not stretched to fill it — so it routes IDENTICALLY at any
  // container size AND shape. Everything below reasons in this frame.
  const direction = spec.direction ?? 'left-to-right';
  const isCircuit = direction === 'circuit';
  const frameAspect = isCircuit ? circuitFrameAspect(layout) : 0;
  const frame = letterbox(width, height, frameAspect);
  // Attachment-axis decisions must use the FRAME's aspect, not the container's —
  // otherwise a signal pad would pick a different face at a different window
  // shape and the wire would re-route.
  const routeAspect = isCircuit ? frameAspect : aspect;

  // EXACT proportionality: reason in a "design space" of fixed height
  // (DESIGN_H) with the same aspect as the frame. Everything is computed once
  // there — constant for a given aspect — then multiplied by k. A small player
  // is a strictly homogeneous reduction of a large one.
  const k = frame.h > 0 ? frame.h / DESIGN_H : 1;
  const designW = frame.w > 0 && k > 0 ? frame.w / k : 700;
  // Junction dots claim no room: exclude them from the scale spacing so a corner
  // junction next to a component doesn't shrink the whole schematic.
  const compactNodeIds = new Set(
    spec.nodes.filter((n) => n.type === 'junction').map((n) => n.id)
  );
  // Circuit schematics pack their components tighter (the router keeps the wires
  // between them clean), so their symbols and value labels render bigger.
  const design = computeScale(
    layout,
    designW,
    DESIGN_H,
    density,
    compactNodeIds,
    isCircuit ? 0.68 : 1
  );
  const scale = design.scale * k;
  // Left in design px: every rule that reads `--rdfa-maxw` multiplies it by a
  // scale that already holds k, so a k here made those widths grow as k² and
  // a small player wrap its labels and bubbles far more than a large one.
  const maxW = design.maxW;
  const contentMaxW = design.contentMaxW * k;
  const contentMaxH = design.contentMaxH * k;

  // Max panel size per node so a `set_content` never overlaps a neighbour
  // (positions are FIXED and known in advance): beyond this, the content
  // shrinks. Computed in DESIGN space — constant for a given aspect — then
  // scaled by k, exactly like every other length here.
  //
  // Panels slide off-centre into free room only where nodes sit still in stage
  // space: a tree glides them through rotations, and a circuit is compressed
  // into its frame after placement — both keep the centred, symmetric limit.
  const designLimits = computeContentLimits(
    layout,
    designW,
    DESIGN_H,
    design.scale,
    design.contentMaxW,
    design.contentMaxH,
    {
      slide: !isCircuit && direction !== 'tree',
      panelNodes: input.panelNodes,
    }
  );
  const contentLimits: Record<string, ContentLimit> = {};
  const rooms: Record<string, ContentRoom> = {};
  for (const id in designLimits) {
    const { slide } = designLimits[id];
    const sliding = slide && input.slidingNodes?.has(id);
    const limit = sliding ? slide : designLimits[id];
    contentLimits[id] = { maxW: limit.maxW * k, maxH: limit.maxH * k };
    if (sliding)
      rooms[id] = {
        left: slide.room.left * k,
        right: slide.room.right * k,
        up: slide.room.up * k,
        down: slide.room.down * k,
      };
  }

  // Resolve the layout's `pinNudge` — a fraction of a node's height, the only
  // unit it could express — now that the symbols are measured. It shifts a node
  // so its TERMINAL, not its centre, lands on its neighbour's rail, which is
  // what makes the wire straight. Applied in FRAME units and BEFORE
  // computePlacements, so its clamp still keeps the node on canvas.
  const fh = frame.h > 0 ? frame.h : height;
  let nudgedLayout = layout;
  if (fh) {
    let any = false;
    const out: LayoutMap = {};
    for (const id in layout) {
      const p = layout[id];
      const h = geometry[p.pinNudgeRef ?? id]?.height;
      if (!p.pinNudge || !h) {
        out[id] = p;
        continue;
      }
      any = true;
      out[id] = { ...p, cy: p.cy + (p.pinNudge * h) / fh };
    }
    if (any) nudgedLayout = out;
  }

  const nudgeParts: string[] = [];
  for (const id in nudgedLayout)
    if (layout[id]?.pinNudge) nudgeParts.push(`${id}:${nudgedLayout[id].cy}`);
  const nudgeKey = nudgeParts.join('|');

  // Outside tree mode nodes never MOVE: they are only bounded so they don't run
  // off the canvas.
  const placementLayout = input.placementLayout;
  const basePlaced = placementLayout
    ? computePlacements(placementLayout, geometry, width, height)
    : computePlacements(
        nudgedLayout,
        geometry,
        width,
        height,
        undefined,
        labelSides,
        rooms
      );

  // Compress the (0..1) placements into the centred circuit frame, so nodes and
  // wires scale uniformly and never stretch with the container. Identity when
  // there is no frame.
  let placements = basePlaced;
  if (frameAspect && frame.w > 0 && width > 0 && height > 0) {
    const sx = frame.w / width;
    const sy = frame.h / height;
    const ox = frame.offX / width;
    const oy = frame.offY / height;
    const out: Record<string, { cx: number; cy: number }> = {};
    for (const id in basePlaced)
      out[id] = {
        cx: ox + basePlaced[id].cx * sx,
        cy: oy + basePlaced[id].cy * sy,
      };
    placements = out;
  }

  return {
    frameAspect,
    frame,
    routeAspect,
    scale,
    maxW,
    contentMaxW,
    contentMaxH,
    contentScale: scale,
    k,
    nudgedLayout,
    nudgeKey,
    contentLimits,
    placements,
    stageVars: {
      // Unitless numbers; React does not append `px` to custom properties
      // either, so these must stay bare.
      '--rdfa-scale': String(scale),
      '--rdfa-content-scale': String(scale),
      '--rdfa-maxw': `${maxW}px`,
      '--rdfa-content-maxw': `${contentMaxW}px`,
      '--rdfa-content-maxh': `${contentMaxH}px`,
      visibility: width === 0 || height === 0 ? 'hidden' : 'visible',
    },
  };
}
