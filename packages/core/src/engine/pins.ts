import type { NodeType } from '../types';

/**
 * Named terminals ("pins") of electrical component symbols, and the parsing of
 * `"node:pin"` endpoint references.
 *
 * A dataflow node anchors its edges on the nearest cardinal FACE. A schematic
 * component instead exposes fixed, NAMED terminals (a resistor's `a`/`b`, a
 * transistor's `base`/`collector`/`emitter`, a source's `+`/`-`): a wire must
 * meet a specific one, wherever the other end sits. This module is the single
 * source of truth for where those terminals live on each symbol; the vector math
 * that turns a {@link PinDef} into an on-screen anchor lives in `geometry.ts`
 * (`pinAttach`), so this module stays free of any DOM/measure concern.
 */

/**
 * A terminal, in the symbol's UNROTATED local box:
 * - `x` / `y`: position as a fraction of the box (`0,0` = top-left corner,
 *   `1,1` = bottom-right), so it is size-independent;
 * - `nx` / `ny`: the OUTWARD direction the wire leaves the terminal (a unit-ish
 *   vector; it is normalized at use). Both the position and the normal are
 *   rotated by the node's `rotation` at anchor time.
 */
export interface PinDef {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

// Shorthand terminals for the very common axis-aligned cases.
const WEST: PinDef = { x: 0, y: 0.5, nx: -1, ny: 0 };
const EAST: PinDef = { x: 1, y: 0.5, nx: 1, ny: 0 };
const NORTH: PinDef = { x: 0.5, y: 0, nx: 0, ny: -1 };

/** Two-terminal inline component (resistor, capacitor…): `a` west, `b` east. */
const TWO_TERMINAL: Record<string, PinDef> = { a: WEST, b: EAST };

/** Two-terminal polarized component / source: `-` west, `+` east (plus `a`/`b`
 *  aliases so a source can be wired like any inline component). */
const POLARIZED: Record<string, PinDef> = {
  '-': WEST,
  '+': EAST,
  a: WEST,
  b: EAST,
};

/** The two channel terminals of a MOS transistor, on the right face: the symbol
 *  is drawn to be read top-to-bottom, so these are the supply-side (`CH_HI`) and
 *  the other end (`CH_LO`) — which terminal each one IS depends on N vs P. */
const CH_HI: PinDef = { x: 1, y: 0.15, nx: 1, ny: 0 };
const CH_LO: PinDef = { x: 1, y: 0.85, nx: 1, ny: 0 };

/** Two-input logic gate: inputs `a` (upper-left) / `b` (lower-left), output `y`
 *  (right, `out` alias). */
const LOGIC_2IN: Record<string, PinDef> = {
  a: { x: 0, y: 0.32, nx: -1, ny: 0 },
  b: { x: 0, y: 0.68, nx: -1, ny: 0 },
  y: EAST,
  out: EAST,
};

/** One-input logic gate (NOT / buffer): input `a` (`in` alias), output `y`. */
const LOGIC_1IN: Record<string, PinDef> = {
  a: WEST,
  in: WEST,
  y: EAST,
  out: EAST,
};

/** Three-input logic gate: inputs `a`/`b`/`c` evenly spread on the left face,
 *  output `y` (`out` alias). The middle input sits at mid-height, so a straight
 *  wire into `b` needs no bend — the same property the 2-input map gives `y`. */
const LOGIC_3IN: Record<string, PinDef> = {
  a: { x: 0, y: 0.25, nx: -1, ny: 0 },
  b: { x: 0, y: 0.5, nx: -1, ny: 0 },
  c: { x: 0, y: 0.75, nx: -1, ny: 0 },
  y: EAST,
  out: EAST,
};

// Terminal rows shared by the fixed-pin functional blocks below. A block is a
// BOX, so its terminals sit on the same two heights whatever the box computes:
// keeping them in named constants is what stops a flip-flop's `q` from drifting
// off the row a mux's `y` uses, which would make two adjacent blocks in one
// diagram look misaligned for no reason.
const ROW_HI = 0.28;
const ROW_LO = 0.72;
const IN_HI: PinDef = { x: 0, y: ROW_HI, nx: -1, ny: 0 };
const IN_MID: PinDef = WEST;
const IN_LO: PinDef = { x: 0, y: ROW_LO, nx: -1, ny: 0 };
const OUT_HI: PinDef = { x: 1, y: ROW_HI, nx: 1, ny: 0 };
const OUT_LO: PinDef = { x: 1, y: ROW_LO, nx: 1, ny: 0 };
/** Select line of a (de)multiplexer: enters from BELOW, as on the drawn symbol. */
const SELECT: PinDef = { x: 0.5, y: 1, nx: 0, ny: 1 };

/** The two outputs every bistable exposes: `q` and its complement `qn`
 *  (`q_bar` alias, for authors who spell it out). */
const BISTABLE_OUT: Record<string, PinDef> = {
  q: OUT_HI,
  qn: OUT_LO,
  q_bar: OUT_LO,
};

/**
 * Terminal map per component type. A type absent from this table has no named
 * terminals: its edges keep the ordinary cardinal-face (or round-outline)
 * anchoring, and a `"node:pin"` reference to it falls back to the whole node.
 */
export const COMPONENT_PINS: Partial<Record<NodeType, Record<string, PinDef>>> =
  {
    resistor: TWO_TERMINAL,
    potentiometer: {
      a: WEST,
      b: EAST,
      // Wiper taps the top of the body.
      wiper: { x: 0.5, y: 0, nx: 0, ny: -1 },
      w: { x: 0.5, y: 0, nx: 0, ny: -1 },
    },
    capacitor: TWO_TERMINAL,
    polarized_capacitor: POLARIZED,
    inductor: TWO_TERMINAL,
    fuse: TWO_TERMINAL,
    diode: { a: WEST, b: EAST, anode: WEST, cathode: EAST },
    led: { a: WEST, b: EAST, anode: WEST, cathode: EAST },
    lamp: TWO_TERMINAL,
    motor: TWO_TERMINAL,
    buzzer: POLARIZED,
    ammeter: TWO_TERMINAL,
    voltmeter: TWO_TERMINAL,
    switch: TWO_TERMINAL,
    push_button: TWO_TERMINAL,
    battery: POLARIZED,
    dc_source: POLARIZED,
    ac_source: TWO_TERMINAL,
    current_source: POLARIZED,
    transformer: {
      p1: { x: 0, y: 0.2, nx: -1, ny: 0 },
      p2: { x: 0, y: 0.8, nx: -1, ny: 0 },
      s1: { x: 1, y: 0.2, nx: 1, ny: 0 },
      s2: { x: 1, y: 0.8, nx: 1, ny: 0 },
    },
    transistor_npn: {
      base: WEST,
      collector: { x: 1, y: 0.15, nx: 1, ny: 0 },
      emitter: { x: 1, y: 0.85, nx: 1, ny: 0 },
      b: WEST,
      c: { x: 1, y: 0.15, nx: 1, ny: 0 },
      e: { x: 1, y: 0.85, nx: 1, ny: 0 },
    },
    transistor_pnp: {
      base: WEST,
      collector: { x: 1, y: 0.15, nx: 1, ny: 0 },
      emitter: { x: 1, y: 0.85, nx: 1, ny: 0 },
      b: WEST,
      c: { x: 1, y: 0.15, nx: 1, ny: 0 },
      e: { x: 1, y: 0.85, nx: 1, ny: 0 },
    },
    opamp: {
      in_plus: { x: 0, y: 0.72, nx: -1, ny: 0 },
      in_minus: { x: 0, y: 0.28, nx: -1, ny: 0 },
      out: EAST,
      '+': { x: 0, y: 0.72, nx: -1, ny: 0 },
      '-': { x: 0, y: 0.28, nx: -1, ny: 0 },
    },
    // MOS transistors. Same terminal GEOMETRY as the bipolar pair above (gate
    // west, drain/source right) so a diagram mixing the two keeps one skeleton;
    // only the names differ. The bulk is deliberately absent: the symbol drawn
    // is the 3-terminal one, and a pin with no lead under it would anchor a wire
    // in mid-air.
    // The two channel terminals are SWAPPED between N and P, which is not a
    // typo: in every CMOS schematic the pull-up's SOURCE faces the supply and
    // the pull-down's DRAIN faces the output. Naming them by position instead
    // would force one of the two stacks to be wired bottom-to-top and route
    // back around itself.
    mosfet_n: {
      gate: WEST,
      drain: CH_HI,
      source: CH_LO,
      g: WEST,
      d: CH_HI,
      s: CH_LO,
    },
    mosfet_p: {
      gate: WEST,
      source: CH_HI,
      drain: CH_LO,
      g: WEST,
      s: CH_HI,
      d: CH_LO,
    },
    // CMOS pass gate: the signal crosses west→east, the two complementary
    // controls come in from above (`en`) and below (`enb`).
    transmission_gate: {
      a: WEST,
      in: WEST,
      b: EAST,
      out: EAST,
      en: NORTH,
      enb: { x: 0.5, y: 1, nx: 0, ny: 1 },
    },
    // Digital logic gates: two inputs on the left, one output on the right.
    and_gate: LOGIC_2IN,
    or_gate: LOGIC_2IN,
    nand_gate: LOGIC_2IN,
    nor_gate: LOGIC_2IN,
    xor_gate: LOGIC_2IN,
    xnor_gate: LOGIC_2IN,
    not_gate: LOGIC_1IN,
    buffer_gate: LOGIC_1IN,
    and3_gate: LOGIC_3IN,
    or3_gate: LOGIC_3IN,
    nand3_gate: LOGIC_3IN,
    nor3_gate: LOGIC_3IN,
    xor3_gate: LOGIC_3IN,
    // Fixed-pin functional blocks.
    d_flip_flop: { d: IN_HI, clk: IN_LO, ...BISTABLE_OUT },
    jk_flip_flop: {
      j: { x: 0, y: 0.22, nx: -1, ny: 0 },
      clk: IN_MID,
      k: { x: 0, y: 0.78, nx: -1, ny: 0 },
      ...BISTABLE_OUT,
    },
    t_flip_flop: { t: IN_HI, clk: IN_LO, ...BISTABLE_OUT },
    sr_latch: { s: IN_HI, r: IN_LO, ...BISTABLE_OUT },
    mux_2to1: {
      i0: IN_HI,
      i1: IN_LO,
      sel: SELECT,
      s: SELECT,
      y: EAST,
      out: EAST,
    },
    demux_1to2: {
      i: IN_MID,
      in: IN_MID,
      sel: SELECT,
      s: SELECT,
      y0: OUT_HI,
      y1: OUT_LO,
    },
    // Adders: sum on the upper output row, carry on the lower one — the same
    // convention in both, so the half adder reads as the full adder minus `cin`.
    half_adder: {
      a: IN_HI,
      b: IN_LO,
      s: OUT_HI,
      sum: OUT_HI,
      c: OUT_LO,
      cout: OUT_LO,
    },
    full_adder: {
      a: { x: 0, y: 0.22, nx: -1, ny: 0 },
      b: IN_MID,
      cin: { x: 0, y: 0.78, nx: -1, ny: 0 },
      s: OUT_HI,
      sum: OUT_HI,
      cout: OUT_LO,
    },
    // Single terminal at the top (the reference potential hangs below it).
    ground: { a: NORTH, t: NORTH },
    // Antenna is fed from the bottom (the mast rises above the feed point).
    antenna: {
      a: { x: 0.5, y: 1, nx: 0, ny: 1 },
      t: { x: 0.5, y: 1, nx: 0, ny: 1 },
    },
  };

/**
 * Whether `type` declares named terminals at all. A type that does NOT (a `signal`
 * I/O pad, a plain box) has a single terminal centred on the face it presents — so
 * callers must not read a missing {@link PinDef} as "unknown pin"; it is the absence
 * of a pin MAP that says "this is a face-anchored pad".
 */
export function hasPins(type: NodeType): boolean {
  return COMPONENT_PINS[type] !== undefined;
}

/** An INTERCHANGEABLE PAIR of input terminals, whose order is logically
 *  irrelevant (`a AND b === b AND a`, likewise NAND/OR/NOR/XOR/XNOR). The router
 *  may therefore swap which incoming wire takes the upper vs lower pin of the
 *  pair to avoid a wire crossing, with no change to the circuit. A gate NOT
 *  listed here (an op-amp's `+`/`-`, a transistor's terminals, a flip-flop's
 *  `j`/`k` — which are NOT interchangeable) keeps its author-given pins.
 *
 *  A three-input gate is commutative in all three arguments, but the router's
 *  swap works on PAIRS, so it is offered the outer two (`a`/`c`): that is the
 *  crossing worth removing — the top wire wanting the bottom pin — while `b`,
 *  already at mid-height, is where a straight approach lands anyway. */
const COMMUTATIVE_INPUT_PINS: Partial<Record<NodeType, [string, string]>> = {
  and_gate: ['a', 'b'],
  or_gate: ['a', 'b'],
  nand_gate: ['a', 'b'],
  nor_gate: ['a', 'b'],
  xor_gate: ['a', 'b'],
  xnor_gate: ['a', 'b'],
  and3_gate: ['a', 'c'],
  or3_gate: ['a', 'c'],
  nand3_gate: ['a', 'c'],
  nor3_gate: ['a', 'c'],
  xor3_gate: ['a', 'c'],
  // A half adder's two addends are symmetric; a full adder's `a`/`b` are too
  // (`cin` is not drawn on that row, so it is left out of the pair).
  half_adder: ['a', 'b'],
  full_adder: ['a', 'b'],
};

/**
 * Node types that DRIVE a digital net, so the wires leaving them can be tinted
 * per net (see `dom/netColors.ts`).
 *
 * An explicit set rather than a name test: `t.endsWith('_gate')` used to be the
 * rule, and it silently excluded every block added since (a flip-flop's `q` is
 * as much a net driver as a NAND's `y`) while wrongly including
 * `transmission_gate`, which PASSES a net rather than driving one. MOS
 * transistors are absent for the same reason a battery is: in a CMOS gate the
 * pull-up and pull-down networks share one output node, so colouring by source
 * node would paint one net in several colours.
 */
const LOGIC_DRIVER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'signal',
  'and_gate',
  'or_gate',
  'not_gate',
  'nand_gate',
  'nor_gate',
  'xor_gate',
  'xnor_gate',
  'buffer_gate',
  'and3_gate',
  'or3_gate',
  'nand3_gate',
  'nor3_gate',
  'xor3_gate',
  'd_flip_flop',
  'jk_flip_flop',
  't_flip_flop',
  'sr_latch',
  'mux_2to1',
  'demux_1to2',
  'half_adder',
  'full_adder',
]);

