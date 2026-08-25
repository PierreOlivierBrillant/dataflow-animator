import type {
  Action,
  Connection as SpecConnection,
  DataFlowSpec,
} from '../types';
import {
  connectionAxis,
  type ConnectionAxis,
  type LayoutMap,
} from '../engine/layout';
import {
  connection,
  facePort,
  nodeContour,
  wireEndpoints,
  type GeometryMap,
  type NodeContour,
  type NodeGeom,
  type Point,
} from '../engine/geometry';
import {
  routeWithPinSwaps,
  wireHops,
  type PinSwapGroup,
  type RouterObstacle,
  type RouterWire,
} from '../engine/orthoRouter';
import {
  commutativeInputPins,
  parseRef,
  refNode,
  resolvePin,
} from '../engine/pins';

/**
 * Everything a wire needs that is NOT the DOM: endpoint anchoring policy,
 * attachment axis, port spread, and the global orthogonal routing of a circuit.
 *
 * Ports the corresponding blocks of `Stage.tsx` (`collectEndpointRefs`,
 * `contourFor`, `axisFor`, `isPrecise`, `portsFor`, and the circuit routing
 * memo).
 */

/** Every endpoint reference (`node` / `node:pin`) that appears in the spec —
 *  connection ends, arrow/move ends, and `flow` route items — so their contour
 *  can be resolved once into an immutable lookup.
 *
 *  Origin: `Stage.tsx` `collectEndpointRefs`. */
export function collectEndpointRefs(spec: DataFlowSpec): Set<string> {
  const refs = new Set<string>();
  for (const c of spec.connections ?? []) {
    refs.add(c.from);
    refs.add(c.to);
  }
  const walk = (actions: Action[]): void => {
    for (const a of actions) {
      if (a.type === 'arrow' || a.type === 'move') {
        if (a.from) refs.add(a.from);
        if (a.to) refs.add(a.to);
      } else if (a.type === 'flow') {
        for (const r of a.route ?? []) refs.add(r);
      } else if (a.type === 'parallel') {
        walk(a.actions ?? []);
      }
    }
  };
  walk(spec.timeline ?? []);
  return refs;
}

/**
 * Circuit label placement (single source of truth). A component wired top and
 * bottom — its terminals point up/down, i.e. its effective STATIC rotation is
 * vertical (≈90°/270°) — would have its default below-label sit on the outgoing
 * bottom wire. Its label moves to the OUTER side. Read by the node markup (CSS
 * side class), the wire router (obstacle on the same side) and the placement
 * clamp. Based on the static rotation only, so it stays stable across resizes.
 *
 * Origin: `Stage.tsx` `labelSideById`.
 */
export function labelSideMap(
  spec: DataFlowSpec,
  layout: LayoutMap,
  autoRotationById: Map<string, number>
): Map<string, 'left' | 'right'> {
  const m = new Map<string, 'left' | 'right'>();
  if ((spec.direction ?? 'left-to-right') !== 'circuit') return m;
  for (const node of spec.nodes) {
    const rot = node.rotation ?? autoRotationById.get(node.id);
    if (rot == null) continue;
    const r = ((rot % 180) + 180) % 180;
    if (r <= 45 || r >= 135) continue; // horizontal terminals → label stays below
    const cx = layout[node.id]?.cx ?? 0.5;
    m.set(node.id, cx <= 0.5 ? 'left' : 'right');
  }
  return m;
}

/**
 * Anchoring policy for an endpoint REFERENCE (`node` or `node:pin`). A round
 * node attaches radially on its outline; a `node:pin` on a component attaches on
 * that terminal (rotated by the node's static — or auto-layout — rotation).
 * Precomputed into an immutable map so a STABLE object is returned per ref.
 * Undefined = the cardinal-face model.
 *
 * Origin: `Stage.tsx` `contourFor`.
 */
