/**
 * Vector math: connection points between nodes, anti-collision offset
 * (path shifting) and drawing utilities. All coordinates are relative
 * to the "Stage" container.
 */

import type { PathShape } from '../types';
import type { ConnectionAxis } from './layout';
import type { PinDef } from './pins';
import { shapeWaypoints } from './pathShapes';

export interface Point {
  x: number;
  y: number;
}

/** Measured position and size of a static node, relative to Stage. */
export interface NodeGeom {
  id: string;
  /** Node center. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Height of text label located under visual (px). Undefined if no label. */
  labelH?: number;
  /** Text label width (px). */
  labelW?: number;
  /**
   * Outset (px) of the colored contour beyond the measured visual border: the badge
   * of a tinted pictogram (`background_color`) extends beyond the glyph. Arrows
   * anchor on this contour, so we add this outset to the node's half-extension.
   * 0/missing for shapes and panels (their colored border = measured box).
   */
  borderOutset?: number;
  /**
   * Stage scale (`--rdfa-scale`) at measurement. Scales routing margins
   * (anti-label detour, label anchor) to match nodes. Default: 1.
   */
  scale?: number;
}

export type GeometryMap = Record<string, NodeGeom>;

/**
 * Attachment policy for an edge endpoint that does NOT anchor on one of the four
 * cardinal sides:
 * - `ellipse`: a round node (`circle`). `ports` mirrors {@link Node.ports}:
 *   `'direct'` = the edge meets the outline where the line to the other centre
 *   crosses it (infinite points); a positive integer `N` = the nearest of `N`
 *   evenly-spread points around the outline.
 * - `pin`: a named terminal of an electrical component (see `pins.ts`). The edge
 *   meets that exact terminal, rotated by the node's `rotationDeg`, and leaves
 *   along its outward normal.
 */
export type NodeContour =
  | { kind: 'ellipse'; ports: 'direct' | number }
  | { kind: 'pin'; pin: PinDef; rotationDeg: number }
  // A dimensionless connection point (a `junction` dot): every edge meets its
  // exact centre, leaving/arriving radially. Unlike a cardinal face, no label
  // shift and no box-size offset — so wires to a labelled junction stay aligned.
  | { kind: 'point' };

/**
 * Resolves a node's contour policy from its spec (`type` + `ports`). A round
 * node (`circle`) anchors on its outline; a `junction` anchors at its exact
 * centre (a point); every other type keeps cardinal-side anchoring (so `ports`
 * is ignored there). Centralised here so the renderer and any future caller
 * derive the SAME contour. (Pin contours are resolved by the renderer per
 * endpoint, since they depend on the terminal name carried by the connection.)
 */
export function nodeContour(
  type: string,
  ports?: 'direct' | number
): NodeContour | undefined {
  // A junction dot connects at its exact centre (wires meet AT the dot). A
  // signal I/O pad is a real box: its wire attaches on the SIDE (cardinal face),
  // like any other node — never from the middle of the pad.
  if (type === 'junction') return { kind: 'point' };
  if (type !== 'circle') return undefined;
  return { kind: 'ellipse', ports: ports ?? 'direct' };
}

/** Routing margin (px, at scale 1): detour around a third-party label and
 *  median label anchor shift. NOT the anchor (arrow touches border).
 *  Scaled by `NodeGeom.scale` in {@link connection}. */
const NODE_GAP = 14;

/** Spacing (px) between visual bottom and label top (CSS gap). */
const LABEL_GAP = 6;

export interface Connection {
  start: Point;
  end: Point;
  /**
   * Intermediate path points, traversed by arc length. Depending on
   * {@link PathShape}: anti-collision detours (straight), corners (step) or
   * curve samples (bezier/simplebezier/smoothstep). Undefined = direct
   * straight line.
   */
  waypoints?: Point[];
  /** Last segment angle in degrees (useful for orienting an arrowhead). */
  angleDeg: number;
  /**
   * Median label anchor. Undefined when path midpoint is clear (render
   * then falls back on this midpoint); defined and shifted perpendicularly
   * to the line when midpoint would fall on an interleaved node's visual.
   */
  labelAnchor?: Point;
}

