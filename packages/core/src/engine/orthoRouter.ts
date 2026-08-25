import type { Point } from './geometry';

/**
 * Global orthogonal wire router for schematic (`direction: 'circuit'`) diagrams.
 *
 * By default every wire is drawn as strictly HORIZONTAL and VERTICAL segments
 * that:
 *   • never cross a component body (hard obstacle avoidance, all obstacles);
 *   • leave/enter a terminal PERPENDICULAR to its face (the pin normal);
 *   • keep a straight lead ({@link PIN_LEAD} px) out of / into a hard connector
 *     before the first / last turn, so a wire never bends flush against a pin;
 *   • take as few corners as possible (a turn is penalised);
 *   • do NOT run alongside another net close enough to read as one line — two wires
 *     may only meet where they cross at a right angle (lane separation).
 *
 * It routes on a Hanan-style grid (lines through every pin and every obstacle
 * edge, plus intermediate lane tracks in the gaps) with an A* per wire. Wires
 * are routed in order; each marks the grid edges it used, and later wires pay a
 * penalty ({@link LANE_COST}) to come within `laneGap` px of another net ALONG a
 * track and {@link LANE_FUSE} px ACROSS — so parallels spread onto neighbouring
 * tracks, and two nets never queue up end-to-end on one line where the eye would
 * read them as a single broken wire. The rule is a distance in PX, not a shared
 * track: the grid lines come from the pins, so two of them land wherever two
 * components happen to sit, and a pair of tracks 2px apart draws as one wire.
 * A perpendicular crossing is allowed (the wires meet at a right angle) but not
 * free: it is priced at {@link CROSS_DETOUR} px of length inside the wire's `hard`
 * cost (see {@link RouteCost}), so a later wire pays a SHORT detour to dodge an
 * earlier one — but never a corner. The crossings that survive are handed to the
 * renderer by {@link wireHops}, which bridges one of the two wires over the other
 * so it cannot be read as a T-junction.
 *
 * A wire may opt into `diagonal` (octilinear, only 45 / 135 / 225 / 315°). It is
 * routed in two tiers, each collision-checked so a diagonal is never a
 * regression:
 *   1. a direct {@link octilinearElbow} — one bold 45° diagonal centred between
 *      the two pin stubs, so a feedback pair reads as a single crossing (the
 *      SR-latch X) instead of a tight dogleg;
 *   2. failing that, the orthogonal A* route with its corners mitered into 45°
 *      segments by {@link diagonalize} (long L-shapes and staircases collapse
 *      into clean diagonal runs; a short perpendicular stub is kept at each pin).
 * Obstacle avoidance and lane separation are still decided on the orthogonal
 * skeleton, so neither tier re-introduces a crossing.
 */

/** A rectangular component body, CENTRE-anchored (like `NodeGeom`). The optional
 *  label (measured text next to the node) is treated as an obstacle too — a wire
 *  must never be hidden behind a label. */
export interface RouterObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  labelW?: number;
  labelH?: number;
  /** Where the label sits relative to the body. Default `'bottom'`; a component
   *  wired top/bottom (vertical) moves its label to a side so it does not sit on
   *  the outgoing vertical wire. Kept in sync with the rendered CSS side class. */
  labelSide?: 'bottom' | 'left' | 'right';
}

/** One end of a wire: the exact terminal point and its outward unit normal.
 *  `hardNormal` = the wire MUST leave/enter along that normal (a component pin);
 *  a point pad (junction/signal) sets it false — any direction is allowed. */
interface RouterEndpoint {
  node: string;
  /**
   * Identity of the TERMINAL this end leaves from, distinguishing two pins of one
   * node (a flip-flop's `q` and `qn`, a block's `y` and `z`). Defaults to
   * {@link RouterEndpoint.node} — which is right for a face-anchored pad, whose
   * wires do share one centred port.
   *
   * This is what "driver" means everywhere below. Keyed by node, two outputs of
   * one component were merged onto their MEAN anchor and drawn as one branching
   * trunk — asserting that Q and Q̄ are the same signal.
   */
  terminal?: string;
  point: Point;
  normal: Point;
  hardNormal: boolean;
  /** This end is one of several PORTS already distributed along a node's face (a
   *  signal I/O pad driving/receiving many wires): its point is final and MUST NOT
   *  be merged into the net's mean anchor. A fixed pin (all branches share the one
   *  terminal point) or a lone wire leaves this false and keeps the merge no-op. */
  fanPort?: boolean;
}

/** The terminal a wire leaves from / arrives at — see {@link RouterEndpoint.terminal}. */
const driverOf = (e: RouterEndpoint): string => e.terminal ?? e.node;

export interface RouterWire {
  key: string;
  from: RouterEndpoint;
  to: RouterEndpoint;
  /** Draw this wire octilinearly: its corners are mitered into exact 45°
   *  segments (see {@link diagonalize}). Default: false (strict orthogonal). */
  diagonal?: boolean;
}

export interface RouteOptions {
  /** Keep-out margin around each body, in DESIGN px (see {@link scale}). */
  clearance?: number;
  /** Extra lane tracks inserted between adjacent grid lines. */
  laneTracks?: number;
  /**
   * Player-px per design-px (`height / DESIGN_H`). The router's leads and costs
   * are FIXED design-px constants, but it is handed geometry measured at the
   * player's CURRENT size — so routing in raw pixels would pick different corners
   * at a thumbnail vs full-screen. We normalize all coordinates to design space
   * (÷ scale), route there, then scale the polylines back, so a diagram routes
   * IDENTICALLY at any size. Default 1 (already design space, e.g. tests).
   */
  scale?: number;
}

const TURN_COST = 12;
const LANE_COST = 40;
/**
 * Transverse distance (design px) under which two nets' parallel runs are ONE line
 * to the eye, and so the width of the band {@link laneCost} charges across.
 *
 * Sized on the STROKE, because that is what makes the defect a defect: a wire is
 * 2px wide (3.5px highlighted, `.rdfa-arrow-line`). Two wires 2px apart have their
 * strokes touching — no background survives between them and they draw as one
 * thick line, which is exactly what the same-track rule exists to prevent. At 4px
 * a full stroke's worth of background separates them and they read as two.
 *
 * The cap matters as much as the floor: a gate's own two input pins sit ~9-11px
 * apart, so their leads run side by side that close and CANNOT do otherwise —
 * the pins are where they are. A band wide enough to reach them would charge
 * every gate in the diagram for a shape it has no way to avoid, which is why this
 * is deliberately far below `laneGap` (12) and not another use of it.
 */
const LANE_FUSE = 4;
/** Cost multiplier for an edge already on THIS DRIVER's trunk: < 1 rewards a
 *  fan-out branch for staying on the shared trunk (splitting late) rather than
 *  diverging early. Low enough to prefer sharing, not 0 (which would let a branch
 *  ride the trunk past its target and double back). Keyed on the driver and not the
 *  {@link electricalNets} net, so two hops meeting at a junction never merge before
 *  the dot that draws their connection. */
const TRUNK_SHARE = 0.3;
const EPS = 0.5;
/** A miter shorter than this is pointless — keep the sharp corner instead. */
const DIAG_MIN = 3;
/** Target straight run a wire keeps out of — and into — a hard connector (a
 *  component pin / cardinal face) before it turns / bifurcates, so every terminal
 *  gets a clean perpendicular lead instead of a bend flush against the face.
 *  THE tunable lead. Governs BOTH render paths: on an ORTHOGONAL wire it is a
 *  strong preference (see {@link LEAD_COST}) — where a body leaves no room the
 *  wire bends as late as it can rather than fail; on a `diagonal` wire it is the
 *  straight stub kept before the 45° miter/elbow begins. A soft POINT endpoint
 *  (a junction/pad) is a branch point and has no lead. */
const PIN_LEAD = 15;
/** Cost (per pixel of missing lead) charged when an ORTHOGONAL wire turns INSIDE
 *  a lead zone. Graduated, so A* pushes an unavoidable bend as far from the pin as
 *  the layout allows and always prefers the full lead where routes are otherwise
 *  equal. (A `diagonal` wire keeps its {@link PIN_LEAD} stub geometrically and so
 *  ignores this.) */
