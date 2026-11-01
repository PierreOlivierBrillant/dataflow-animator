import { clamp } from './timeline';
import { nodeFootprint, type GeometryMap, type NodeGeom } from './geometry';

/**
 * Where the front layer's floating boxes go — comment bubbles, around what
 * else is on the stage.
 *
 * A bubble used to be placed by one fixed rule (above its node, or top-centre
 * of the stage) that knew nothing else was there: it landed on the packet
 * leaving its node, on another bubble, on a zone's label. Here every bubble
 * weighs a short list of candidate places against the OBSTACLES of its lifetime
 * and takes the first one that covers the least of them.
 *
 * "Of its lifetime" is what keeps a bubble still. Its obstacles are not what is
 * on screen at `t` but everything that will be during the time it is: a packet
 * that leaves its node halfway through counts from the start, along its whole
 * path. So the choice is made once per bubble and holds while it is shown —
 * nothing arriving later can make it jump.
 *
 * Pure: sizes and paths are measured by the caller and handed in.
 */

/** Margin (px) kept between a floating box and the stage edges. */
export const STAGE_PAD = 8;

/** Gap (px) between a bubble and the node it points at. */
export const NODE_GAP = 8;

/** Gap (px) between a bubble and an obstacle it was moved clear of. */
const OBSTACLE_GAP = 6;

/** Overlap (px²) below which two boxes are considered apart — rounding noise. */
const TOUCH = 1;

/** Passes allowed to step a bubble past obstacles that stack up. */
const CLEARING_PASSES = 8;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/**
 * Moves a centre so a box of `size` stays `STAGE_PAD` inside `[0, extent]`.
 *
 * A box with no size yet (not in the document) is left where it is. One too
 * big for the room is pinned to the start edge, as a bubble is.
 */
export function confine(center: number, size: number, extent: number): number {
  if (size <= 0 || extent <= 0) return center;
  const half = size / 2;
  return clamp(
    center,
    STAGE_PAD + half,
    Math.max(STAGE_PAD + half, extent - STAGE_PAD - half)
  );
}

