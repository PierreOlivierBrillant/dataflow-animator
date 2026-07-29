import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A reference of ALL EIGHT logic gates on `direction: 'circuit'`. Each gate is a
// self-contained cell (input pads → gate → output pad) with NO coordinates, so
// the engine tiles the disconnected cells in a grid. The timeline steps through
// the FOUR input combinations (00, 01, 10, 11): at each step every gate's output
// updates and each wire is coloured by the bit it carries (green = 1), so the
// full truth table of every gate builds up side by side. Gate names and the 0/1
// values are language-invariant; only the narration is translated.
type Bit = 0 | 1;
type Node = DataFlowSpec['nodes'][number];
type Connection = NonNullable<DataFlowSpec['connections']>[number];
type Step = DataFlowSpec['timeline'][number];

const HIGH = '#16a34a';
const LOW_WIRE = '#9aa4b2';
const LOW_PAD = '#e5e7eb';
const INK_HI = 'white';
const INK_LO = '#334155';
const pad = (v: Bit) =>
  v === 1
    ? { background_color: HIGH, text_color: INK_HI }
    : { background_color: LOW_PAD, text_color: INK_LO };

interface Gate {
  id: string;
  type: Node['type'];
  name: string;
  inputs: 1 | 2;
  f: (a: Bit, b: Bit) => Bit;
}

// All 8 gate types (two of them single-input: NOT and the buffer).
const GATES: Gate[] = [
  {
    id: 'and',
    type: 'and_gate',
    name: 'AND',
    inputs: 2,
    f: (a, b) => (a && b ? 1 : 0),
  },
  {
    id: 'or',
    type: 'or_gate',
    name: 'OR',
    inputs: 2,
    f: (a, b) => (a || b ? 1 : 0),
  },
  {
    id: 'xor',
    type: 'xor_gate',
    name: 'XOR',
    inputs: 2,
    f: (a, b) => (a !== b ? 1 : 0),
  },
  {
    id: 'xnor',
    type: 'xnor_gate',
    name: 'XNOR',
    inputs: 2,
    f: (a, b) => (a === b ? 1 : 0),
  },
  {
    id: 'nand',
    type: 'nand_gate',
    name: 'NAND',
    inputs: 2,
    f: (a, b) => (a && b ? 0 : 1),
  },
  {
    id: 'nor',
    type: 'nor_gate',
    name: 'NOR',
    inputs: 2,
    f: (a, b) => (a || b ? 0 : 1),
  },
  {
    id: 'not',
    type: 'not_gate',
    name: 'NOT',
    inputs: 1,
    f: (a) => (a ? 0 : 1),
  },
  { id: 'buf', type: 'buffer_gate', name: 'BUF', inputs: 1, f: (a) => a },
];

const strings = {
  en: {
    intro:
      'The eight logic gates, side by side. Each turns its input bits into one output bit — the rule is what differs. We step through all four input combinations; watch the output pads and the green (= 1) wires build each gate’s truth table.',
    s00: 'a = 0, b = 0. Outputs 1 come only from the inverting gates: XNOR, NAND, NOR and NOT (NOT sees a = 0).',
    s01: 'a = 0, b = 1. The inputs DIFFER → XOR and OR go high; AND, XNOR, NOR go low. NOT/BUF follow a = 0.',
    s10: 'a = 1, b = 0. Still differ → same pattern for the 2-input gates; but NOT a = 0 and BUF a = 1 now.',
    s11: 'a = 1, b = 1. Both high → AND, OR, XOR… AND & OR are 1, XOR is 0, XNOR 1, NAND & NOR 0. NOT 0, BUF 1.',
  },
  fr: {
    intro:
      'Les huit portes logiques, côte à côte. Chacune transforme ses bits d’entrée en un bit de sortie — c’est la règle qui change. On parcourt les quatre combinaisons d’entrée ; observez les pads de sortie et les fils verts (= 1) construire la table de vérité de chaque porte.',
    s00: 'a = 0, b = 0. Les sorties à 1 viennent des portes inverseuses : XNOR, NAND, NOR et NOT (NOT voit a = 0).',
    s01: 'a = 0, b = 1. Les entrées DIFFÈRENT → XOR et OR passent à 1 ; AND, XNOR, NOR à 0. NOT/BUF suivent a = 0.',
    s10: 'a = 1, b = 0. Toujours différentes → même motif pour les portes à 2 entrées ; mais NOT a = 0 et BUF a = 1.',
    s11: 'a = 1, b = 1. Les deux à 1 → AND et OR à 1, XOR à 0, XNOR 1, NAND et NOR 0. NOT 0, BUF 1.',
  },
};

export const logicGates = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const nodes: Node[] = GATES.flatMap((g) => [
    { id: `${g.id}A`, type: 'signal' },
    ...(g.inputs === 2 ? [{ id: `${g.id}B`, type: 'signal' as const }] : []),
    { id: g.id, type: g.type, text: g.name },
    { id: `${g.id}Y`, type: 'signal' },
  ]);
  const connections: Connection[] = GATES.flatMap((g) => [
    { id: `${g.id}wa`, from: `${g.id}A`, to: `${g.id}:a`, color: LOW_WIRE },
    ...(g.inputs === 2
      ? [
          {
            id: `${g.id}wb`,
            from: `${g.id}B`,
            to: `${g.id}:b`,
            color: LOW_WIRE,
          },
        ]
      : []),
    { id: `${g.id}wy`, from: `${g.id}:y`, to: `${g.id}Y`, color: LOW_WIRE },
  ]);

  const step = (a: Bit, b: Bit, text: string, last = false): Step => {
    const actions: NonNullable<Extract<Step, { type: 'parallel' }>['actions']> =
      [];
    for (const g of GATES) {
      actions.push({ type: 'set_icon', object: `${g.id}A`, icon: String(a) });
      actions.push({ type: 'set_color', object: `${g.id}A`, ...pad(a) });
      actions.push({
        type: 'set_color',
        object: `${g.id}wa`,
        color: a ? HIGH : LOW_WIRE,
      });
      if (g.inputs === 2) {
        actions.push({ type: 'set_icon', object: `${g.id}B`, icon: String(b) });
        actions.push({ type: 'set_color', object: `${g.id}B`, ...pad(b) });
        actions.push({
          type: 'set_color',
          object: `${g.id}wb`,
          color: b ? HIGH : LOW_WIRE,
        });
      }
      const out = g.f(a, b);
      actions.push({ type: 'set_icon', object: `${g.id}Y`, icon: String(out) });
      actions.push({ type: 'set_color', object: `${g.id}Y`, ...pad(out) });
      actions.push({
        type: 'set_color',
        object: `${g.id}wy`,
        color: out ? HIGH : LOW_WIRE,
      });
    }
    actions.push({
      type: 'comment',
      text,
      ...(last ? { keep_until_end: true } : { keep_until_next: true }),
    });
    return { type: 'parallel', actions };
  };

  return {
    direction: 'circuit',
    nodes,
    connections,
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4500 },
      step(0, 0, s.s00),
      step(0, 1, s.s01),
      step(1, 0, s.s10),
      step(1, 1, s.s11, true),
      { type: 'wait', duration: 2500 },
    ],
  };
};