const LEAD_COST = 6;
/**
 * Detour BUDGET a wire may spend, in px of extra length, to remove ONE crossing
 * with another net. Strictly below {@link TURN_COST}, which is the whole point:
 * a crossing can buy a short dogleg around a body, but never a corner — the
 * router still refuses to bend a wire to dodge a neighbour.
 *
 * Why a weight here and a strict tier for `lead`: a crossing must outrank the
 * lead preference ({@link LEAD_COST} × distance, up to ~90) yet stay cheaper than
 * a turn (12). No single scalar satisfies both, so `lead` keeps its own LOWER
 * tier — where it is outranked by construction — and the crossing weight only has
 * to fit under `TURN_COST`.
 *
 * The value trades two visual costs with no common unit, so it was measured, not
 * reasoned: swept over the 11 circuit demos, the crossing total is flat at 11 up
 * to 6, drops to 10 at 8 and stays there up to TURN_COST — 8 is the start of that
 * plateau. It costs +0.27% total wire length and, as intended, not one corner.
 * A gate body plus its label is ~6 px of detour to step around, which is why
 * nothing moves below that.
 */
const CROSS_DETOUR = 8;
/**
 * Detour BUDGET a fan-out branch may spend, in px of extra length, to leave the
 * shared trunk exactly where a SIBLING branch already left it — so the net splits
 * at ONE T-junction instead of two stair-stepped ones a few px apart.
 *
 * Why a weight and not just the `fork` tier: the tier only breaks what `hard` and
 * `lead` leave tied, and the two candidate branch points usually differ on `lead`
 * (each branch turns at ITS OWN pin's lead boundary, and those sit a few px
 * apart). A tier below `lead` can never trade that, however large. As a weight it
 * outranks `lead` by construction — the same reason {@link CROSS_DETOUR} is a
 * weight — and buys the shared T for a slightly later bend at one pin.
 *
 * Capped under {@link TURN_COST}, the invariant CROSS_DETOUR keeps too: co-locating
 * may buy a longer ride down the trunk, never an extra corner. Measured over the 11
 * circuit demos, 4 and 8 give the same routes; 8 keeps the margin under TURN_COST.
 *
 * It only bites together with the split key in the rip-up acceptance below: the
 * FIRST branch of a net routes before its siblings exist and so cannot aim at a
 * junction that is not there yet. See the rip-up comment.
 */
const FORK_DETOUR = 8;
/** How many rip-up & reroute sweeps {@link routeOrthogonal} makes over the wires.
 *  Each accepted reroute strictly improves (crossings, length), so the loop
 *  converges on its own and this only caps the cost when reroutes keep
 *  interacting. Every circuit demo reaches its final routing in the FIRST sweep
 *  (measured: 1 and 4 give byte-identical results); the extra sweeps are headroom
 *  for a denser diagram, and cost one no-op sweep to confirm convergence. */
const RIPUP_PASSES = 3;
/**
 * The A* cost is LEXICOGRAPHIC, not a single sum. Each explored state carries a
 * three-key cost {@link RouteCost} compared in this strict order:
 *
 *   1. `hard`  = length + turns ({@link TURN_COST}) + lane separation
 *                ({@link LANE_COST}, incl. the same-net trunk discount
 *                {@link TRUNK_SHARE}) + crossings ({@link CROSS_DETOUR}). The
 *                route's SHAPE. SHARING A TRACK with another net (worse than a
 *                crossing) is avoided here, above crossings.
 *   2. `lead`  = {@link LEAD_COST} for turning inside a pin's lead zone.
 *   3. `fork`  = number of corners that DON'T land on a junction a sibling of the
 *                same net already turned at. Minimising it co-locates a fan-out's
 *                branch points so a net splits at ONE shared T-junction instead of
 *                slightly-offset stair-steps (§ below).
 *
 * Perpendicular crossings are invisible to lane separation (which only prices nets
 * sharing a track), so they are priced INTO `hard` at {@link CROSS_DETOUR} px
 * each. Being a weight rather than its own tier is what lets a wire pay a short
 * detour — stepping under a gate body instead of threading over it — to unthread
 * itself; capping that weight below `TURN_COST` is what stops it from ever buying
 * a corner. It also still breaks ties between two elbows that match on length and
 * turns, which a strict tier did, and does so ABOVE `lead` by construction.
 * Greedy per wire (a later wire avoids the ones already laid).
 *
 * `fork` counts the corners that DON'T land where a sibling of the same DRIVER
 * already turned, and is priced into `hard` at {@link FORK_DETOUR} — the tier is
 * only what breaks the ties that weight leaves. A pure tier could not do the job:
 * the two candidate branch points normally differ on `lead` (each branch wants to
 * turn at its own pin's lead boundary, and those sit a few px apart), and no tier
 * below `lead` can trade that. As a weight it outranks `lead`, so two offset risers
 * collapse into one clean T — trunk in, one branch up, one down — for the price of
 * one slightly later bend. Under `TURN_COST`, so never for the price of a corner.
 *
 * The weight alone is not enough, and the reason is ORDER, not cost: the first
 * branch of a net is routed before its siblings exist, so there is no junction for
 * it to aim at and it turns wherever its own lead says. Only the rip-up pass, which
 * re-routes each wire once all the others are down, can put it on the shared T —
 * see the split key in its acceptance test. */
interface RouteCost {
  hard: number;
  lead: number;
  fork: number;
}
/** Strict lexicographic `a < b` over (hard, lead, fork). `hard` compares with a
 *  tiny tolerance so float noise in summed segment lengths does not mask a true
 *  tie — two same-length, same-turn orientations reach the lower tiers. */
function costLess(a: RouteCost, b: RouteCost): boolean {
  if (Math.abs(a.hard - b.hard) > 1e-6) return a.hard < b.hard;
  // `lead` sums LEAD_COST × pixel distances, so it carries float noise: compare
  // with a tolerance (like `hard`) so a true tie falls through to `fork`, not a
  // sub-ULP difference. `fork` is an integer count — an exact compare is safe.
  if (Math.abs(a.lead - b.lead) > 1e-9) return a.lead < b.lead;
  return a.fork < b.fork;
}

/** Does the open segment a→b cross the OPEN rectangle interior? Liang–Barsky
 *  parametric clip; used to keep a 45° miter clear of a body/label/clearance
 *  ring (the miter cuts the INNER corner, i.e. toward the obstacle side). */
function segHitsRect(
  a: Point,
  b: Point,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  // Each edge is a constraint `p·t <= q`; clip [t0,t1] against it.
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0; // parallel to this slab: inside iff q≥0
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, a.x - x0)) return false;
  if (!clip(dx, x1 - a.x)) return false;
  if (!clip(-dy, a.y - y0)) return false;
  if (!clip(dy, y1 - a.y)) return false;
  return t1 - t0 > 1e-6; // a positive-length overlap lies inside the rect
}

/** Sorted, de-duplicated coordinates (values within EPS are merged). */
function uniqSorted(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s)
    if (!out.length || v - out[out.length - 1] > EPS) out.push(v);
  return out;
}

/** Inserts up to `maxPerGap` evenly spaced tracks between each pair of adjacent
 *  lines, so a wire can side-step onto a parallel channel instead of overlapping.
 *  Tracks are kept at least `minGap` apart (and from the boundaries): a tight gap
 *  gets FEWER (or no) tracks, so two parallel wires never end up a couple of
 *  pixels apart — they fall back to the wider channel boundaries instead. */
function withLaneTracks(
  lines: number[],
  minGap: number,
  maxPerGap: number
): number[] {
  if (maxPerGap <= 0) return lines;
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (i < lines.length - 1) {
      const a = lines[i];
      const span = lines[i + 1] - a;
      const n = Math.max(0, Math.min(maxPerGap, Math.floor(span / minGap) - 1));
      for (let k = 1; k <= n; k++) out.push(a + (span * k) / (n + 1));
    }
  }
  return uniqSorted(out);
}

/** Index of the coordinate equal to `v` (within EPS) — pins/edges are grid
 *  lines by construction, so this always resolves. */
function indexOf(lines: number[], v: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let best = 0;
  let bestD = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const d = Math.abs(lines[mid] - v);
    if (d < bestD) {
      bestD = d;
      best = mid;
    }
    if (lines[mid] < v) lo = mid + 1;
    else hi = mid - 1;
  }
  return best;
}