/** Bounding rect of a node's VISUAL body (centre-anchored). Used as an obstacle
 *  for orthogonal wires, which must never cross a component. */
function bodyBounds(node: NodeGeom): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return {
    x: node.x - node.width / 2,
    y: node.y - node.height / 2,
    w: node.width,
    h: node.height,
  };
}

/**
 * Bounding rect of a node's label (under visual), or null if no label.
 */
function labelBounds(
  node: NodeGeom
): { x: number; y: number; w: number; h: number } | null {
  if (!node.labelH || node.labelH <= 0) return null;
  const lw = node.labelW ?? Math.max(node.width * 1.5, 60);
  return {
    x: node.x - lw / 2,
    y: node.y + node.height / 2 + LABEL_GAP,
    w: lw,
    h: node.labelH,
  };
}

/**
 * What a node covers on the stage: its visual body plus, when it has one, the
 * label under it. What an overlay placed AROUND a node has to keep clear of.
 */
export function nodeFootprint(node: NodeGeom): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const body = bodyBounds(node);
  const label = labelBounds(node);
  if (!label) return body;
  const x = Math.min(body.x, label.x);
  return {
    x,
    y: body.y,
    w: Math.max(body.x + body.w, label.x + label.w) - x,
    h: label.y + label.h - body.y,
  };
}

/**
 * Returns entry/exit t parameters of a p1→p2 segment in a rect,
 * or null if no intersection (slabs method).
 */
function segmentIntersectsRect(
  p1: Point,
  p2: Point,
  rect: { x: number; y: number; w: number; h: number }
): { tEntry: number; tExit: number } | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-10) {
    if (p1.x < rect.x || p1.x > rect.x + rect.w) return null;
  } else {
    const t1 = (rect.x - p1.x) / dx;
    const t2 = (rect.x + rect.w - p1.x) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }

  if (Math.abs(dy) < 1e-10) {
    if (p1.y < rect.y || p1.y > rect.y + rect.h) return null;
  } else {
    const t1 = (rect.y - p1.y) / dy;
    const t2 = (rect.y + rect.h - p1.y) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }

  if (tMin > tMax + 1e-10) return null;
  return { tEntry: tMin, tExit: tMax };
}

/** The 4 cardinal faces on which an arrow can anchor. */
type Face = 'east' | 'west' | 'north' | 'south';

/**
 * Cardinal anchor point for an arrow: placed EXACTLY on node contour
 * (visual border + `borderOutset`, i.e. colored border for a tinted node)
 * — arrow TOUCHES border, no margin added (per user request).
 *
 * - Lateral faces (east/west): transverse coordinate `y` goes down to center
 *   of gravity of *visual + label* block — label under node unbalances it
 *   downwards, so lateral anchor at center of visual alone would look too
 *   high — and receives `portOffset` (intra-pair spread / fan-out).
 * - South face: passes UNDER label (which is part of bottom footprint); thus
 *   does not touch colored border, label intervenes (only intended exception).
 * - Vertical faces (north/south): `portOffset` shifts `x` coordinate.
 */
function cardinalAttach(node: NodeGeom, face: Face, portOffset: number): Point {
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const outset = node.borderOutset ?? 0;
  const labelH = node.labelH ?? 0;
  // Vertical center of gravity of the block: descends by half the extension
  // added by the label under the visual (CSS gap + label height).
  const lateralY = node.y + (labelH > 0 ? (LABEL_GAP + labelH) / 2 : 0);
  switch (face) {
    case 'east':
      return { x: node.x + halfW + outset, y: lateralY + portOffset };
    case 'west':
      return { x: node.x - halfW - outset, y: lateralY + portOffset };
    case 'north':
      return { x: node.x + portOffset, y: node.y - halfH - outset };
    case 'south': {
      const bottom = labelH > 0 ? halfH + LABEL_GAP + labelH : halfH + outset;
      return { x: node.x + portOffset, y: node.y + bottom };
    }
  }
}