export function contourResolver(
  spec: DataFlowSpec,
  autoRotationById: Map<string, number>
): (ref: string) => NodeContour | undefined {
  const nodeById = new Map(spec.nodes.map((n) => [n.id, n]));
  const resolve = (ref: string): NodeContour | undefined => {
    const { node, pin } = parseRef(ref);
    const n = nodeById.get(node);
    if (!n) return undefined;
    const pinDef = resolvePin(n, pin);
    const rotationDeg = n.rotation ?? autoRotationById.get(n.id) ?? 0;
    return pinDef
      ? { kind: 'pin', pin: pinDef, rotationDeg }
      : nodeContour(n.type, n.ports);
  };
  const map = new Map<string, NodeContour | undefined>();
  for (const n of spec.nodes) map.set(n.id, resolve(n.id));
  for (const ref of collectEndpointRefs(spec))
    if (!map.has(ref)) map.set(ref, resolve(ref));
  return (ref: string) => (map.has(ref) ? map.get(ref) : resolve(ref));
}

/** The key a connection is addressed by, in `portOffsets` and in the router. */
export function connectionKey(link: SpecConnection, index: number): string {
  return link.id ?? `${link.from}|${link.to}|${index}`;
}

export interface WireContext {
  contourFor: (ref: string) => NodeContour | undefined;
  axisFor: (fromRef: string, toRef: string) => ConnectionAxis | undefined;
  portsFor: (
    key: string,
    fromRef: string,
    toRef: string
  ) => { start: number; end: number };
}

export function createWireContext(
  spec: DataFlowSpec,
  layout: LayoutMap,
  routeAspect: number,
  portOffsets: Record<string, { start: number; end: number }>,
  autoRotationById: Map<string, number>
): WireContext {
  const direction = spec.direction ?? 'left-to-right';
  const contourFor = contourResolver(spec, autoRotationById);

  // Attachment axis, derived from layout FLOW: the same decision as
  // computePortOffsets, so attachment and fan-out distribution match.
  const axisFor = (
    fromRef: string,
    toRef: string
  ): ConnectionAxis | undefined => {
    const p1 = layout[refNode(fromRef)];
    const p2 = layout[refNode(toRef)];
    return p1 && p2
      ? connectionAxis(p1, p2, direction, routeAspect)
      : undefined;
  };

  // Port offsets do not apply to an endpoint that is already a precise point (a
  // component terminal, or a junction dot): zero the spread there.
  const isPrecise = (ref: string): boolean => {
    const k = contourFor(ref)?.kind;
    return k === 'pin' || k === 'point';
  };
  const portsFor = (key: string, fromRef: string, toRef: string) => {
    const base = portOffsets[key] ?? { start: 0, end: 0 };
    return {
      start: isPrecise(fromRef) ? 0 : base.start,
      end: isPrecise(toRef) ? 0 : base.end,
    };
  };

  return { contourFor, axisFor, portsFor };
}

export interface CircuitRouting {
  routes: Map<string, Point[]>;
  hops: Map<string, Point[]>;
}

/**
 * Wire routes keyed by node pair, so a `flow` charge can ride the very route
 * its wire is drawn with (see {@link buildFlowPath}).
 *
 * Origin: `Stage.tsx` `routeByNodePair`.
 */
export function routesByNodePair(
  spec: DataFlowSpec,
  routes: Map<string, Point[]>
): Map<string, Point[]> {
  const m = new Map<string, Point[]>();
  (spec.connections ?? []).forEach((link, i) => {
    const r = routes.get(connectionKey(link, i));
    if (r) m.set(`${refNode(link.from)}|${refNode(link.to)}`, r);
  });
  return m;
}

/**
 * Concatenates the wire segments of a `flow` route into a single polyline the
 * charge dots ride. Consecutive refs (`node` / `node:pin`) are joined by the
 * SAME `connection()` geometry the wires use (orthogonal `step`, terminal
 * anchoring), so the current follows the drawn path exactly. Segments whose
 * endpoints aren't measured yet are skipped.
 *
 * Origin: `Stage.tsx` `buildFlowPath`.
 */
