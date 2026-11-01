import type { ObjectContent } from '../types';
import { clamp } from './timeline';
import type { GeometryMap } from './geometry';

export const PLACEMENT_PAD = 6;

/** Spacing (px) between the bottom of the visual and the label — reflects the `.rdfa-node` CSS gap. */
const LABEL_GAP = 6;

/** Estimated half-size (px) of a neighbor node (pictogram) for layout calculation. */
const NEIGHBOR_HALF = 28;

/** Margin (px) between a panel and a neighbor's box, in layout calculation. */
const CONTENT_NEIGHBOR_GAP = 22;

/** Absolute minimum margin (px, design space) between a set_content panel's edge
 *  and a neighboring icon's edge — guarantees that a packet remains visible
 *  even on thumbnails where CONTENT_NEIGHBOR_GAP × scale becomes too small. */
const MIN_PACKET_VISIBLE_GAP = 40;

/** Minimum panel size (px): below this we stop shrinking (edge case). */
const MIN_CONTENT_BOX = 48;

/**
 * Positions each node at its LAYOUT place, simply clamped so it doesn't
 * go outside the canvas (label included). Nodes are NEVER pushed apart
 * from each other: a set_content lacking space SHRINKS (see computeContentLimits)
 * instead of pushing its neighbors. The one move a panel makes is into its own
 * `rooms` entry, which by construction stops short of every neighbour.
 */
export function computePlacements(
  layout: Record<string, { cx: number; cy: number }>,
  geometry: GeometryMap,
  width: number,
  height: number,
  pad: number = PLACEMENT_PAD,
  /** Nodes whose label is drawn to a SIDE (circuit top/bottom-wired component)
   *  rather than below — their reserved room is horizontal, not vertical. */
  labelSides?: Map<string, 'left' | 'right'>,
  /** Room (px) of the nodes currently showing a `set_content` panel, from
   *  {@link computeContentLimits}: a panel too wide to stay centred on its
   *  node slides into it, toward the side that has the space. */
  rooms?: Record<string, ContentRoom>
): Record<string, { cx: number; cy: number }> {
  const map: Record<string, { cx: number; cy: number }> = {};
  for (const id of Object.keys(layout)) {
    const g = geometry[id];
    if (!g || !width || !height) {
      map[id] = layout[id];
      continue;
    }
    const halfW = g.width / 2;
    const halfH = g.height / 2;
    const room = rooms?.[id];
    const base = room
      ? {
          cx:
            slide(layout[id].cx * width, halfW, room.left, room.right) / width,
          cy: slide(layout[id].cy * height, halfH, room.up, room.down) / height,
        }
      : layout[id];
    const side = labelSides?.get(id);
    if (side && g.labelW) {
      // Side label: it extends horizontally past one face and is vertically
      // centred on the visual, so it reserves room on that HORIZONTAL side (never
      // below). Otherwise a node hugging the left/right edge would clip its text.
      const reach = LABEL_GAP + g.labelW;
      const leftR = (halfW + (side === 'left' ? reach : 0) + pad) / width;
      const rightR = (halfW + (side === 'right' ? reach : 0) + pad) / width;
      const vR = (Math.max(halfH, (g.labelH ?? 0) / 2) + pad) / height;
      map[id] = {
        cx: leftR + rightR < 1 ? clamp(base.cx, leftR, 1 - rightR) : base.cx,
        cy: 2 * vR < 1 ? clamp(base.cy, vR, 1 - vR) : base.cy,
      };
      continue;
    }
    const hwr = (halfW + pad) / width;
    // The label lives UNDER the visual: its height expands the bottom bound, otherwise a
    // node near the bottom edge would have its text clipped by the Stage.
    const labelExtra = g.labelH ? LABEL_GAP + g.labelH : 0;
    const topR = (halfH + pad) / height;
    const botR = (halfH + labelExtra + pad) / height;
    map[id] = {
      cx: 2 * hwr < 1 ? clamp(base.cx, hwr, 1 - hwr) : base.cx,
      cy: topR + botR < 1 ? clamp(base.cy, topR, 1 - botR) : base.cy,
    };
  }
  return map;
}

/**
 * How far (px) a node's panel may reach from the node's layout position on each
 * side before it meets the stage edge or a neighbour's margin.
 */
export interface ContentRoom {
  left: number;
  right: number;
  up: number;
  down: number;
}

export interface ContentLimit {
  maxW: number;
  maxH: number;
}

/** A node's limits: centred, and — where the layout allows — sliding. */
export interface ContentLimits extends ContentLimit {
  /** For a panel allowed to slide off-centre (see `computeContentLimits`). */
  slide?: ContentLimit & { room: ContentRoom };
}

/**
 * Whether a content SHRINKS to fit its panel rather than wrapping in it — the
 * panels the room on a node's free side is worth sliding for. Code shrinks its
 * font, an image and a screen scale down. Text and markup wrap: a narrow panel
 * costs them lines, not legibility, and sliding one would only crowd the
 * diagram for nothing.
 */