/** Anchor point on a node's outline plus the OUTWARD unit normal there — the
 *  direction the path leaves/arrives perpendicularly (curve handles read it). */
export interface ContourAnchor {
  point: Point;
  normal: Point;
}

/** Outward unit normal of a cardinal face (used to orient curve handles the same
 *  way for cardinal and contour endpoints). */
function faceNormal(face: Face): Point {
  switch (face) {
    case 'east':
      return { x: 1, y: 0 };
    case 'west':
      return { x: -1, y: 0 };
    case 'north':
      return { x: 0, y: -1 };
    case 'south':
      return { x: 0, y: 1 };
  }
}

/**
 * Attaches an edge end on a node's ELLIPTICAL outline (a round node), aimed at
 * `toward` — the other node's centre.
 *
 * - `ports: 'direct'` → the anchor is the exact ray/outline intersection in the
 *   direction of `toward`: the edge meets the circle right where the straight
 *   line to the other centre crosses it (radial, infinite possible points).
 * - `ports: N` (positive integer) → the direction is snapped to the nearest of
 *   `N` evenly-spread angles before intersecting; edges that snap to the same
 *   angle merge on one point (like `merge_edges`). Phase is chosen so a slot
 *   sits at the top and bottom (natural for trees; `N = 4` gives N/E/S/W).
 *
 * `offset` (the intra-pair / fan-out spread in px, reused from the cardinal port
 * model) nudges the anchor along the tangent so bidirectional tracks stay apart.
 */
function ellipseAttach(
  node: NodeGeom,
  ports: 'direct' | number,
  toward: Point,
  offset: number
): ContourAnchor {
  const outset = node.borderOutset ?? 0;
  const rx = node.width / 2 + outset;
  const ry = node.height / 2 + outset;
  let ang = Math.atan2(toward.y - node.y, toward.x - node.x);
  if (typeof ports === 'number' && ports > 0) {
    const step = (2 * Math.PI) / ports;
    // Phase so that, for an even count, one slot is at the top (−π/2) and one at
    // the bottom: parent/child edges of a tree stay vertical, and N = 4 lands on
    // the four cardinal points of the round outline.
    const phase = -Math.PI / 2;
    ang = phase + Math.round((ang - phase) / step) * step;
  }
  // Tangential nudge: arc length (px) → angle, so two bidirectional edges on the
  // same direction do not collapse onto a single point.
  const rMean = (rx + ry) / 2;
  if (offset && rMean > 1e-6) ang += offset / rMean;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  // Ray/ellipse intersection along `ang`: the point of the outline in that exact
  // direction from the centre (t·(cos,sin) satisfies (x/rx)²+(y/ry)² = 1).
  const t = 1 / Math.hypot(cos / rx, sin / ry);
  const point = { x: node.x + t * cos, y: node.y + t * sin };
  // Outward normal ∝ gradient of (x/rx)²+(y/ry)² at the point ∝ (cos/rx², sin/ry²)
  // — exactly radial for a circle (rx = ry).
  let nx = cos / (rx * rx);
  let ny = sin / (ry * ry);
  const nLen = Math.hypot(nx, ny) || 1;
  nx /= nLen;
  ny /= nLen;
  return { point, normal: { x: nx, y: ny } };
}

/**
 * Attaches an edge end on a component's NAMED terminal (see `pins.ts`). The pin
 * is expressed in the symbol's unrotated local box (`x`/`y` fractions, `nx`/`ny`
 * outward normal); this rotates BOTH by `rotationDeg` — so a vertical resistor
 * (`rotation: 90`) has its `a`/`b` terminals top/bottom and its wires leave
 * vertically. `offset` (the intra-pair spread, px) nudges the anchor along the
 * terminal's tangent so bidirectional tracks stay apart.
 */