export function routeOrthogonal(
  obstacles: RouterObstacle[],
  wires: RouterWire[],
  opts: RouteOptions = {}
): Map<string, Point[]> {
  const clearance = opts.clearance ?? 6;
  const lanes = opts.laneTracks ?? 1;

  // Normalize the measured geometry to design space so every fixed-px lead/cost
  // below is scale-invariant; the routed polylines are scaled back before return
  // (see {@link RouteOptions.scale}). Normals are unit vectors — untouched.
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  if (scale !== 1) {
    obstacles = obstacles.map((o) => ({
      ...o,
      x: o.x / scale,
      y: o.y / scale,
      w: o.w / scale,
      h: o.h / scale,
      ...(o.labelW != null ? { labelW: o.labelW / scale } : {}),
      ...(o.labelH != null ? { labelH: o.labelH / scale } : {}),
    }));
    const norm = (e: RouterEndpoint): RouterEndpoint => ({
      ...e,
      point: { x: e.point.x / scale, y: e.point.y / scale },
    });
    wires = wires.map((w) => ({ ...w, from: norm(w.from), to: norm(w.to) }));
  }

  // Net-aware fan-out. Wires that leave the SAME driver ({@link driverOf}) belong to
  // one net (a signal pad or a gate output feeding several inputs). We give the
  // net a SINGLE source anchor — the mean of its members' anchors, all on the
  // driver's face — so it leaves from ONE point, and we route its wires
  // consecutively; combined with the per-net lane rule below (same-net edges are
  // free to reuse), later sinks ride the trunk the first one laid. The net thus
  // draws as one trunk that BRANCHES, not N parallel wires from N points.
  const byNet = new Map<string, RouterWire[]>();
  for (const w of wires) {
    const list = byNet.get(driverOf(w.from));
    if (list) list.push(w);
    else byNet.set(driverOf(w.from), [w]);
  }
  const ordered: RouterWire[] = [];
  for (const group of byNet.values()) {
    // A distributed face fan-out (a signal pad's PORTS) keeps its per-wire anchors
    // — they were already spread along the face upstream, so merging them would
    // undo the distribution and re-create a single point. A fixed-pin fan-out
    // instead has all branches on the ONE terminal, whose mean is that same point:
    // merging is a no-op that also unifies the two per-target-straightened anchors
    // of a plain node so the net leaves from one trunk.
    if (group.length < 2 || group[0].from.fanPort) {
      ordered.push(...group);
      continue;
    }
    const sx = group.reduce((s, w) => s + w.from.point.x, 0) / group.length;
    const sy = group.reduce((s, w) => s + w.from.point.y, 0) / group.length;
    for (const w of group)
      ordered.push({ ...w, from: { ...w.from, point: { x: sx, y: sy } } });
  }
  wires = ordered;

  // Two DIFFERENT groupings, and the difference matters — see {@link electricalNets}.
  //   • DRIVER ({@link driverOf}) — wires leaving the same TERMINAL. They are one wire
  //     that branches, so they share a trunk (× {@link TRUNK_SHARE}) and co-locate
  //     their splits (`fork`).
  //   • NET — the same circuit node, junction hops included. Nets must not share a
  //     track and do not "cross" each other; but two hops of one net may NOT merge
  //     early, because the junction DOT is where their connection is drawn.
  // Every wire of a driver is in one net, so a driver maps to exactly one net.
  const nets = electricalNets(wires);
  const netOfDriver = new Map<string, string>();
  for (const w of wires)
    netOfDriver.set(driverOf(w.from), nets.get(w.key) ?? driverOf(w.from));
  const netAt = (driver: string): string => netOfDriver.get(driver) ?? driver;

  // Rects per component. `hard` BODY = a real component: always an obstacle,
  // even for the wire it connects to (so a wire can't cut through a node to
  // reach a far-side pin); its clearance ring is skippable for own pins. A
  // node's LABEL (measured text below it) is a SOFT obstacle: it blocks OTHER
  // wires (a wire must not be hidden behind an unrelated label) but is skipped
  // for the node's OWN wires — a component's pin often sits right above its
  // label (a rotated resistor), so its own wire may pass; z-order keeps that
  // wire on top of the text.
  const LABEL_GAP = 6;
  const LABEL_CLEAR = 3;
  const rect = (
    id: string,
    hard: boolean,
    bx0: number,
    by0: number,
    bx1: number,
    by1: number,
    m: number
  ) => ({
    id,
    hard,
    bx0,
    by0,
    bx1,
    by1,
    x0: bx0 - m,
    y0: by0 - m,
    x1: bx1 + m,
    y1: by1 + m,
  });
  const rects = obstacles.flatMap((o) => {
    const body = rect(
      o.id,
      true,
      o.x - o.w / 2,
      o.y - o.h / 2,
      o.x + o.w / 2,
      o.y + o.h / 2,
      clearance
    );
    if (!o.labelH || o.labelH <= 0 || !o.labelW || o.labelW <= 0) return [body];
    // Label box, positioned on the SAME side the renderer draws it (single source
    // of truth: Stage decides the side, both this obstacle and the CSS follow).
    // `bottom` (default): centred under the body. `left`/`right`: vertically
    // centred just past the body face (a top/bottom-wired component).
    let lx0: number, ly0: number, lx1: number, ly1: number;
    if (o.labelSide === 'left') {
      lx1 = o.x - o.w / 2 - LABEL_GAP;
      lx0 = lx1 - o.labelW;
      ly0 = o.y - o.labelH / 2;
      ly1 = o.y + o.labelH / 2;
    } else if (o.labelSide === 'right') {
      lx0 = o.x + o.w / 2 + LABEL_GAP;
      lx1 = lx0 + o.labelW;
      ly0 = o.y - o.labelH / 2;
      ly1 = o.y + o.labelH / 2;
    } else {
      lx0 = o.x - o.labelW / 2;
      lx1 = o.x + o.labelW / 2;
      ly0 = o.y + o.h / 2 + LABEL_GAP;
      ly1 = ly0 + o.labelH;
    }
    return [
      body,
      // a label always blocks — wires contour AROUND it, never over it
      rect(o.id, true, lx0, ly0, lx1, ly1, LABEL_CLEAR),
    ];
  });

  // Grid lines: every pin coordinate and every keep-out edge, plus lane tracks.
  const xsBase: number[] = [];
  const ysBase: number[] = [];
  for (const r of rects) {
    xsBase.push(r.x0, r.x1);
    ysBase.push(r.y0, r.y1);
  }
  for (const w of wires) {
    xsBase.push(w.from.point.x, w.to.point.x);
    ysBase.push(w.from.point.y, w.to.point.y);
    // A grid line exactly at each hard connector's lead boundary, so a wire can
    // turn PRECISELY at PIN_LEAD instead of overshooting to the next Hanan line.
    for (const e of [w.from, w.to]) {
      if (!e.hardNormal) continue;
      const u = axisUnit(e.normal);
      if (u.x !== 0) xsBase.push(e.point.x + u.x * PIN_LEAD);
      else ysBase.push(e.point.y + u.y * PIN_LEAD);
    }
  }
  // Outer margin lines so a wire can detour AROUND the whole cluster, not only
  // between bodies (a long span past several components in a row).
  const MARGIN = 28;
  const spanX = uniqSorted(xsBase);
  const spanY = uniqSorted(ysBase);
  xsBase.push(spanX[0] - MARGIN, spanX[spanX.length - 1] + MARGIN);
  ysBase.push(spanY[0] - MARGIN, spanY[spanY.length - 1] + MARGIN);
  // Keep parallel wires visibly apart: lane tracks are spaced ≥ ~2× clearance.
  const laneGap = Math.max(11, clearance * 2);
  const xs = withLaneTracks(uniqSorted(xsBase), laneGap, lanes);
  const ys = withLaneTracks(uniqSorted(ysBase), laneGap, lanes);
  const nx = xs.length;
  const ny = ys.length;

  // An edge (tested at its midpoint) is blocked if it pierces a HARD body, or —
  // for rects that are NOT the wire's own endpoints — a soft label body or a
  // clearance ring. `bodySkip` lifts the HARD body of a node whose endpoint is a
  // POINT (a junction/pad that anchors at its CENTRE, so the wire must be able to
  // reach inside it) — a PIN endpoint anchors on the border, so its body still
  // blocks (a wire can't cut through to a far-side pin). STRICT interior, so
  // routing ON a boundary is allowed (a tight detour hugging a component).
  const inRect = (
    px: number,
    py: number,
    skip: Set<string>,
    bodySkip: Set<string>
  ): boolean => {
    for (const r of rects) {
      const inBody =
        px > r.bx0 + EPS &&
        px < r.bx1 - EPS &&
        py > r.by0 + EPS &&
        py < r.by1 - EPS;
      if (inBody && r.hard && !bodySkip.has(r.id)) return true;
      if (skip.has(r.id)) continue; // own node: its label / clearance don't block
      if (inBody) return true; // an unrelated label
      if (
        px > r.x0 + EPS &&
        px < r.x1 - EPS &&
        py > r.y0 + EPS &&
        py < r.y1 - EPS
      )
        return true;
    }
    return false;
  };

  // Segment version of `inRect`, for the diagonal miter pass: a straight a→b run
  // is clear iff it enters no HARD body (respecting `bodySkip`) and no unrelated
  // label / clearance ring (respecting `skip`). Same skip semantics as `inRect`.
  const segClear = (
    a: Point,
    b: Point,
    skip: Set<string>,
    bodySkip: Set<string>
  ): boolean => {
    for (const r of rects) {
      // STRICT interior (shrunk by EPS), like `inRect`: a run exactly on a
      // boundary is allowed (a tight detour hugging a component).
      const hitBody = segHitsRect(
        a,
        b,
        r.bx0 + EPS,
        r.by0 + EPS,
        r.bx1 - EPS,
        r.by1 - EPS
      );
      if (hitBody && r.hard && !bodySkip.has(r.id)) return false;
      if (skip.has(r.id)) continue; // own node: its label / clearance don't block
      if (hitBody) return false; // an unrelated label
      if (segHitsRect(a, b, r.x0 + EPS, r.y0 + EPS, r.x1 - EPS, r.y1 - EPS))
        return false;
    }
    return true;
  };

  /**
   * The shared grid occupancy the wires read from each other. Each map counts, per
   * site, how many wires of a given NET occupy it — a COUNT, not a flag, because
   * the rip-up pass below must be able to lift ONE wire off a site its net-mates
   * still stand on (two branches of a fan-out routinely share a trunk edge).
   * `occupy(…, +1)` lays a wire down, `occupy(…, -1)` picks it back up; a net drops
   * out of a site exactly when its last wire leaves.
   */
  type Occupancy = Map<string, Map<string, number>>;
  /**
   * Lane occupancy, indexed per TRACK — a grid line plus an orientation (`v:12` is
   * the vertical line at `xs[12]`). On each track, every DRIVER owns the unit EDGES
   * its wires run on (an edge is named by its LOWER endpoint index). Keyed by driver
   * because that is the finer of the two groupings: {@link onTrunk} needs it as-is,
   * and {@link laneCost} folds it up to the net via `netAt`.
   *
   * Indexed per track rather than per edge so {@link laneCost} can ask the question
   * that decides how the diagram READS — "is another net running anywhere near me
   * along this track?" — instead of only "does another net use this exact edge?".
   */
  const usage = new Map<string, Map<string, Map<number, number>>>();
  const trackKey = (o: 'h' | 'v', fixed: number): string => `${o}:${fixed}`;
  /** The px span covered by unit edge `e` of a track of the given orientation. */
  const edgeSpan = (o: 'h' | 'v', e: number): [number, number] =>
    o === 'h' ? [xs[e], xs[e + 1]] : [ys[e], ys[e + 1]];
  /** Lays `driver` onto (`d` = +1) / lifts it off (`d` = −1) edge `e` of a track. */
  const occupyEdge = (
    o: 'h' | 'v',
    fixed: number,
    e: number,
    driver: string,
    d: 1 | -1
  ): void => {
    const tk = trackKey(o, fixed);
    let byDriver = usage.get(tk);
    if (!byDriver) {
      if (d < 0) return;
      byDriver = new Map();
      usage.set(tk, byDriver);
    }
    let edges = byDriver.get(driver);
    if (!edges) {
      if (d < 0) return;
      edges = new Map();
      byDriver.set(driver, edges);
    }
    const n = (edges.get(e) ?? 0) + d;
    if (n > 0) edges.set(e, n);
    else edges.delete(e);
    if (!edges.size) byDriver.delete(driver);
    if (!byDriver.size) usage.delete(tk);
  };
  /** Is a sibling wire of `driver` already on edge `e` — i.e. is this its own trunk? */
  const onTrunk = (
    o: 'h' | 'v',
    fixed: number,
    e: number,
    driver: string
  ): boolean => usage.get(trackKey(o, fixed))?.get(driver)?.has(e) ?? false;
  /**
   * {@link LANE_COST} per OTHER net running within {@link LANE_FUSE} px ACROSS and
   * `laneGap` px ALONG of edge `e` — a true parallel overlap (negative gap) included.
   *
   * PROXIMITY, not just overlap, is the rule, because a track is read as a whole: two
   * nets that share one track without touching still draw as a SINGLE line with an
   * unexplained break in it, which misleads worse than an honest crossing (in
   * `logicGates`, a gate's two input pads rose on one track ~10px apart and read as
   * one wire — as if A and B were shorted). Charging their proximity moves the second
   * net one track over, which also hands the first net its whole column back: its
   * fan-out branches can then share ONE riser (the `fork` tier below) instead of
   * splitting onto stubs a few px apart.
   *
   * The neighbouring tracks are searched, not just this one, because the defect is a
   * DISTANCE in px and the grid is only how we enumerate it. The Hanan lines come from
   * the pins, so two of them land wherever two gates happen to sit — in `halfAdder`,
   * `B → xor:b` and `A → and:a` ran 50px side by side 2px apart, one line to the eye,
   * yet on two distinct tracks the same-track rule never compared. See {@link LANE_FUSE}.
   *
   * Reusing `laneGap` ALONG the track — the spacing {@link withLaneTracks} lays tracks
   * out on — is what keeps the rule satisfiable: a wire pushed off a track lands on the
   * very next one, which is by construction far enough away to be free.
   */
  const laneCost = (
    o: 'h' | 'v',
    fixed: number,
    e: number,
    net: string
  ): number => {
    const [a0, a1] = edgeSpan(o, e);
    // Per NET, not per driver: two branches of one fan-out crowding a track are the
    // SAME line, and charging them twice would price a shape the eye reads once.
    const charged = new Set<string>();
    // The axis the tracks of this orientation are spread along: a horizontal track is
    // pinned at a `ys` line, a vertical one at an `xs` line.
    const across = o === 'h' ? ys : xs;
    const chargeTrack = (f: number): void => {
      const byDriver = usage.get(trackKey(o, f));
      if (!byDriver) return;
      for (const [driver, edges] of byDriver) {
        const other = netAt(driver);
        if (other === net || charged.has(other)) continue;
        for (const oe of edges.keys()) {
          const [b0, b1] = edgeSpan(o, oe);
          if (Math.max(a0, b0) - Math.min(a1, b1) < laneGap) {
            charged.add(other);
            break; // this net is already paid for; its other runs add nothing
          }
        }
      }
    };
    // This track, then outward each way while the tracks are too close to tell apart.
    chargeTrack(fixed);
    for (
      let f = fixed - 1;
      f >= 0 && across[fixed] - across[f] < LANE_FUSE;
      f--
    )
      chargeTrack(f);
    for (
      let f = fixed + 1;
      f < across.length && across[f] - across[fixed] < LANE_FUSE;
      f++
    )
      chargeTrack(f);
    return charged.size * LANE_COST;
  };

  // Per grid VERTEX, the nets that pass STRAIGHT through it horizontally / vertically
  // (a corner is neither — it is a turn, handled by the lane rule above). A candidate
  // straight pass-through costs {@link CROSS_DETOUR} per OTHER net crossing it
  // perpendicular here, so a wire dodges a neighbour when a short detour suffices.
  const hpass: Occupancy = new Map();
  const vpass: Occupancy = new Map();
  const vertKey = (i: number, j: number): string => `${i},${j}`;

  // Per grid VERTEX, the nets that TURN (corner) there. A later branch of the SAME
  // net that also turns here pays no `fork` (see {@link RouteCost}), so a fan-out's
  // branch points snap onto one shared junction — a clean T instead of offset steps.
  const turnAt: Occupancy = new Map();

  /** Adds `d` (+1 lay down / −1 pick up) to `net`'s count at `site`, dropping the
   *  entry when it reaches 0 so `has()` means "some wire of this net is here". */
  const occupy = (m: Occupancy, site: string, net: string, d: number): void => {
    let at = m.get(site);
    if (!at) {
      if (d < 0) return;
      at = new Map();
      m.set(site, at);
    }
    const n = (at.get(net) ?? 0) + d;
    if (n > 0) at.set(net, n);
    else at.delete(net);
    if (!at.size) m.delete(site);
  };

  const results = new Map<string, Point[]>();
  /** Each wire's routed grid path, so it can be un-marked and re-routed. */
  const paths = new Map<string, [number, number][]>();

  /** Lays a wire's grid path onto (`d` = +1) / lifts it off (`d` = −1) the shared
   *  occupancy maps. Interior vertices only: an endpoint is a terminus (a T, not a
   *  crossing), and a corner is a turn — recorded in `turnAt`, not as a pass-through. */
  const markPath = (seq: [number, number][], net: string, d: 1 | -1): void => {
    for (let m = 0; m < seq.length - 1; m++) {
      const [ai, aj] = seq[m];
      const [bi, bj] = seq[m + 1];
      const orient: 'h' | 'v' = ai !== bi ? 'h' : 'v';
      occupyEdge(
        orient,
        orient === 'h' ? aj : ai,
        orient === 'h' ? Math.min(ai, bi) : Math.min(aj, bj),
        net,
        d
      );
    }
    for (let m = 1; m < seq.length - 1; m++) {
      const [pi, pj] = seq[m - 1];
      const [ci, cj] = seq[m];
      const [ni, nj] = seq[m + 1];
      const straightH = pj === cj && cj === nj;
      const straightV = pi === ci && ci === ni;
      const vk = vertKey(ci, cj);
      if (!straightH && !straightV) occupy(turnAt, vk, net, d);
      else occupy(straightH ? hpass : vpass, vk, net, d);
    }
  };

  /** Routes ONE wire against the CURRENT occupancy (its own path must already be
   *  lifted off). Returns the grid path — `null` when the goal is unreachable —
   *  plus the polyline to render. */
  const routeWire = (
    wire: RouterWire
  ): { seq: [number, number][] | null; poly: Point[] } => {
    const wireDriver = driverOf(wire.from);
    const wireNet = netAt(wireDriver);
    const skip = new Set<string>([wire.from.node, wire.to.node]);
    // A POINT endpoint anchors at the node CENTRE (inside its body), so that
    // body must not block THIS wire; a PIN endpoint is on the border, so its
    // body still blocks (no cutting through to a far-side pin).
    const bodySkip = new Set<string>();
    if (!wire.from.hardNormal) bodySkip.add(wire.from.node);
    if (!wire.to.hardNormal) bodySkip.add(wire.to.node);

    // Lead corridors: a hard connector's wire should run PIN_LEAD px straight
    // along its normal before the FIRST turn (and the last turn should stay
    // PIN_LEAD before the pin), so it leaves/enters a component face cleanly
    // instead of bending flush against it. Turning at a grid vertex lying ON such
    // a corridor, within PIN_LEAD of the pin, is charged {@link LEAD_COST} per
    // pixel of missing lead — a preference, not a ban, so a boxed-in pin still
    // routes (it just bends as late as it can). Soft POINT endpoints have none.
    const leadZones: { px: number; py: number; ux: number; uy: number }[] = [];
    for (const e of [wire.from, wire.to]) {
      if (!e.hardNormal) continue;
      const u = axisUnit(e.normal);
      leadZones.push({ px: e.point.x, py: e.point.y, ux: u.x, uy: u.y });
    }
    // Extra cost for turning AT (px, py): 0 outside every lead zone, else grows
    // linearly the closer the turn sits to the pin (max at the face).
    const leadPenalty = (px: number, py: number): number => {
      let worst = 0;
      for (const z of leadZones) {
        const along = (px - z.px) * z.ux + (py - z.py) * z.uy;
        const transverse = (px - z.px) * -z.uy + (py - z.py) * z.ux;
        if (Math.abs(transverse) < EPS && along > EPS && along < PIN_LEAD - EPS)
          worst = Math.max(worst, (PIN_LEAD - along) * LEAD_COST);
      }
      return worst;
    };

    // A diagonal wire first tries a direct octilinear elbow (a bold centred
    // diagonal). It only wins if collision-free; otherwise we fall through to the
    // orthogonal A* and miter its corners — so a diagonal is never a regression.
    if (wire.diagonal) {
      const elbow = octilinearElbow(
        wire.from,
        wire.to,
        (a, b) => segClear(a, b, skip, bodySkip),
        PIN_LEAD
      );
      if (elbow) return { seq: null, poly: elbow };
    }

    const si = indexOf(xs, wire.from.point.x);
    const sj = indexOf(ys, wire.from.point.y);
    const gi = indexOf(xs, wire.to.point.x);
    const gj = indexOf(ys, wire.to.point.y);

    // Direction the wire must leave the start / arrive at the goal (grid steps).
    const dir = (n: Point): [number, number] => {
      if (Math.abs(n.x) >= Math.abs(n.y)) return [n.x >= 0 ? 1 : -1, 0];
      return [0, n.y >= 0 ? 1 : -1];
    };
    // The wire LEAVES the source along its outward normal, and ARRIVES at the
    // target moving INTO it (i.e. against the target's outward normal).
    const startDir = wire.from.hardNormal ? dir(wire.from.normal) : null;
    const goalDir = wire.to.hardNormal
      ? dir({ x: -wire.to.normal.x, y: -wire.to.normal.y })
      : null;

    // A* over grid vertices. State = (i, j, incoming direction) so turns cost.
    // `g` is the LEXICOGRAPHIC cost so far (see {@link RouteCost}); the priority
    // key `f` adds the length heuristic to `g.hard` only (`lead` has no heuristic
    // — admissible, since `h` under-estimates the `hard` tier alone: every term
    // `hard` adds on top of raw length is non-negative).
    const key = (i: number, j: number, di: number, dj: number): string =>
      `${i},${j},${di},${dj}`;
    const open: {
      i: number;
      j: number;
      di: number;
      dj: number;
      g: RouteCost;
      f: RouteCost;
    }[] = [];
    const gScore = new Map<string, RouteCost>();
    const came = new Map<string, string | null>();
    const h = (i: number, j: number): number =>
      Math.abs(xs[i] - xs[gi]) + Math.abs(ys[j] - ys[gj]);
    const withH = (g: RouteCost, i: number, j: number): RouteCost => ({
      hard: g.hard + h(i, j),
      lead: g.lead,
      fork: g.fork,
    });

    const startKey = key(si, sj, 0, 0);
    const zero: RouteCost = { hard: 0, lead: 0, fork: 0 };
    gScore.set(startKey, zero);
    came.set(startKey, null);
    open.push({ i: si, j: sj, di: 0, dj: 0, g: zero, f: withH(zero, si, sj) });

    const DIRS: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let goalState: string | null = null;

    while (open.length) {
      // Pop the lexicographically lowest f (small grids → linear scan is fine).
      let bi = 0;
      for (let k = 1; k < open.length; k++)
        if (costLess(open[k].f, open[bi].f)) bi = k;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.i, cur.j, cur.di, cur.dj);
      const best = gScore.get(ck);
      if (best && costLess(best, cur.g)) continue; // a better tuple already settled
      if (cur.i === gi && cur.j === gj) {
        if (!goalDir || (cur.di === goalDir[0] && cur.dj === goalDir[1])) {
          goalState = ck;
          break;
        }
      }
      for (const [ddi, ddj] of DIRS) {
        // First move must follow the pin normal.
        if (cur.di === 0 && cur.dj === 0 && startDir) {
          if (ddi !== startDir[0] || ddj !== startDir[1]) continue;
        }
        const ni = cur.i + ddi;
        const nj = cur.j + ddj;
        if (ni < 0 || ni >= nx || nj < 0 || nj >= ny) continue;
        // Reversing straight back is never useful.
        if (ddi === -cur.di && ddj === -cur.dj && (cur.di || cur.dj)) continue;
        // Edge blocked by an obstacle? Test its midpoint.
        const mx = (xs[cur.i] + xs[ni]) / 2;
        const my = (ys[cur.j] + ys[nj]) / 2;
        if (inRect(mx, my, skip, bodySkip)) continue;
        const len = Math.abs(xs[ni] - xs[cur.i]) + Math.abs(ys[nj] - ys[cur.j]);
        const turned = (cur.di || cur.dj) && (ddi !== cur.di || ddj !== cur.dj);
        // Keep a clean lead at each connector: turning inside a pin's lead zone
        // (the turn happens AT `cur`) is charged, so A* prefers the full lead and,
        // where boxed in, bends as late as it can.
        const leadCost = turned ? leadPenalty(xs[cur.i], ys[cur.j]) : 0;
        const orient: 'h' | 'v' = ddi !== 0 ? 'h' : 'v';
        const fixed = orient === 'h' ? nj : ni;
        const e = orient === 'h' ? Math.min(cur.i, ni) : Math.min(cur.j, nj);
        // Another net running NEAR this edge along the same track costs a lane (see
        // {@link laneCost}). The edge a SIBLING of this wire laid (its own driver's
        // trunk) is not just free — it is DISCOUNTED (× TRUNK_SHARE), so a fan-out
        // branch clings to the shared trunk and splits as LATE as it can (e.g. it
        // rides Bin's vertical riser and peels off high up toward a right-hand gate)
        // instead of diverging at the first corner — one fewer corner and one fewer
        // crossing per branch. Keyed on the DRIVER, not the net: two hops of one net
        // meeting at a junction must NOT merge before it, or the drawing shows them
        // joining where there is no junction dot.
        const sameNet = onTrunk(orient, fixed, e, wireDriver);
        const lane = laneCost(orient, fixed, e, wireNet);
        const effLen = sameNet ? len * TRUNK_SHARE : len;
        // Going STRAIGHT through `cur` (no turn, not the first move) crosses any
        // other net passing perpendicular through cur. Priced into `hard` at
        // CROSS_DETOUR px each: a wire may spend that much extra length to dodge
        // an earlier one, but — the weight being under TURN_COST — never a corner.
        let crossCount = 0;
        if (!turned && (cur.di || cur.dj)) {
          const perp = orient === 'h' ? vpass : hpass;
          const at = perp.get(vertKey(cur.i, cur.j));
          if (at)
            for (const n of at.keys()) if (netAt(n) !== wireNet) crossCount++;
        }
        // Turning AT `cur` costs one `fork` UNLESS a sibling from the same DRIVER
        // already turned here — so the branches of one fan-out snap their corners
        // together into a shared T-junction, worth FORK_DETOUR px of detour.
        let forkCost = 0;
        if (turned) {
          const sib = turnAt.get(vertKey(cur.i, cur.j));
          if (!sib || !sib.has(wireDriver)) forkCost = 1;
        }
        const ng: RouteCost = {
          hard:
            cur.g.hard +
            effLen +
            (turned ? TURN_COST : 0) +
            lane +
            crossCount * CROSS_DETOUR +
            forkCost * FORK_DETOUR,
          lead: cur.g.lead + leadCost,
          fork: cur.g.fork + forkCost,
        };
        const nk = key(ni, nj, ddi, ddj);
        const prev = gScore.get(nk);
        if (!prev || costLess(ng, prev)) {
          gScore.set(nk, ng);
          came.set(nk, ck);
          open.push({
            i: ni,
            j: nj,
            di: ddi,
            dj: ddj,
            g: ng,
            f: withH(ng, ni, nj),
          });
        }
      }
    }

    // Reconstruct (fall back to a direct 2-corner L if unreachable).
    let poly: Point[];
    let seq: [number, number][] | null = null;
    if (goalState) {
      seq = [];
      let k: string | null = goalState;
      while (k) {
        const [i, j] = k.split(',').map(Number);
        seq.push([i, j]);
        k = came.get(k) ?? null;
      }
      seq.reverse();
      poly = seq.map(([i, j]) => ({ x: xs[i], y: ys[j] }));
    } else {
      // Unreachable on the grid: never draw a diagonal — fall back to a
      // 2-corner orthogonal L that leaves the source along its normal.
      const s = wire.from.point;
      const e = wire.to.point;
      const horizFirst =
        Math.abs(wire.from.normal.x) >= Math.abs(wire.from.normal.y);
      const corner = horizFirst ? { x: e.x, y: s.y } : { x: s.x, y: e.y };
      poly = [s, corner, e];
    }
    const simplified = simplify(poly);
    if (wire.diagonal) {
      // Keep a straight lead only at a hard pin (a POINT endpoint may turn at once).
      const stubStart = wire.from.hardNormal ? PIN_LEAD : 0;
      const stubEnd = wire.to.hardNormal ? PIN_LEAD : 0;
      return {
        seq,
        poly: diagonalize(
          simplified,
          (a, b) => segClear(a, b, skip, bodySkip),
          stubStart,
          stubEnd
        ),
      };
    }
    return { seq, poly: simplified };
  };

  // First pass: lay every wire down in net order, each seeing the ones before it.
  for (const wire of wires) {
    const { seq, poly } = routeWire(wire);
    results.set(wire.key, poly);
    if (seq) {
      paths.set(wire.key, seq);
      markPath(seq, driverOf(wire.from), 1);
    }
  }

  // RIP-UP & REROUTE. The pass above is greedy in net order, so a wire only ever
  // dodges the wires laid BEFORE it: the first net routed is blind to every net
  // that follows and happily threads straight through where they will land. That
  // is a routing-ORDER artefact, not a real optimum — a full adder's B net, routed
  // second, drives its wire straight over the gates whose outputs come later.
  // So: lift each wire back off the grid and re-route it now that ALL the others
  // are down, and keep the result only if the WHOLE diagram improves.
  //
  // A fan-out's SPLIT POINT is the same kind of artefact, and needs this pass for
  // the same reason: the first branch of a net is laid before its siblings exist,
  // so it turns at its own pin's lead with no junction to aim at, and the siblings
  // then branch a few px further along — one net, two stair-stepped T's. Only here,
  // with every branch down, can that first wire be re-routed onto the shared T
  // ({@link FORK_DETOUR} is what makes its A* want to).
  //
  // Acceptance is lexicographic (crossings, then staggered splits, then total
  // length) and measured on the finished polylines, not on the wire's own A* cost:
  // the A* optimises that wire alone, so only the diagram-wide counts can tell
  // whether the length it spent actually bought anything. Splits rank under
  // crossings — a shared T is never worth threading a wire through another net —
  // and over length, which is exactly what the old two-key test got wrong: sliding
  // a branch point along the trunk changes neither crossings nor length, so the
  // co-located route it computed was always discarded as "no improvement". All
  // three keys strictly decrease on every accepted move (the first two bounded
  // integers), so the loop still converges; RIPUP_PASSES only caps the work when
  // reroutes keep interacting.
  let crossings = countInterNetCrossings(results, wires, nets);
  let split = countStaggeredSplits(results, wires);
  let totalLen = totalLength(results, wires);
  for (let pass = 0; pass < RIPUP_PASSES; pass++) {
    let improved = false;
    for (const wire of wires) {
      const seq = paths.get(wire.key);
      if (!seq) continue; // diagonal elbow / unreachable: not on the grid
      const net = driverOf(wire.from);
      const prevPoly = results.get(wire.key)!;
      markPath(seq, net, -1);
      const retry = routeWire(wire);
      if (!retry.seq) {
        // No grid route without its own path down — put the old one back.
        markPath(seq, net, 1);
        continue;
      }
      results.set(wire.key, retry.poly);
      const nowCross = countInterNetCrossings(results, wires, nets);
      const nowSplit = countStaggeredSplits(results, wires);
      const nowLen = totalLength(results, wires);
      if (
        nowCross < crossings ||
        (nowCross === crossings && nowSplit < split) ||
        (nowCross === crossings &&
          nowSplit === split &&
          nowLen < totalLen - 1e-6)
      ) {
        paths.set(wire.key, retry.seq);
        markPath(retry.seq, net, 1);
        crossings = nowCross;
        split = nowSplit;
        totalLen = nowLen;
        improved = true;
      } else {
        results.set(wire.key, prevPoly);
        markPath(seq, net, 1);
      }
    }
    if (!improved) break;
  }

  // A routed wire must never cross itself: strip any loop the lead penalty may
  // have preferred over a flush turn in a tight pin-to-pin gap.
  for (const [k, pts] of results) results.set(k, deloop(pts));

  // Back to player space (the inverse of the design-space normalization above).
  if (scale !== 1)
    for (const [k, pts] of results)
      results.set(
        k,
        pts.map((p) => ({ x: p.x * scale, y: p.y * scale }))
      );

  return results;
}