export function buildFlowPath(
  route: string[],
  geometry: GeometryMap,
  contourFor: (ref: string) => NodeContour | undefined,
  axisFor: (a: string, b: string) => ConnectionAxis | undefined,
  obstacles: NodeGeom[],
  routeByNodePair: Map<string, Point[]>
): Point[] {
  const pts: Point[] = [];
  let prevEnd: Point | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const gf = geometry[refNode(a)];
    const gt = geometry[refNode(b)];
    if (!gf || !gt) {
      prevEnd = null;
      continue;
    }
    // Prefer the SAME orthogonal route the wire is drawn with (circuit
    // schematics), so the charge rides the drawn wire exactly; else route the
    // segment on its own. A reversed pair reuses the wire route backwards.
    const fwd = routeByNodePair.get(`${refNode(a)}|${refNode(b)}`);
    const rev = routeByNodePair.get(`${refNode(b)}|${refNode(a)}`);
    let seg: Point[];
    if (fwd) seg = fwd;
    else if (rev) seg = [...rev].reverse();
    else {
      const conn = connection(
        gf,
        gt,
        obstacles,
        0,
        0,
        'step',
        axisFor(a, b),
        contourFor(a),
        contourFor(b)
      );
      seg = [conn.start, ...(conn.waypoints ?? []), conn.end];
    }
    if (prevEnd === null) {
      pts.push(...seg);
    } else if (Math.hypot(seg[0].x - prevEnd.x, seg[0].y - prevEnd.y) > 1) {
      // The previous segment ended on one face of node `a` and this one leaves
      // another (a corner junction): bridge through the node CENTRE so the
      // charge turns the corner along the wires instead of cutting across it. A
      // shared terminal (same pin) coincides, so no bridge is inserted there.
      pts.push({ x: gf.x, y: gf.y }, ...seg);
    } else {
      pts.push(...seg.slice(1));
    }
    prevEnd = seg[seg.length - 1];
  }
  return pts;
}

/**
 * Global orthogonal routing of a circuit schematic: all wires are laid out
 * together so they avoid bodies and don't overlap.
 *
 * Origin: `Stage.tsx`'s circuit routing memo.
 */