function pinAttach(
  node: NodeGeom,
  pin: PinDef,
  rotationDeg: number,
  offset: number
): ContourAnchor {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Terminal position, as a px offset from the node centre in the unrotated box,
  // then rotated into place.
  const lx = (pin.x - 0.5) * node.width;
  const ly = (pin.y - 0.5) * node.height;
  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;
  // Outward normal, rotated and normalized.
  let nx = pin.nx * cos - pin.ny * sin;
  let ny = pin.nx * sin + pin.ny * cos;
  const nLen = Math.hypot(nx, ny) || 1;
  nx /= nLen;
  ny /= nLen;
  // Tangent = normal turned 90°, used for the bidirectional spread.
  const tx = -ny;
  const ty = nx;
  const outset = node.borderOutset ?? 0;
  return {
    point: {
      x: node.x + rx + nx * outset + tx * offset,
      y: node.y + ry + ny * outset + ty * offset,
    },
    normal: { x: nx, y: ny },
  };
}

/**
 * Slides a POINT endpoint (a junction dot, which anchors at its dimensionless
 * centre) onto the axis of a nearby partner TERMINAL, so the wire runs straight
 * into it instead of slanting from the centre. Only applied when the offset is
 * small (under ~half the terminal node), so a genuine L corner (a far junction)
 * is left untouched.
 */
function alignPointToTerminal(
  point: ContourAnchor,
  terminal: ContourAnchor,
  terminalNode: NodeGeom
): void {
  const n = terminal.normal;
  if (Math.abs(n.x) >= Math.abs(n.y)) {
    // Horizontal terminal → straighten by matching the y.
    if (Math.abs(point.point.y - terminal.point.y) < terminalNode.height * 0.45)
      point.point = { x: point.point.x, y: terminal.point.y };
  } else if (
    Math.abs(point.point.x - terminal.point.x) <
    terminalNode.width * 0.45
  ) {
    // Vertical terminal → straighten by matching the x.
    point.point = { x: terminal.point.x, y: point.point.y };
  }
}

/**
 * The single PORT of a face-anchored circuit I/O pad (a `signal`): the midpoint of
 * the face it presents to the schematic. A driver leaves EAST, a sink enters WEST
 * (`side`), so a system's wires all exit its right / enter its left and never dive
 * behind a neighbour; the outward normal is `(±1, 0)`.
 *
 * A pad is a CONNECTOR: it has one terminal, not a band of them. Every wire of its
 * net therefore leaves this one point and branches downstream on the shared trunk
 * (the router's `fanPort`) — a pad wired to three gates shows one lead that forks,
 * the way a schematic is drawn by hand, rather than three stubs grazing its edge.
 *
 * The port is CENTRED, never slid towards whatever the pad happens to feed: the
 * terminal belongs to the pad, so it must not drift with its wiring. A gate's input
 * sits a third of the way up its body, so a same-row lead still has to climb that
 * fraction of a body — that step is the ROUTER's to draw, and it costs one short
 * jog. Sliding the port up to erase it is what this deliberately gives up: a pad
 * feeding two gates can only ever line up with one of them, so the slide bought a
 * straight wire for one net by mis-seating the terminal for every other.
 */
export function facePort(pad: NodeGeom, side: 'east' | 'west'): Point {
  const halfW = pad.width / 2;
  return { x: side === 'east' ? pad.x + halfW : pad.x - halfW, y: pad.y };
}

/** Resolves the anchor for one endpoint from its (optional) contour policy. */
function endpointAnchor(
  node: NodeGeom,
  contour: NodeContour | undefined,
  face: Face,
  towardCentre: Point,
  portOffset: number
): ContourAnchor {
  if (!contour) {
    return {
      point: cardinalAttach(node, face, portOffset),
      normal: faceNormal(face),
    };
  }
  if (contour.kind === 'pin') {
    return pinAttach(node, contour.pin, contour.rotationDeg, portOffset);
  }
  if (contour.kind === 'point') {
    // Anchor at the exact centre; the outward normal points at the other node.
    let nx = towardCentre.x - node.x;
    let ny = towardCentre.y - node.y;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    return { point: { x: node.x, y: node.y }, normal: { x: nx, y: ny } };
  }
  return ellipseAttach(node, contour.ports, towardCentre, portOffset);
}