/** Area (px²) two boxes share. */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Smallest box containing all of `boxes`, or `undefined` for none. */
export function unionBox(boxes: Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Leftmost position (px) that keeps a box of width `w` on stage. */
function onStageLeft(left: number, w: number, stageW: number): number {
  return w > 0 && stageW > 0
    ? clamp(left, STAGE_PAD, Math.max(STAGE_PAD, stageW - w - STAGE_PAD))
    : left;
}

/** Topmost position (px) that keeps a box of height `h` on stage. */
function onStageTop(top: number, h: number, stageH: number): number {
  return h > 0 && stageH > 0
    ? clamp(top, STAGE_PAD, Math.max(STAGE_PAD, stageH - h - STAGE_PAD))
    : top;
}

function cover(box: Box, obstacles: Box[]): number {
  let area = 0;
  for (const o of obstacles) area += overlapArea(box, o);
  return area < TOUCH ? 0 : area;
}

/** The candidate covering the least, the earliest one on a tie. */
function leastCovering<T>(
  candidates: T[],
  boxOf: (candidate: T) => Box,
  obstacles: Box[]
): T {
  let best = candidates[0];
  let bestCover = Infinity;
  for (const candidate of candidates) {
    const c = cover(boxOf(candidate), obstacles);
    if (c < bestCover) {
      best = candidate;
      bestCover = c;
    }
  }
  return best;
}

// ─── Bubbles anchored to a node ─────────────────────────────────────────────

/** The part of a node a bubble points at: its axis, and what it must clear. */
export interface Anchor {
  x: number;
  /** Top of the visual. */
  top: number;
  /** Bottom of the node INCLUDING its label: a bubble below must clear both. */
  bottom: number;
}

export function anchorOf(node: NodeGeom): Anchor {
  const f = nodeFootprint(node);
  return { x: node.x, top: f.y, bottom: f.y + f.h };
}

/**
 * A bubble's place relative to its node: which side, and how much further than
 * the usual gap — the distance it was moved to clear something.
 *
 * Relative rather than absolute, so the bubble keeps following its node when
 * the node itself moves (a panel growing in, a tree rotating).
 */
export interface AnchoredPlan {
  side: 'above' | 'below';
  offset: number;
}

export function anchoredBox(
  anchor: Anchor,
  plan: AnchoredPlan,
  size: Size,
  stage: Size
): Box {
  const top =
    plan.side === 'above'
      ? anchor.top - NODE_GAP - plan.offset - size.h
      : anchor.bottom + NODE_GAP + plan.offset;
  return {
    x: onStageLeft(anchor.x - size.w / 2, size.w, stage.w),
    y: onStageTop(top, size.h, stage.h),
    w: size.w,
    h: size.h,
  };
}

/**
 * Steps a bubble away from its node, past every obstacle in its way on that
 * side, until it is clear — or until no further step helps.
 */
function cleared(
  anchor: Anchor,
  side: AnchoredPlan['side'],
  size: Size,
  stage: Size,
  obstacles: Box[]
): AnchoredPlan {
  let plan: AnchoredPlan = { side, offset: 0 };
  for (let pass = 0; pass < CLEARING_PASSES; pass++) {
    const box = anchoredBox(anchor, plan, size, stage);
    let offset = plan.offset;
    for (const o of obstacles) {
      if (overlapArea(box, o) < TOUCH) continue;
      // The offset at which the bubble's edge sits OBSTACLE_GAP past `o`.
      offset = Math.max(
        offset,
        side === 'above'
          ? anchor.top - NODE_GAP - (o.y - OBSTACLE_GAP)
          : o.y + o.h + OBSTACLE_GAP - (anchor.bottom + NODE_GAP)
      );
    }
    if (offset === plan.offset) break;
    plan = { side, offset };
  }
  return plan;
}

/**
 * Picks where a node's bubble goes: right above the node, right below it, then
 * the same two moved clear of what is in the way. The plain places come first —
 * a bubble only floats away from its node to uncover something.
 *
 * The node itself is expected among `obstacles`: that is what turns "above" down
 * when there is no room above, since the stage clamp then pushes it onto the node.
 */
export function planAnchored(
  anchor: Anchor,
  size: Size,
  stage: Size,
  obstacles: Box[]
): AnchoredPlan {
  return leastCovering(
    [
      { side: 'above', offset: 0 },
      { side: 'below', offset: 0 },
      cleared(anchor, 'above', size, stage, obstacles),
      cleared(anchor, 'below', size, stage, obstacles),
    ],
    (plan) => anchoredBox(anchor, plan, size, stage),
    obstacles
  );
}

// ─── Bubbles anchored to nothing ────────────────────────────────────────────

/** An omniscient bubble's place, in stage px. */
export interface FreePlan {
  left: number;
  top: number;
}

/**
 * Picks where an omniscient bubble goes: in the free band ABOVE the diagram,
 * centred in it, then the band below — each centred, then against the left and
 * the right edge.
 *
 * Centred in the band, not pinned to the stage's top edge: on a stage taller
 * than its diagram, the band is the space a reader sees as empty, and a bubble
 * stuck to its top edge read as misplaced. A band too short for the bubble puts
 * it against the stage edge, where the cover score then weighs it against the
 * other band.
 */
export function planFree(
  content: Box | undefined,
  size: Size,
  stage: Size,
  obstacles: Box[]
): FreePlan {
  const lefts = [
    (stage.w - size.w) / 2,
    STAGE_PAD,
    stage.w - size.w - STAGE_PAD,
  ].map((left) => onStageLeft(left, size.w, stage.w));
  if (!content) return { left: lefts[0], top: STAGE_PAD };

  const inBand = (from: number, to: number, edge: number): number =>
    to - from >= size.h + 2 * STAGE_PAD ? (from + to - size.h) / 2 : edge;
  const above = inBand(0, content.y, STAGE_PAD);
  const below = inBand(
    content.y + content.h,
    stage.h,
    stage.h - size.h - STAGE_PAD
  );
  const candidates: FreePlan[] = [];
  for (const top of [above, below])
    for (const left of lefts)
      candidates.push({ left, top: onStageTop(top, size.h, stage.h) });
  return leastCovering(
    candidates,
    (plan) => ({ x: plan.left, y: plan.top, w: size.w, h: size.h }),
    obstacles
  );
}

// ─── A whole timeline's bubbles ─────────────────────────────────────────────

/** One bubble to place, and the time it is on screen. */
interface BubbleRequest {
  id: string;
  /** The node it points at; absent for an omniscient bubble. */
  anchorId?: string;
  startMs: number;
  /** Exclusive. */
  untilMs: number;
}

/** Something else on screen for a while that bubbles should keep clear of. */
export interface TimedObstacle {
  box: Box;
  startMs: number;
  untilMs: number;
}

export type BubblePlan =
  | { anchored: AnchoredPlan; box: Box }
  | { free: FreePlan; box: Box };

export interface BubblePlanInput {
  /** In timeline order — an earlier bubble keeps its place, later ones avoid it. */
  bubbles: BubbleRequest[];
  geometry: GeometryMap;
  stage: Size;
  sizeOf: (id: string) => Size | undefined;
  /** On screen for as long as the stage is: zone labels. */
  fixed: Box[];
  /** On screen for a time: the swept path of each packet. */
  timed: TimedObstacle[];
  /** Zone rectangles — part of the diagram an omniscient bubble frames. */
  zones: Box[];
}

const overlapping = (
  a: { startMs: number; untilMs: number },
  b: { startMs: number; untilMs: number }
): boolean => a.startMs < b.untilMs && b.startMs < a.untilMs;

/**
 * Places every bubble of a timeline, in order. Each one avoids the nodes, the
 * fixed obstacles, the timed ones it shares screen time with, and the bubbles
 * placed before it that it shares screen time with.
 *
 * Bubbles whose size is unknown, or whose node has no geometry (not on screen),
 * get no plan.
 */
export function planBubbles(input: BubblePlanInput): Map<string, BubblePlan> {
  const { geometry, stage, fixed, timed } = input;
  const nodes = Object.values(geometry).map(nodeFootprint);
  const content = unionBox([...nodes, ...input.zones]);
  const placed: { request: BubbleRequest; box: Box }[] = [];
  const plans = new Map<string, BubblePlan>();

  for (const request of input.bubbles) {
    const size = input.sizeOf(request.id);
    if (!size || size.w <= 0 || size.h <= 0) continue;
    const node = request.anchorId ? geometry[request.anchorId] : undefined;
    if (request.anchorId && !node) continue;
    const obstacles = [
      ...nodes,
      ...fixed,
      ...timed.filter((o) => overlapping(o, request)).map((o) => o.box),
      ...placed
        .filter((p) => overlapping(p.request, request))
        .map((p) => p.box),
    ];
    let plan: BubblePlan;
    if (node) {
      const anchor = anchorOf(node);
      const anchored = planAnchored(anchor, size, stage, obstacles);
      plan = { anchored, box: anchoredBox(anchor, anchored, size, stage) };
    } else {
      const free = planFree(content, size, stage, obstacles);
      plan = { free, box: { x: free.left, y: free.top, w: size.w, h: size.h } };
    }
    plans.set(request.id, plan);
    placed.push({ request, box: plan.box });
  }
  return plans;
}