/** A pair of wire keys whose TARGET endpoints are interchangeable — the two input
 *  pins of a commutative gate ({@link commutativeInputPins}). The optimiser may
 *  swap which wire lands on which pin to remove a crossing, since the gate reads
 *  the same either way. */
export type PinSwapGroup = readonly [string, string];

/** How many improvement sweeps {@link routeWithPinSwaps} makes over the groups.
 *  Each accepted swap strictly lowers the crossing count (a bounded integer), so
 *  the loop converges; this only caps the cost when swaps keep interacting. */
const PIN_SWAP_PASSES = 4;

/**
 * Which ELECTRICAL net each wire belongs to, as a wire-key → net-id map.
 *
 * A wire's driver ({@link driverOf}) is not its net. A JUNCTION — a `point` contour — is
 * ONE node of the circuit, so the hops that tap it (`jBR → jBL`, then `jBL → batt:-`)
 * are one net drawn in several pieces, not two neighbours to be kept apart. Every
 * rule here that asks "is this someone ELSE's wire?" — lane separation, crossings,
 * the shared-trunk discount, `fork` — has to read the net this way, or a rail pays to
 * dodge ITSELF where it meets its own junction and a clean two-corner rail buckles
 * into a staircase.
 *
 * Union-find over two relations: wires that share a driver (a fan-out leaves one
 * terminal), and wires that tap the same junction (an end with a soft normal).
 */