/**
 * Resolves both ends of a wire to their exact anchor point + outward normal,
 * applying the same face model and point-to-terminal straightening that
 * {@link connection} draws through. Exported so the global orthogonal router
 * (circuit schematics) anchors on the identical terminals — the two stay in
 * lock-step because {@link connection} calls this too.
 */
export function wireEndpoints(
  from: NodeGeom,
  to: NodeGeom,
  startPortOffset: number,
  endPortOffset: number,
  axis: ConnectionAxis | undefined,
  fromContour?: NodeContour,
  toContour?: NodeContour
): { from: ContourAnchor; to: ContourAnchor } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const isHorizontal = axis
    ? axis === 'horizontal'
    : Math.abs(dx) >= Math.abs(dy);
  // Opposite cardinal faces: source points to destination, destination the
  // opposite face.
  const fromFace: Face = isHorizontal
    ? dx >= 0
      ? 'east'
      : 'west'
    : dy >= 0
      ? 'south'
      : 'north';
  const toFace: Face = isHorizontal
    ? dx >= 0
      ? 'west'
      : 'east'
    : dy >= 0
      ? 'north'
      : 'south';
  const cf: Point = { x: from.x, y: from.y };
  const ct: Point = { x: to.x, y: to.y };
  const fromAnchor = endpointAnchor(
    from,
    fromContour,
    fromFace,
    ct,
    startPortOffset
  );
  const toAnchor = endpointAnchor(to, toContour, toFace, cf, endPortOffset);
  // Straighten an edge feeding a component PIN when the other end is a junction
  // dot: it is dimensionless, so it slides freely onto the pin's axis, turning a
  // small dogleg into a straight lead. Anything else is left as anchored — a
  // pin↔pin edge is fixed at both ends, and a face-anchored pad keeps its centred
  // port (see {@link facePort}); both are the router's business.
  if (toContour?.kind === 'pin' && fromContour?.kind === 'point')
    alignPointToTerminal(fromAnchor, toAnchor, to);
  if (fromContour?.kind === 'pin' && toContour?.kind === 'point')
    alignPointToTerminal(toAnchor, fromAnchor, from);
  return { from: fromAnchor, to: toAnchor };
}

/**
 * Connection points between two nodes.
 *
 * - Anchors extremities to one of the 4 cardinal points (N/S/E/W) of the node,
 *   EXACTLY on its colored contour (see {@link cardinalAttach}): arrow touches
 *   border. Axis is provided by `axis` (derived from layout flow, see
 *   `connectionAxis`) — SAME decision as `computePortOffsets`, so anchor
 *   and fan-out never contradict. If `axis` is missing (tests/isolated use),
 *   it falls back to dominant pixel axis.
 * - Path starts/arrives perpendicularly to face: `axis` is also passed to
 *   `shapeWaypoints` to orient curve handles (otherwise a curve between
 *   two E/W faces with high elevation difference would start vertically).
 * - `obstacles`: list of all nodes → inserts a waypoint if the segment
 *   crosses a third-party label.
 */
