import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';
import { buildNandCircuit } from './nandCircuitBuilder';

// A FULL ADDER built ONLY from NAND gates — nine of them. It adds three bits,
// A + B + Cin, into a Sum and a carry-out Cout, and is the cell that tiles to
// build any ripple-carry adder. Two chained four-NAND XORs give the Sum; the
// carry reuses their internal terms (x1 and x5). Wires are coloured by the bit
// they carry (green = 1) so the carry chain is easy to follow.

const strings = {
  en: {
    a: 'A',
    b: 'B',
    cin: '$C_{in}$',
    sum: 'Sum',
    cout: '$C_{out}$',
    intro:
      'A full adder sums three bits — A, B and a carry-in — into a Sum and a carry-out. Nine NAND gates; green wires carry a 1, so you can follow the carry through the network.',
    s000: '0 + 0 + 0 = 0. Sum 0, Cout 0.',
    s001: '0 + 0 + 1 = 1. The carry-in alone flips the Sum to 1; Cout 0.',
    s011: '0 + 1 + 1 = 10₂. Two ones make a carry: Sum 0, Cout 1.',
    s101: '1 + 0 + 1 = 10₂. Same from A and Cin: Sum 0, Cout 1.',
    s111: '1 + 1 + 1 = 11₂. All three high: Sum 1 AND Cout 1 — binary three.',
  },
  fr: {
    a: 'A',
    b: 'B',
    cin: '$C_{in}$',
    sum: 'Somme',
    cout: '$C_{out}$',
    intro:
      'Un additionneur complet somme trois bits — A, B et une retenue entrante — en une Somme et une retenue sortante. Neuf portes NAND ; les fils verts portent un 1, pour suivre la retenue à travers le réseau.',
    s000: '0 + 0 + 0 = 0. Somme 0, Cout 0.',
    s001: '0 + 0 + 1 = 1. La retenue entrante seule bascule la Somme à 1 ; Cout 0.',
    s011: '0 + 1 + 1 = 10₂. Deux uns font une retenue : Somme 0, Cout 1.',
    s101: '1 + 0 + 1 = 10₂. Idem depuis A et Cin : Somme 0, Cout 1.',
    s111: '1 + 1 + 1 = 11₂. Les trois à 1 : Somme 1 ET Cout 1 — trois en binaire.',
  },
};

export const fullAdderNand = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const { nodes, connections, step } = buildNandCircuit(
    [
      { id: 'A', label: s.a },
      { id: 'B', label: s.b },
      { id: 'Cin', label: s.cin },
    ],
    [
      { id: 'x1', a: 'A', b: 'B' },
      { id: 'x2', a: 'A', b: 'x1' },
      { id: 'x3', a: 'x1', b: 'B' },
      { id: 'ab', a: 'x2', b: 'x3' }, // A XOR B
      { id: 'x5', a: 'ab', b: 'Cin' },
      { id: 'x6', a: 'ab', b: 'x5' },
      { id: 'x7', a: 'x5', b: 'Cin' },
      { id: 'nSum', a: 'x6', b: 'x7' }, // (A XOR B) XOR Cin
      { id: 'nCout', a: 'x5', b: 'x1' }, // A·B + Cin·(A XOR B)
    ],
    [
      { id: 'sumOut', from: 'nSum', label: s.sum },
      { id: 'coutOut', from: 'nCout', label: s.cout },
    ]
  );
  return {
    direction: 'circuit',
    nodes,
    connections,
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 5000 },
      step({ A: 0, B: 0, Cin: 0 }, s.s000),
      step({ A: 0, B: 0, Cin: 1 }, s.s001),
      step({ A: 0, B: 1, Cin: 1 }, s.s011),
      step({ A: 1, B: 0, Cin: 1 }, s.s101),
      step({ A: 1, B: 1, Cin: 1 }, s.s111, { last: true }),
      { type: 'wait', duration: 2500 },
    ],
  };
};