function electricalNets(wires: RouterWire[]): Map<string, string> {
  const parent = new Map<string, string>();
  for (const w of wires) parent.set(w.key, w.key);
  const find = (a: string): string => {
    let root = a;
    while (parent.get(root) !== root) root = parent.get(root)!;
    while (parent.get(a) !== root) {
      const next = parent.get(a)!;
      parent.set(a, root);
      a = next;
    }
    return root;
  };
  // Each site is a place wires become one net; the first wire seen there adopts the
  // rest. `@n` (a junction tap) is kept distinct from `n` (a driver) so a node that
  // is both cannot merge nets through the wrong relation.
  const first = new Map<string, string>();
  for (const w of wires) {
    const sites = [driverOf(w.from)];
    if (!w.from.hardNormal) sites.push(`@${w.from.node}`);
    if (!w.to.hardNormal) sites.push(`@${w.to.node}`);
    for (const site of sites) {
      const prev = first.get(site);
      if (prev === undefined) first.set(site, w.key);
      else {
        const a = find(prev);
        const b = find(w.key);
        if (a !== b) parent.set(a, b);
      }
    }
  }
  return new Map(wires.map((w) => [w.key, find(w.key)]));
}

/** Total Manhattan length of every routed wire — the rip-up pass's tiebreak, so a
 *  detour that buys no crossing is handed back. */