export function connection(
  from: NodeGeom,
  to: NodeGeom,
  obstacles?: NodeGeom[],
  startPortOffset = 0,
  endPortOffset = 0,
  shape: PathShape = 'bezier',
  axis?: ConnectionAxis,
  fromContour?: NodeContour,
  toContour?: NodeContour
): Connection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const isHorizontal = axis
    ? axis === 'horizontal'
    : Math.abs(dx) >= Math.abs(dy);

  // Routing margin (anti-label detour, median label anchor), scaled to Stage.
  // NB: the anchor itself does NOT use it — the arrow touches the border.
  const gap = NODE_GAP * (from.scale ?? 1);

  const { from: fromAnchor, to: toAnchor } = wireEndpoints(
    from,
    to,
    startPortOffset,
    endPortOffset,
    axis,
    fromContour,
    toContour
  );
  const start: Point = fromAnchor.point;
  const end: Point = toAnchor.point;
  const hasContour = fromContour !== undefined || toContour !== undefined;

  // Detects the first third-party rect the segment crosses and inserts a detour
  // just past it. This detour is shape-independent: all shapes pass through it
  // (see control below). For orthogonal wires (step/smoothstep — the circuit
  // schematics) the obstacle is the node BODY: a wire must NEVER run through a
  // component, e.g. a skip-edge A→gate2 crossing the gate1 aligned between them.
  // For the curved network diagrams the chord is a poor proxy for the drawn
  // path, so only the label (below the node) is bypassed, as before.
  const orthogonal = shape === 'step' || shape === 'smoothstep';
  let detour: Point[] | undefined;
  if (obstacles && obstacles.length > 0) {
    let firstT = Infinity;
    let bestWps: Point[] | null = null;
    for (const obs of obstacles) {
      if (obs.id === from.id || obs.id === to.id) continue;
      const rect = orthogonal ? bodyBounds(obs) : labelBounds(obs);
      if (!rect) continue;
      const isect = segmentIntersectsRect(start, end, rect);
      if (isect !== null && isect.tEntry < firstT && isect.tEntry > 1e-10) {
        firstT = isect.tEntry;
        if (isHorizontal) {
          const xAt = start.x + (end.x - start.x) * isect.tEntry;
          // Bypass over the nearer edge (shorter detour, fewer added corners).
          const above = (start.y + end.y) / 2 <= rect.y + rect.h / 2;
          bestWps = [
            { x: xAt, y: above ? rect.y - gap : rect.y + rect.h + gap },
          ];
        } else {
          // Quasi-vertical segment: bypass laterally rather than
          // doubling back upwards, which produces an unnatural detour.
          const yAt = start.y + (end.y - start.y) * isect.tEntry;
          // start.x strictly left of obstacle → bypass left.
          // start.x at same x or right (e.g. same lane) → bypass right
          // to avoid crosses with arrows going left.
          bestWps = [
            {
              x: start.x < obs.x ? rect.x - gap : rect.x + rect.w + gap,
              y: yAt,
            },
          ];
        }
      }
    }
    if (bestWps) detour = bestWps;
  }

  // Control polyline = extremities + detours, then shape application.
  // `shapeWaypoints` returns actual intermediate points (curve samples,
  // corners...), traversed by arc length like a simple polyline.
  const control: Point[] = detour ? [start, ...detour, end] : [start, end];
  // Orthogonal shapes (step/smoothstep) read a single axis: for a contour
  // endpoint, derive it from the (already rotated) source normal so a wire
  // leaves a terminal along the terminal, not along the layout flow.
  const shapeAxis: ConnectionAxis = hasContour
    ? Math.abs(fromAnchor.normal.x) >= Math.abs(fromAnchor.normal.y)
      ? 'horizontal'
      : 'vertical'
    : isHorizontal
      ? 'horizontal'
      : 'vertical';
  const waypoints = shapeWaypoints(
    control,
    shape,
    shapeAxis,
    // A contour endpoint leaves along its outward normal (radial/terminal), not
    // along a cardinal axis — pass the normals so bezier handles bend accordingly.
    hasContour ? { start: fromAnchor.normal, end: toAnchor.normal } : undefined
  );

  // Last segment angle (for arrowhead).
  const lastPt =
    waypoints && waypoints.length > 0 ? waypoints[waypoints.length - 1] : start;
  const angleDeg =
    (Math.atan2(end.y - lastPt.y, end.x - lastPt.x) * 180) / Math.PI;

  // Median label anchor. Connection text is placed at path midpoint;
  // if this midpoint falls on VISUAL of an interleaved node (e.g. A→C connection
  // spanning a B node between them), we shift anchor perpendicularly to line
  // to clear text. Otherwise it overlaps node — and since label lives under
  // nodes layer, it hides behind it.
  let labelAnchor: Point | undefined;
  if (obstacles && obstacles.length > 0) {
    const mid = pathTip({ start, end, waypoints, angleDeg }, 0.5);
    for (const obs of obstacles) {
      if (obs.id === from.id || obs.id === to.id) continue;
      const halfW = obs.width / 2;
      const halfH = obs.height / 2;
      if (
        Math.abs(mid.x - obs.x) <= halfW + gap &&
        Math.abs(mid.y - obs.y) <= halfH + gap
      ) {
        labelAnchor = isHorizontal
          ? // Horizontal line: move label above node. Vertical margin
            // does not depend on (unknown) text width.
            { x: mid.x, y: obs.y - halfH - gap }
          : // Vertical line: clear laterally. Label remains anchored at
            // center (textAnchor=middle) and width is unknown, so we
            // guarantee at least its center leaves the node.
            {
              x: obs.x + (mid.x <= obs.x ? -1 : 1) * (halfW + gap),
              y: mid.y,
            };
        break;
      }
    }
  }

  return {
    start,
    end,
    waypoints,
    angleDeg,
    ...(labelAnchor ? { labelAnchor } : {}),
  };
}

