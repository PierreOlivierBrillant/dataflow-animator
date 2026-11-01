import type { Zone } from '../types';
import type { GeometryMap } from '../engine/geometry';
import { h, px, setStyle } from './el';
import {
  NODE_LABEL_GAP,
  ZONE_LABEL_EXTRA_TOP,
  ZONE_LABEL_INSET_X,
  ZONE_LABEL_INSET_Y,
  ZONE_PADDING,
} from './stageConstants';
import { appendRichText } from './richtext';

/**
 * Zone rectangles and their labels — the port of `Stage.tsx`'s
 * `computeZoneBounds` plus the two JSX blocks that consume it.
 *
 * The two are emitted at DIFFERENT points in the document: the rectangles go
 * behind the arrows and nodes, the labels after the nodes (above them, below the
 * animated packets).
 */

export interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The key a zone is addressed by — its id, or its index when unnamed. */
export function zoneKey(zone: Zone, index: number): string {
  return zone.id ?? `__zone_${index}`;
}

export interface ZoneBoundsOptions {
  /** Measured width (px) of each zone's label, by {@link zoneKey}. */
  labelWidths?: Record<string, number>;
  /** Stage size (px): a zone is kept inside it. */
  stage?: { width: number; height: number };
}

/**
 * Computes the bounds (px, relative to the stage) of each zone. Inner zones are
 * resolved before the zones that contain them.
 *
 * Two things a zone answers for besides its members, both because a frame is
 * read as a whole: it is at least as wide as its label (which is `nowrap`, so
 * a short member under a long label used to leave the text running into, then
 * past, the right border), and it never leaves the stage — a member whose
 * panel grows against an edge costs the zone its padding on that side, not
 * its border.
 *
 * Origin: `Stage.tsx` `computeZoneBounds`.
 */
export function computeZoneBounds(
  zones: Zone[] | undefined,
  geometry: GeometryMap,
  options: ZoneBoundsOptions = {}
): Record<string, ZoneBounds> {
  if (!zones?.length) return {};
  const { labelWidths, stage } = options;

  const keys = zones.map(zoneKey);
  const computed: Record<string, ZoneBounds> = {};

  const tryOne = (zone: Zone, key: string): boolean => {
    if (computed[key]) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const id of zone.contains) {
      const g = geometry[id];
      if (g) {
        const lh = g.labelH ?? 0;
        const lw = lh > 0 ? (g.labelW ?? Math.max(g.width * 1.5, 60)) : 0;
        const halfW = Math.max(g.width / 2, lw / 2);
        minX = Math.min(minX, g.x - halfW);
        maxX = Math.max(maxX, g.x + halfW);
        minY = Math.min(minY, g.y - g.height / 2);
        maxY = Math.max(
          maxY,
          g.y + g.height / 2 + (lh > 0 ? NODE_LABEL_GAP + lh : 0)
        );
      } else if (computed[id]) {
        const b = computed[id];
        minX = Math.min(minX, b.x);
        maxX = Math.max(maxX, b.x + b.width);
        minY = Math.min(minY, b.y);
        maxY = Math.max(maxY, b.y + b.height);
      } else if (keys.includes(id)) {
        return false; // sub-zone not yet computed
      }
      // unknown ID → silently ignored
    }
    if (minX === Infinity) return false;
    const topExtra = zone.label ? ZONE_LABEL_EXTRA_TOP : 0;
    const labelW = zone.label ? (labelWidths?.[key] ?? 0) : 0;
    const [x0, x1] = fitSpan(
      minX - ZONE_PADDING,
      maxX + ZONE_PADDING,
      labelW > 0 ? labelW + 2 * ZONE_LABEL_INSET_X : 0,
      stage?.width
    );
    const [y0, y1] = fitSpan(
      minY - ZONE_PADDING - topExtra,
      maxY + ZONE_PADDING,
      0,
      stage?.height
    );
    computed[key] = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    return true;
  };

  // Fixed point: continues as long as zones are resolved (handles nesting).
  let progress = true;
  while (progress) {
    progress = false;
    zones.forEach((zone, i) => {
      if (tryOne(zone, keys[i])) progress = true;
    });
  }

  return computed;
}

/** Room (px) kept between a zone's border and the stage edge. */
const STAGE_INSET = 2;

/**
 * One axis of a zone: `[lo, hi]` widened to `minSize` around its middle, then
 * kept inside `[0, extent]`.
 *
 * The widening only exists for the label, so it may lean: what does not fit on
 * the side of an edge goes to the other side instead of off-stage. Whatever
 * still overflows after that is the zone's own members — clipped, since moving
 * the frame would uncover them.
 */
function fitSpan(
  lo: number,
  hi: number,
  minSize: number,
  extent: number | undefined
): [number, number] {
  const missing = minSize - (hi - lo);
  if (missing > 0) {
    let before = missing / 2;
    let after = missing / 2;
    if (extent) {
      const roomBefore = Math.max(0, lo - STAGE_INSET);
      const roomAfter = Math.max(0, extent - STAGE_INSET - hi);
      if (before > roomBefore) {
        after += before - roomBefore;
        before = roomBefore;
      } else if (after > roomAfter) {
        before += after - roomAfter;
        after = roomAfter;
      }
    }
    lo -= before;
    hi += after;
  }
  if (!extent) return [lo, hi];
  return [Math.max(lo, STAGE_INSET), Math.min(hi, extent - STAGE_INSET)];
}

export function buildZoneRect(zone: Zone, bounds: ZoneBounds): HTMLElement {
  const el = h('div', { class: 'rdfa-zone' });
  setStyle(el, {
    left: px(bounds.x),
    top: px(bounds.y),
    width: px(bounds.width),
    height: px(bounds.height),
    '--rdfa-zone-color': zone.color,
  });
  return el;
}

/**
 * The label, not yet placed. It is measured before the zones are computed —
 * its width is one of their inputs — and only then positioned.
 */
export function createZoneLabel(zone: Zone): HTMLElement {
  const el = h('span', { class: 'rdfa-zone-label' });
  setStyle(el, { '--rdfa-zone-color': zone.color });
  appendRichText(el, zone.label ?? '');
  return el;
}

/** Where a label of the given size sits in its zone, in stage px. */
export function zoneLabelBox(
  bounds: ZoneBounds,
  width: number,
  height: number
): ZoneBounds {
  return {
    x: bounds.x + ZONE_LABEL_INSET_X,
    y: bounds.y + ZONE_LABEL_INSET_Y,
    width,
    height,
  };
}

/** Pins a label to its zone's top-left corner. */
export function placeZoneLabel(el: HTMLElement, bounds: ZoneBounds): void {
  const box = zoneLabelBox(bounds, 0, 0);
  setStyle(el, { left: px(box.x), top: px(box.y) });
}