function totalLength(
  routes: Map<string, Point[]>,
  wires: RouterWire[]
): number {
  let total = 0;
  for (const w of wires) {
    const pts = routes.get(w.key);
    if (!pts) continue;
    for (let i = 0; i < pts.length - 1; i++)
      total +=
        Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  }
  return total;
}

/** Split points of a fan-out that DON'T coincide with a sibling's — the count the
 *  rip-up pass must be able to see: A* can already find the co-located route (the
 *  `fork` tier), but acceptance on (crossings, length) alone throws it away, since
 *  sliding a branch point along the trunk changes neither. */
function countStaggeredSplits(
  routes: Map<string, Point[]>,
  wires: RouterWire[]
): number {
  const byDriver = new Map<string, Point[]>();
  for (const w of wires) {
    const r = routes.get(w.key);
    if (!r || r.length < 3) continue; // a straight branch has no split point
    const l = byDriver.get(driverOf(w.from));
    if (l) l.push(r[1]);
    else byDriver.set(driverOf(w.from), [r[1]]);
  }
  let n = 0;
  for (const [, pts] of byDriver) {
    const uniq: Point[] = [];
    for (const p of pts)
      if (
        !uniq.some(
          (q) => Math.abs(q.x - p.x) < EPS && Math.abs(q.y - p.y) < EPS
        )
      )
        uniq.push(p);
    n += uniq.length - 1;
  }
  return n;
}