/**
 * Point at fractional arc length `u` ∈ [0, 1] along an arbitrary polyline. Used
 * to place the charge dots of a `flow` animation on a multi-segment wire path.
 * Out-of-range `u` clamps to the endpoints.
 */
export function pointAtArc(points: Point[], u: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const l = Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y
    );
    segLens.push(l);
    total += l;
  }
  if (total < 1e-10) return points[0];
  let dist = (u <= 0 ? 0 : u >= 1 ? 1 : u) * total;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i] || i === segLens.length - 1) {
      const segT = segLens[i] > 1e-10 ? Math.min(dist / segLens[i], 1) : 1;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * segT,
        y: points[i].y + (points[i + 1].y - points[i].y) * segT,
      };
    }
    dist -= segLens[i];
  }
  return points[points.length - 1];
}

/** Intermediate point on a segment, for positioning a moving packet. */
export function pointOnSegment(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

/**
 * Position and angle at parameter t ∈ [0,1] along the full path
 * (start → waypoints → end). Used to animate arrowhead
 * and moving packets.
 */
export function pathTip(
  conn: Connection,
  t: number
): { x: number; y: number; angleDeg: number } {
  if (!conn.waypoints?.length) {
    return {
      x: conn.start.x + (conn.end.x - conn.start.x) * t,
      y: conn.start.y + (conn.end.y - conn.start.y) * t,
      angleDeg: conn.angleDeg,
    };
  }
  const pts = [conn.start, ...conn.waypoints, conn.end];
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l);
    totalLen += l;
  }
  if (totalLen < 1e-10)
    return { x: conn.end.x, y: conn.end.y, angleDeg: conn.angleDeg };
  let dist = t * totalLen;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i] || i === segLens.length - 1) {
      const segT = segLens[i] > 1e-10 ? Math.min(dist / segLens[i], 1) : 1;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * segT,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * segT,
        angleDeg:
          (Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) * 180) /
          Math.PI,
      };
    }
    dist -= segLens[i];
  }
  return { x: conn.end.x, y: conn.end.y, angleDeg: conn.angleDeg };
}

/**
 * Points of visible path from start up to position t.
 * Returns start + any waypoints already passed + current tip.
 * Used by ArrowLine to draw the progressive stroke.
 */
export function visiblePath(conn: Connection, t: number): Point[] {
  if (!conn.waypoints?.length) {
    return [
      conn.start,
      {
        x: conn.start.x + (conn.end.x - conn.start.x) * t,
        y: conn.start.y + (conn.end.y - conn.start.y) * t,
      },
    ];
  }
  const pts = [conn.start, ...conn.waypoints, conn.end];
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l);
    totalLen += l;
  }
  const result: Point[] = [pts[0]];
  let dist = t * totalLen;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i] || i === segLens.length - 1) {
      const segT = segLens[i] > 1e-10 ? Math.min(dist / segLens[i], 1) : 1;
      result.push({
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * segT,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * segT,
      });
      return result;
    }
    result.push(pts[i + 1]);
    dist -= segLens[i];
  }
  return result;
}