/** Whether `type` drives a digital net. See {@link LOGIC_DRIVER_TYPES}. */
export function isLogicDriver(type: NodeType): boolean {
  return LOGIC_DRIVER_TYPES.has(type);
}

/** The interchangeable input-pin pair of `type`, or `undefined` if its terminals
 *  are order-sensitive. See {@link COMMUTATIVE_INPUT_PINS}. */
export function commutativeInputPins(
  type: NodeType
): readonly [string, string] | undefined {
  return COMMUTATIVE_INPUT_PINS[type];
}

/** A parsed endpoint reference: the node id and, optionally, a terminal name. */
export interface EndpointRef {
  /** Bare node id (what geometry / layout are keyed by). */
  node: string;
  /** Terminal name after the first `:`, if any. */
  pin?: string;
}

/**
 * Splits a `"node:pin"` endpoint reference. The `:` is the reserved delimiter
 * (no existing node id uses one); everything before it is the node, everything
 * after is the terminal. A bare `"node"` yields `{ node }` with no pin. A
 * trailing/empty pin (`"node:"`) is treated as no pin.
 */
export function parseRef(ref: string): EndpointRef {
  const i = ref.indexOf(':');
  if (i < 0) return { node: ref };
  const pin = ref.slice(i + 1);
  return pin ? { node: ref.slice(0, i), pin } : { node: ref.slice(0, i) };
}

/** Bare node id of an endpoint reference (drops any `:pin`). */
export function refNode(ref: string): string {
  const i = ref.indexOf(':');
  return i < 0 ? ref : ref.slice(0, i);
}

/**
 * Resolves the {@link PinDef} a `"node:pin"` reference targets, given the node's
 * `type`. Returns `undefined` when the reference has no pin, the type has no
 * terminals, or the name is unknown — the caller then falls back to face/outline
 * anchoring.
 */
export function resolvePin(
  type: NodeType,
  pin: string | undefined
): PinDef | undefined {
  if (!pin) return undefined;
  return COMPONENT_PINS[type]?.[pin];
}