export function routeCircuit(
  spec: DataFlowSpec,
  geometry: GeometryMap,
  ctx: WireContext,
  labelSides: Map<string, 'left' | 'right'>,
  k: number
): CircuitRouting {
  const empty: CircuitRouting = { routes: new Map(), hops: new Map() };
  if ((spec.direction ?? 'left-to-right') !== 'circuit') return empty;

  const obstacles: RouterObstacle[] = Object.entries(geometry).map(
    ([id, g]) => ({
      id,
      x: g.x,
      y: g.y,
      w: g.width,
      h: g.height,
      labelW: g.labelW,
      labelH: g.labelH,
      labelSide: labelSides.get(id),
    })
  );
  const typeById = new Map(spec.nodes.map((n) => [n.id, n.type]));
  // Per target node, the wire reaching each named pin and where it comes from —
  // used below to spot a commutative gate whose two inputs could swap pins.
  const inByNode = new Map<string, Map<string, { key: string; src: string }>>();
  // A face-anchored endpoint (a plain box: a signal I/O pad, no pin/point/round
  // contour) is a SYSTEM terminal: its wires all leave its RIGHT face (driver)
  // or enter its LEFT face (sink), never a top/bottom face that would dive
  // behind a neighbour.
  const isFace = (c: NodeContour | undefined): boolean => c === undefined;

  const raw: {
    link: SpecConnection;
    key: string;
    fromNode: string;
    toNode: string;
    ends: ReturnType<typeof wireEndpoints>;
    fromFace: boolean;
    toFace: boolean;
  }[] = [];

  (spec.connections ?? []).forEach((link, i) => {
    const fromNode = refNode(link.from);
    const toNode = refNode(link.to);
    const f = geometry[fromNode];
    const tg = geometry[toNode];
    if (!f || !tg) return;
    const key = connectionKey(link, i);
    const toRef = parseRef(link.to);
    if (toRef.pin) {
      const pins = inByNode.get(toRef.node) ?? new Map();
      pins.set(toRef.pin, { key, src: fromNode });
      inByNode.set(toRef.node, pins);
    }
    const fromC = ctx.contourFor(link.from);
    const toC = ctx.contourFor(link.to);
    const ports = ctx.portsFor(key, link.from, link.to);
    const ends = wireEndpoints(
      f,
      tg,
      ports.start,
      ports.end,
      ctx.axisFor(link.from, link.to),
      fromC,
      toC
    );
    raw.push({
      link,
      key,
      fromNode,
      toNode,
      ends,
      fromFace: isFace(fromC),
      toFace: isFace(toC),
    });
  });
  if (!raw.length) return empty;

  // Identity of the TERMINAL an end leaves from, so the router can tell two pins
  // of one node apart. Keyed by the resolved POSITION rather than by the pin's
  // spelling: `and_gate` exposes `y` and `out` as aliases of one terminal, and
  // two wires written each way must still count as the same driver.
  const terminalId = (ref: string, nodeId: string): string => {
    const c = ctx.contourFor(ref);
    return c?.kind === 'pin' ? `${nodeId}@${c.pin.x},${c.pin.y}` : nodeId;
  };

  const wires: RouterWire[] = raw.map(
    ({ link, key, fromNode, toNode, ends, fromFace, toFace }) => {
      // Every wire of a pad shares its ONE centred port, and forks downstream.
      const fromPort = fromFace
        ? facePort(geometry[fromNode], 'east')
        : undefined;
      const toPort = toFace ? facePort(geometry[toNode], 'west') : undefined;
      // hardNormal = the endpoint anchors on a BORDER with an enforced normal.
      // Only a POINT contour (a junction dot, centre-anchored) is soft.
      return {
        key,
        from: {
          node: fromNode,
          terminal: terminalId(link.from, fromNode),
          point: fromPort ?? ends.from.point,
          normal: fromPort ? { x: 1, y: 0 } : ends.from.normal,
          hardNormal: ctx.contourFor(link.from)?.kind !== 'point',
          fanPort: fromFace,
        },
        to: {
          node: toNode,
          terminal: terminalId(link.to, toNode),
          point: toPort ?? ends.to.point,
          normal: toPort ? { x: -1, y: 0 } : ends.to.normal,
          hardNormal: ctx.contourFor(link.to)?.kind !== 'point',
        },
        diagonal: link.diagonal ?? spec.diagonal_wires ?? false,
      };
    }
  );

  // A commutative gate (`a AND b === b AND a`) whose two input wires come from
  // different nets may swap which wire takes the upper vs lower pin, to let the
  // router remove a crossing at the gate. Order-sensitive terminals (op-amp
  // `+`/`-`) are excluded by `commutativeInputPins`.
  const swapGroups: PinSwapGroup[] = [];
  for (const [node, pins] of inByNode) {
    const type = typeById.get(node);
    const pair = type && commutativeInputPins(type);
    if (!pair) continue;
    const a = pins.get(pair[0]);
    const b = pins.get(pair[1]);
    if (a && b && a.src !== b.src) swapGroups.push([a.key, b.key]);
  }

  // `scale: k` normalizes the measured geometry to design space so the routes
  // (fixed-px leads/costs) are identical at any player size — a thumbnail and a
  // full-screen render draw the SAME corners.
  const routes = routeWithPinSwaps(obstacles, wires, swapGroups, {
    clearance: 6,
    laneTracks: 3,
    scale: k,
  });
  return { routes, hops: wireHops(routes, wires) };
}