/** Fraction of the asked-for radius below which a squeezed hop is dropped and its
 *  crossing drawn flat, as it was before hops: an arch this much smaller than its
 *  neighbours reads as a wart, not as a deliberate bridge.
 *
 *  A FRACTION, not a pixel floor: the caller sizes `hopRadius` to the player, so a
 *  floor in absolute px would be a second, contradictory opinion about scale — and
 *  it silently deleted every bridge in a thumbnail, where the whole diagram is
 *  smaller than the floor. Everything here is proportional to the radius, which
 *  keeps {@link pathD} scale-invariant. */
const HOP_MIN_FRAC = 0.4;

/** A `d` coordinate: hundredths of a pixel, which no display can tell apart, and
 *  keeps summed segment lengths from spelling a radius `2.999999999999993`. */
const fmt = (v: number): string => String(Math.round(v * 100) / 100);

/** `x,y` for a `d` command. */
const xy = (p: Point): string => `${fmt(p.x)},${fmt(p.y)}`;

/** The hops that sit ON segment p→q, as distances along it, ordered. A hop point
 *  comes from the router in absolute coordinates, so it is matched back to its
 *  segment geometrically — which also drops the hops of a part of the path that
 *  `progress` has not drawn yet. */
function hopsAlong(p: Point, q: Point, hops: Point[]): number[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return [];
  const out: number[] = [];
  for (const h of hops) {
    const t = ((h.x - p.x) * dx + (h.y - p.y) * dy) / len2;
    if (t <= 0 || t >= 1) continue;
    // Off the segment's line ⇒ this hop belongs to another segment of the path.
    if (Math.hypot(p.x + t * dx - h.x, p.y + t * dy - h.y) > 0.5) continue;
    out.push(t * Math.sqrt(len2));
  }
  return out.sort((a, b) => a - b);
}

/** `d` of one segment, arching over each of its hops (distances along p→q). */
function segmentD(p: Point, q: Point, hops: number[], radius: number): string {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  if (!hops.length || len < 1e-10) return `L${xy(q)}`;
  const u = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
  // Every bridge bulges the same way — UP, or RIGHT on an upright segment —
  // whichever way its wire happens to be travelling. Sweeping clockwise arches a
  // rightward segment up and a downward one right; reversing the travel reverses
  // the sweep, which lands the bulge on that same side again.
  const sweep = (Math.abs(u.x) > 1e-9 ? u.x : u.y) > 0 ? 1 : 0;
  const at = (d: number): string => xy({ x: p.x + u.x * d, y: p.y + u.y * d });
  let out = '';
  let drawn = 0; // distance along p→q already emitted
  for (const c of hops) {
    // Shrink the arc to the room left by the previous hop and by the far end, so
    // a crossing next to a corner (or another crossing) bends the wire less
    // rather than folding the path back over itself.
    const r = Math.min(radius, c - drawn, len - c);
    if (r < radius * HOP_MIN_FRAC) continue;
    out += `L${at(c - r)}A${fmt(r)},${fmt(r)} 0 0 ${sweep} ${at(c + r)}`;
    drawn = c + r;
  }
  return `${out}L${xy(q)}`;
}

/**
 * SVG `d` of a polyline, bridging over every point of `hops` with a half-circle
 * so a wire crossing another net reads as a crossing and not as a T-junction (see
 * `wireHops`). No hops ⇒ plain `M`/`L`, i.e. exactly the polyline itself.
 *
 * `hopRadius` is in player px: the caller scales it, so a bridge keeps its
 * proportion to the stroke at any player size. Scaling points, hops and radius
 * together scales the `d` — this draws the same picture at any size.
 */
export function pathD(points: Point[], hops?: Point[], hopRadius = 0): string {
  if (points.length === 0) return '';
  const arch = hops?.length && hopRadius > 0;
  let d = `M${xy(points[0])}`;
  for (let i = 0; i < points.length - 1; i++)
    d += segmentD(
      points[i],
      points[i + 1],
      arch ? hopsAlong(points[i], points[i + 1], hops) : [],
      hopRadius
    );
  return d;
}