/** One routed segment, as handed to a crossing visitor. */
type Seg = readonly [Point, Point];

/**
 * Visits every proper crossing between wires of DIFFERENT {@link electricalNets}
 * (same-net wires share a trunk or meet at a junction — neither is a crossing).
 * Reuses {@link segCross}, so it reports exactly what the eye sees.
 *
 * THE definition of "these two wires cross", shared by the router's own count and
 * by {@link wireHops}: the bridge the renderer draws therefore appears on exactly
 * the crossings the router priced ({@link CROSS_DETOUR}) and could not remove —
 * never on a junction, which is what makes the two readable apart.
 */
function forEachInterNetCrossing(
  routes: Map<string, Point[]>,
  wires: RouterWire[],
  nets: Map<string, string>,
  visit: (at: Point, a: RouterWire, sa: Seg, b: RouterWire, sb: Seg) => void
): void {
  for (let i = 0; i < wires.length; i++) {
    const pi = routes.get(wires[i].key);
    if (!pi) continue;
    for (let j = i + 1; j < wires.length; j++) {
      if (nets.get(wires[i].key) === nets.get(wires[j].key)) continue;
      const pj = routes.get(wires[j].key);
      if (!pj) continue;
      for (let a = 0; a < pi.length - 1; a++)
        for (let b = 0; b < pj.length - 1; b++) {
          const at = segCross(pi[a], pi[a + 1], pj[b], pj[b + 1]);
          if (at)
            visit(at, wires[i], [pi[a], pi[a + 1]], wires[j], [
              pj[b],
              pj[b + 1],
            ]);
        }
    }
  }
}

function countInterNetCrossings(
  routes: Map<string, Point[]>,
  wires: RouterWire[],
  nets: Map<string, string> = electricalNets(wires)
): number {
  let n = 0;
  forEachInterNetCrossing(routes, wires, nets, () => {
    n++;
  });
  return n;
}

/** How horizontal a segment is: 1 = flat, 0 = upright, √½ = a 45° diagonal. */
function flatness([a, b]: Seg): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return dx / (Math.hypot(dx, dy) || 1);
}

/**
 * Where each wire must draw a HOP — the little bridge that lifts it over another
 * net's wire, so a crossing reads as a crossing and a T-junction reads as a
 * connection. Wire key → the crossing points THAT wire steps over (in player px,
 * like the routes); a wire absent from the map crosses nobody.
 *
 * Of the two wires only ONE hops, or the bridges would cancel out: the FLATTER
 * segment does. On the orthogonal routes this is the schematic convention — the
 * horizontal wire arches over the vertical one, always the same way round, so the
 * eye learns the shape. A tie (two opposite 45° `diagonal` segments) breaks on the
 * key, so the choice never depends on the order wires were routed in.
 */
export function wireHops(
  routes: Map<string, Point[]>,
  wires: RouterWire[],
  nets: Map<string, string> = electricalNets(wires)
): Map<string, Point[]> {
  const hops = new Map<string, Point[]>();
  forEachInterNetCrossing(routes, wires, nets, (at, a, sa, b, sb) => {
    const fa = flatness(sa);
    const fb = flatness(sb);
    const key =
      Math.abs(fa - fb) > 1e-6
        ? fa > fb
          ? a.key
          : b.key
        : a.key < b.key
          ? a.key
          : b.key;
    const list = hops.get(key);
    if (list) list.push(at);
    else hops.set(key, [at]);
  });
  return hops;
}

/**
 * {@link routeOrthogonal}, then greedily assign each commutative gate's two input
 * pins to minimise wire crossings. A gate like `x3 NAND x7` reads the same as
 * `x7 NAND x3`, so when the wire heading for the upper pin arrives BELOW the one
 * heading for the lower pin (they cross right at the gate), swapping which wire
 * takes which pin removes the crossing at no logical cost.
 *
 * We can't know the winning assignment before routing (it depends on how each
 * wire actually approaches), so we route, count crossings, and for each swap group
 * try the flip and re-route — keeping it only if the total STRICTLY drops. Greedy
 * and deterministic; a swap never raises the count, and the length/corner budget
 * is the router's own concern (the flip is just a different pair of endpoints).
 * `swapGroups` empty ⇒ this is exactly `routeOrthogonal`.
 */
