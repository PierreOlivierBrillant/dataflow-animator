import type { DataFlowSpec } from '@dataflow-animator/react';

// Shared builder for the "everything from NAND" family (half/full adder &
// subtractor). From a netlist it builds the nodes, the id'd wires, and a
// timeline `step` that — crucially for teaching — SIMULATES the circuit and
// colours EVERY wire by the bit it carries (green = 1, grey = 0) while lighting
// the I/O pads. Students can thus trace the signal propagating through the NAND
// gates, not just read the inputs and outputs of a black box.

type Bit = 0 | 1;
type Node = DataFlowSpec['nodes'][number];
type Connection = NonNullable<DataFlowSpec['connections']>[number];
type Step = DataFlowSpec['timeline'][number];

const HIGH = '#16a34a'; // logic 1 (lit)
const LOW_WIRE = '#9aa4b2'; // logic 0 (de-emphasised wire)
const LOW_PAD = '#e5e7eb';
const INK_HI = 'white';
const INK_LO = '#334155';

const nand = (a: Bit, b: Bit): Bit => (a && b ? 0 : 1);

const padColor = (v: Bit) =>
  v === 1
    ? { background_color: HIGH, text_color: INK_HI }
    : { background_color: LOW_PAD, text_color: INK_LO };

/** A labelled 1-bit input. */
export interface NandInput {
  id: string;
  label: string;
}
/** A NAND gate; `a`/`b` reference an input id or a prior gate id (self-tie for an
 *  inverter, e.g. `{ a: 'n1', b: 'n1' }`). Gates MUST be in evaluation order. */
export interface NandGate {
  id: string;
  a: string;
  b: string;
}
/** An output pad driven by a gate. */
export interface NandOutput {
  id: string;
  from: string;
  label: string;
}

export interface NandCircuit {
  nodes: Node[];
  connections: Connection[];
  /** One timeline step: sets the inputs, simulates, colours every wire by its
   *  bit and lights the output pads, with a narration `text`. */
  step: (
    bits: Record<string, Bit>,
    text: string,
    opts?: { last?: boolean }
  ) => Step;
}

export function buildNandCircuit(
  inputs: NandInput[],
  gates: NandGate[],
  outputs: NandOutput[]
): NandCircuit {
  const gateIds = new Set(gates.map((g) => g.id));
  // Wire source ref: an input drives its own pad, a gate drives its `:y` output.
  const srcRef = (name: string): string =>
    gateIds.has(name) ? `${name}:y` : name;

  const nodes: Node[] = [
    ...inputs.map((i): Node => ({ id: i.id, type: 'signal', text: i.label })),
    ...gates.map((g): Node => ({ id: g.id, type: 'nand_gate', text: 'NAND' })),
    ...outputs.map((o): Node => ({ id: o.id, type: 'signal', text: o.label })),
  ];

  // Wires carry an id (for set_color) and remember the NODE that drives them, so
  // a step can look up the bit on that net.
  const connections: Connection[] = [];
  const wireDriver: { id: string; driver: string }[] = [];
  let wi = 0;
  const addWire = (from: string, to: string, driver: string): void => {
    const id = `w${wi++}`;
    // Start grey (all-zero rest state); a step cross-fades it to its bit colour.
    connections.push({ id, from, to, color: LOW_WIRE });
    wireDriver.push({ id, driver });
  };
  for (const g of gates) {
    addWire(srcRef(g.a), `${g.id}:a`, g.a);
    addWire(srcRef(g.b), `${g.id}:b`, g.b);
  }
  for (const o of outputs) addWire(`${o.from}:y`, o.id, o.from);

  const evaluate = (bits: Record<string, Bit>): Record<string, Bit> => {
    const env: Record<string, Bit> = { ...bits };
    for (const g of gates) env[g.id] = nand(env[g.a], env[g.b]);
    return env;
  };

  const step = (
    bits: Record<string, Bit>,
    text: string,
    opts?: { last?: boolean }
  ): Step => {
    const env = evaluate(bits);
    const actions: NonNullable<Extract<Step, { type: 'parallel' }>['actions']> =
      [];
    for (const i of inputs) {
      const v = bits[i.id];
      actions.push({ type: 'set_icon', object: i.id, icon: String(v) });
      actions.push({ type: 'set_color', object: i.id, ...padColor(v) });
    }
    for (const o of outputs) {
      const v = env[o.from];
      actions.push({ type: 'set_icon', object: o.id, icon: String(v) });
      actions.push({ type: 'set_color', object: o.id, ...padColor(v) });
    }
    for (const w of wireDriver)
      actions.push({
        type: 'set_color',
        object: w.id,
        color: env[w.driver] ? HIGH : LOW_WIRE,
      });
    actions.push({
      type: 'comment',
      text,
      ...(opts?.last ? { keep_until_end: true } : { keep_until_next: true }),
    });
    return { type: 'parallel', actions };
  };

  return { nodes, connections, step };
}