export function shrinksToFit(content: ObjectContent): boolean {
  const type = content.type ?? 'text';
  return (
    type === 'code' ||
    type === 'image' ||
    (type === 'html' && content.screen_width != null)
  );
}

/**
 * Centre (px) of a box of half-size `half` laid out at `at`, slid so it stays
 * within `[at − before, at + after]` — unmoved when it already does, or when
 * it is too big for that room anyway.
 */
function slide(
  at: number,
  half: number,
  before: number,
  after: number
): number {
  const lo = at - Math.max(0, before) + half;
  const hi = at + Math.max(0, after) - half;
  return lo <= hi ? clamp(at, lo, hi) : at;
}

/**
 * Computes, for EACH node, the maximum panel (`set_content`) size that
 * fits in its place WITHOUT overlapping its neighbors. Since nodes don't move,
 * this is the ONLY way to prevent a panel from covering another: a panel
 * that is too large must SHRINK (font/content) to respect this limit.
 *
 * PREDICTIVE: we consider ALL nodes in the spec (positions known in advance),
 * even those currently hidden — thus the panel is already small enough BEFORE its
 * neighbors appear, so it can never cover them.
 *
 * Each SIDE is bounded on its own — by the stage edge, or by the closest
 * neighbour on that side of the axis it is most aligned with. The `maxW`/`maxH`
 * of a node are those of a CENTRED panel: twice the smaller side. With `slide`,
 * each node also gets the limits of a panel allowed off-centre, which may use
 * the room on both sides together — a node near an edge borrows the space on
 * its inner side instead of being held to twice its distance to the edge — and
 * the `room` `computePlacements` slides it within. There, a neighbour that also
 * shows a panel at some point is met halfway rather than at its icon, so two
 * panels facing each other share the distance between them.
 *
 * Which of the two a node uses is the caller's call (see {@link shrinksToFit});
 * a layout whose nodes move or get rescaled after placement (a tree rotation, a
 * letterboxed circuit) asks for no `slide` at all.
 *
 * Also bounded by global ceilings `maxW`/`maxH`.
 */
export function computeContentLimits(
  layout: Record<string, { cx: number; cy: number }>,
  width: number,
  height: number,
  scale: number,
  maxW: number,
  maxH: number,
  options: {
    pad?: number;
    slide?: boolean;
    /** Nodes that show a panel at SOME point of the animation. */
    panelNodes?: ReadonlySet<string>;
  } = {}
): Record<string, ContentLimits> {
  const { pad = PLACEMENT_PAD, slide = false, panelNodes } = options;
  const ids = Object.keys(layout);
  const out: Record<string, ContentLimits> = {};
  if (!width || !height) {
    for (const id of ids) out[id] = { maxW, maxH };
    return out;
  }
  const half = NEIGHBOR_HALF * scale;
  // The gap proportional to scale guarantees proportionality on large players;
  // the absolute floor ensures a packet always remains visible on thumbnails
  // where scale is small and would make the gap almost zero.
  const margin = Math.max(CONTENT_NEIGHBOR_GAP * scale, MIN_PACKET_VISIBLE_GAP);
  const gap = half + margin;
  const clampW = (span: number) =>
    Math.max(MIN_CONTENT_BOX, Math.min(maxW, span));
  const clampH = (span: number) =>
    Math.max(MIN_CONTENT_BOX, Math.min(maxH, span));
  for (const id of ids) {
    const nx = layout[id].cx * width;
    const ny = layout[id].cy * height;
    const edges: ContentRoom = {
      left: nx - pad,
      right: width - nx - pad,
      up: ny - pad,
      down: height - ny - pad,
    };
    const centred = { ...edges };
    const shared = { ...edges };
    for (const oid of ids) {
      if (oid === id) continue;
      const dx = layout[oid].cx * width - nx;
      const dy = layout[oid].cy * height - ny;
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const d = horizontal ? Math.abs(dx) : Math.abs(dy);
      const toIcon = d - gap;
      const halfway = panelNodes?.has(oid)
        ? Math.min(toIcon, (d - margin) / 2)
        : toIcon;
      // The neighbor constrains the axis it is most aligned with, on its own
      // side — both sides when it sits exactly on the node.
      const along = horizontal ? dx : dy;
      const sides: (keyof ContentRoom)[] = horizontal
        ? along > 0
          ? ['right']
          : along < 0
            ? ['left']
            : ['left', 'right']
        : along > 0
          ? ['down']
          : along < 0
            ? ['up']
            : ['up', 'down'];
      for (const side of sides) {
        centred[side] = Math.min(centred[side], toIcon);
        shared[side] = Math.min(shared[side], halfway);
      }
    }
    out[id] = {
      maxW: clampW(2 * Math.min(centred.left, centred.right)),
      maxH: clampH(2 * Math.min(centred.up, centred.down)),
      ...(slide
        ? {
            slide: {
              maxW: clampW(
                Math.max(0, shared.left) + Math.max(0, shared.right)
              ),
              maxH: clampH(Math.max(0, shared.up) + Math.max(0, shared.down)),
              room: shared,
            },
          }
        : {}),
    };
  }
  return out;
}