export function routeWithPinSwaps(
  obstacles: RouterObstacle[],
  wires: RouterWire[],
  swapGroups: PinSwapGroup[],
  opts: RouteOptions = {}
): Map<string, Point[]> {
  let current = wires;
  let routes = routeOrthogonal(obstacles, current, opts);
  if (!swapGroups.length) return routes;
  const groups = swapGroups.filter(
    ([a, b]) =>
      current.some((w) => w.key === a) && current.some((w) => w.key === b)
  );
  let crossings = countInterNetCrossings(routes, current);
  for (let pass = 0; pass < PIN_SWAP_PASSES && crossings > 0; pass++) {
    let improved = false;
    for (const [ka, kb] of groups) {
      const wa = current.find((w) => w.key === ka);
      const wb = current.find((w) => w.key === kb);
      if (!wa || !wb) continue;
      // Trade the two wires' target endpoints (their `to`), leaving keys intact.
      const trial = current.map((w) =>
        w.key === ka
          ? { ...w, to: wb.to }
          : w.key === kb
            ? { ...w, to: wa.to }
            : w
      );
      const trialRoutes = routeOrthogonal(obstacles, trial, opts);
      const trialCross = countInterNetCrossings(trialRoutes, trial);
      if (trialCross < crossings) {
        current = trial;
        routes = trialRoutes;
        crossings = trialCross;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return routes;
}

/** Removes duplicate and collinear interior points, so the polyline is the
 *  minimal set of corners (no invisible mid-vertices). Collinearity is the
 *  GENERAL case (perpendicular distance from the a–c line), so it also fuses two
 *  aligned DIAGONAL segments into one — axis-aligned runs are just the special
 *  case where that distance is zero. */
export function simplify(points: Point[]): Point[] {
  const dedup: Point[] = [];
  for (const p of points) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(p.x - last.x) > EPS || Math.abs(p.y - last.y) > EPS)
      dedup.push(p);
  }
  if (dedup.length <= 2) return dedup;
  const out: Point[] = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = out[out.length - 1];
    const b = dedup[i];
    const c = dedup[i + 1];
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const cross = (b.x - a.x) * acy - (b.y - a.y) * acx;
    const lenAC = Math.hypot(acx, acy) || 1;
    const collinear = Math.abs(cross) / lenAC < EPS; // b's distance to line a–c
    if (!collinear) out.push(b);
  }
  out.push(dedup[dedup.length - 1]);
  return out;
}

/** Rewrites an orthogonal polyline into an OCTILINEAR one by mitering every
 *  interior corner into an exact 45° segment. The miter is symmetric (equal
 *  retreat on both legs → |Δx| = |Δy|), so the diagonal is always one of
 *  45 / 135 / 225 / 315°. Its length is MAXIMISED — up to half of a segment
 *  shared by two corners, or the whole segment minus a stub next to a terminal —
 *  so a run of corners (a staircase, or an L with equal legs) collapses into a
 *  single long diagonal, while already-straight wires are untouched. `clear(a, b)`
 *  guards each miter against the bodies/labels (the cut is on the obstacle side
 *  of a detour): on a collision the miter is halved a few times (still 45°) and,
 *  failing that, the sharp corner is kept. `stubStart` / `stubEnd` keep a
 *  perpendicular run next to a hard pin so the wire still leaves the face along
 *  its normal. */
function diagonalize(
  poly: Point[],
  clear: (a: Point, b: Point) => boolean,
  stubStart: number,
  stubEnd: number
): Point[] {
  if (poly.length < 3) return poly; // no interior corner to miter
  const n = poly.length - 1;
  const segLen = (i: number): number =>
    Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
  const unit = (i: number, j: number): Point => {
    const dx = poly[j].x - poly[i].x;
    const dy = poly[j].y - poly[i].y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };
  const out: Point[] = [poly[0]];
  for (let k = 1; k < n; k++) {
    // A segment touching a terminal lends its whole length minus a stub; a
    // segment shared with the neighbouring corner is split down the middle, so
    // two adjacent miters never overlap.
    const inBudget =
      k - 1 === 0 ? Math.max(0, segLen(k - 1) - stubStart) : segLen(k - 1) / 2;
    const outBudget =
      k + 1 === n ? Math.max(0, segLen(k) - stubEnd) : segLen(k) / 2;
    const dirIn = unit(k - 1, k);
    const dirOut = unit(k, k + 1);
    let m = Math.min(inBudget, outBudget);
    let placed = false;
    while (m > DIAG_MIN) {
      const a = { x: poly[k].x - m * dirIn.x, y: poly[k].y - m * dirIn.y };
      const b = { x: poly[k].x + m * dirOut.x, y: poly[k].y + m * dirOut.y };
      if (clear(a, b)) {
        out.push(a, b);
        placed = true;
        break;
      }
      m /= 2;
    }
    if (!placed) out.push(poly[k]); // no room for a miter: keep the right angle
  }
  out.push(poly[n]);
  return simplify(out);
}

/** Proper interior intersection of segments a→b and c→d, or null. Endpoints and
 *  collinear overlaps are excluded (t/u strictly inside), so only a genuine
 *  crossing is reported. General (works for orthogonal AND 45° segments). */
function segCross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null; // parallel or collinear
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  const E = 1e-6;
  if (t > E && t < 1 - E && u > E && u < 1 - E)
    return { x: a.x + t * rx, y: a.y + t * ry };
  return null;
}

/** Removes self-crossings (loops) from a routed polyline: where two segments of
 *  the SAME wire cross, the sub-path between them is spliced out at the crossing
 *  point. Both retained sub-segments lie on originally clear segments, so this
 *  NEVER introduces a collision — it can only shorten the path. A routed wire
 *  must not cross itself; where two opposing pins sit closer than twice
 *  {@link PIN_LEAD}, the soft lead penalty can otherwise make a looping detour
 *  cheaper than a flush turn, and A* emits a knot. This enforces the invariant. */
export function deloop(pts: Point[]): Point[] {
  let path = pts;
  // Each splice removes ≥1 vertex, so the outer count is a safe termination bound.
  for (let guard = path.length; guard > 0; guard--) {
    let spliced = false;
    for (let i = 0; i < path.length - 1 && !spliced; i++) {
      // Prefer the FARTHEST crossing segment: it collapses the largest loop first.
      for (let j = path.length - 2; j > i + 1; j--) {
        const p = segCross(path[i], path[i + 1], path[j], path[j + 1]);
        if (p) {
          path = [...path.slice(0, i + 1), p, ...path.slice(j + 1)];
          spliced = true;
          break;
        }
      }
    }
    if (!spliced) break;
  }
  return simplify(path);
}

/** The dominant cardinal unit of a normal (snaps a pin normal to ±x / ±y). */
function axisUnit(n: Point): Point {
  return Math.abs(n.x) >= Math.abs(n.y)
    ? { x: n.x >= 0 ? 1 : -1, y: 0 }
    : { x: 0, y: n.y >= 0 ? 1 : -1 };
}

/** A direct OCTILINEAR connector between two terminals, used first for a
 *  `diagonal` wire so a feedback pair reads as one bold diagonal crossing the
 *  centre (the SR-latch X) rather than a tight orthogonal dogleg. Each pin is
 *  left/entered along its normal (a straight stub), then the two stub ends are
 *  joined by ONE 45° diagonal CENTRED on the dominant axis, flanked by two equal
 *  straight rails (`rail — diagonal — rail`). Returns `null` if any segment
 *  crosses a body/label, so the caller falls back to the orthogonal A* route —
 *  the diagonal is a bonus, never a regression. */
function octilinearElbow(
  from: RouterEndpoint,
  to: RouterEndpoint,
  clear: (a: Point, b: Point) => boolean,
  stub: number
): Point[] | null {
  const sDir = from.hardNormal ? axisUnit(from.normal) : null;
  const tDir = to.hardNormal ? axisUnit(to.normal) : null;
  const s0 = from.point;
  const t0 = to.point;
  // A hard pin gets a straight stub; a soft POINT endpoint is joined directly.
  const s = sDir ? { x: s0.x + sDir.x * stub, y: s0.y + sDir.y * stub } : s0;
  const t = tDir ? { x: t0.x + tDir.x * stub, y: t0.y + tDir.y * stub } : t0;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const mid: Point[] = [];
  if (adx > 0.6 && ady > 0.6) {
    const d = Math.min(adx, ady); // the 45° diagonal covers `d` on both axes
    if (ady >= adx) {
      const half = (ady - d) / 2; // split the vertical remainder either side
      const y1 = s.y + sy * half;
      mid.push({ x: s.x, y: y1 }, { x: s.x + sx * d, y: y1 + sy * d });
    } else {
      const half = (adx - d) / 2; // split the horizontal remainder either side
      const x1 = s.x + sx * half;
      mid.push({ x: x1, y: s.y }, { x: x1 + sx * d, y: s.y + sy * d });
    }
  }
  const path = simplify([
    s0,
    ...(sDir ? [s] : []),
    ...mid,
    ...(tDir ? [t] : []),
    t0,
  ]);
  for (let i = 0; i < path.length - 1; i++)
    if (!clear(path[i], path[i + 1])) return null;
  return path;
}
