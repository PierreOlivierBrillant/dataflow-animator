import type { BlockPin, BlockSide, Node } from '../types';
import type { PinDef } from './pins';

/**
 * Size and terminal positions of a `type: 'block'` node, derived from its
 * declared {@link BlockPin}s.
 *
 * ONE function, consumed by two callers that must agree to the pixel: the
 * renderer, which lays the labels out, and `resolvePin`, which tells the router
 * where a wire lands. Two independent formulas here would be the classic
 * hand-synchronised pair — a label drawn at one height, a wire landing at
 * another, drifting apart the first time either side is tweaked.
 *
 * Pure and DOM-free: the box is sized from the DECLARATION (pin counts, label
 * lengths), never from a measurement, so the geometry is known before anything
 * is mounted and is identical on the server.
 */

/** Distance between two terminals on a left/right face, in design px. */
const ROW_H = 20;
/** Distance between two terminals on a top/bottom face, in design px. */
const COL_W = 30;
/** Nominal advance width of a label character; labels are clipped, not
 *  measured, so this only has to be a stable over-estimate. */
const CHAR_W = 6;
/** Height of one label line — the band a top/bottom face claims. */
const LABEL_H = 13;
/** Same for the larger `body` designator drawn in the middle. */
const BODY_CHAR_W = 7.5;
/** Breathing room between a label column and its neighbour. */
const GUTTER = 9;
const MIN_W = 56;
const MIN_H = 44;

/**
 * Space a face's labels claim, in design px, on each of the four edges. The
 * renderer insets the `body` by exactly this, and the terminals are spread over
 * what is LEFT — so a designator never lands on a pin name.
 */
interface BlockPadding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BlockGeometry {
  /** Box width in design px (before `--rdfa-scale`). */
  w: number;
  /** Box height in design px. */
  h: number;
  /** Space claimed by each face's labels, in design px. */
  pad: BlockPadding;
  /** Terminals by name, as box fractions — the same space `PinDef` uses. */
  pins: Record<string, PinDef>;
  /** Declared pins grouped by face, in declaration order, with the label and
   *  the along-face fraction the renderer places them at. */
  rows: { pin: BlockPin; side: BlockSide; label: string; at: number }[];
}

const SIDE_NORMAL: Record<BlockSide, { nx: number; ny: number }> = {
  left: { nx: -1, ny: 0 },
  right: { nx: 1, ny: 0 },
  top: { nx: 0, ny: -1 },
  bottom: { nx: 0, ny: 1 },
};

const SIDES = ['left', 'right', 'top', 'bottom'] as const;

const labelOf = (pin: BlockPin): string => pin.label ?? pin.name;

// Memoised on the NODE OBJECT. A spec is frozen for the lifetime of a mount
// (`mountStage` closes over it and `update(t)` only moves time), so the identity
// is stable and a WeakMap lets the entry die with the spec. Without it a block
// wired to ten terminals recomputes its whole box ten times per resolution pass.
const memo = new WeakMap<Node, BlockGeometry>();

export function blockGeometry(node: Node): BlockGeometry {
  const hit = memo.get(node);
  if (hit) return hit;
  const geom = computeBlockGeometry(node);
  memo.set(node, geom);
  return geom;
}

function computeBlockGeometry(node: Node): BlockGeometry {
  const bySide: Record<BlockSide, BlockPin[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  for (const pin of node.pins ?? []) bySide[pin.side ?? 'left'].push(pin);

  const verticalPins = Math.max(bySide.left.length, bySide.right.length);
  const horizontalPins = Math.max(bySide.top.length, bySide.bottom.length);

  const columnW = (pins: BlockPin[]): number =>
    pins.length
      ? pins.reduce((w, p) => Math.max(w, labelOf(p).length * CHAR_W), 0) +
        GUTTER
      : 0;
  const pad: BlockPadding = {
    left: columnW(bySide.left),
    right: columnW(bySide.right),
    top: bySide.top.length ? LABEL_H : 0,
    bottom: bySide.bottom.length ? LABEL_H : 0,
  };

  const bodyW = node.body ? node.body.length * BODY_CHAR_W + GUTTER : 0;
  const w = Math.max(
    MIN_W,
    pad.left + pad.right + Math.max(bodyW, horizontalPins * COL_W)
  );
  const h = Math.max(MIN_H, pad.top + pad.bottom + verticalPins * ROW_H);

  // Terminals are spread over the face's INNER span — what is left once the
  // perpendicular faces' label bands are taken out — so a left terminal's row
  // and a bottom terminal's label can never claim the same corner. Faces of
  // different sizes still coexist: a 4:1 multiplexer's lone output lands in the
  // middle of that span, exactly between its four inputs, because both are
  // measured against the same band.
  const innerY = h - pad.top - pad.bottom;
  const innerX = w - pad.left - pad.right;

  const pins: Record<string, PinDef> = {};
  const rows: BlockGeometry['rows'] = [];
  for (const side of SIDES) {
    const list = bySide[side];
    const isVertical = side === 'left' || side === 'right';
    list.forEach((pin, i) => {
      const step = (i + 0.5) / list.length;
      const at = isVertical
        ? (pad.top + step * innerY) / h
        : (pad.left + step * innerX) / w;
      pins[pin.name] = {
        ...SIDE_NORMAL[side],
        x: isVertical ? (side === 'left' ? 0 : 1) : at,
        y: isVertical ? at : side === 'top' ? 0 : 1,
      };
      rows.push({ pin, side, label: labelOf(pin), at });
    });
  }
  return { w, h, pad, pins, rows };
}
