import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';
import { buildNandCircuit } from './nandCircuitBuilder';

// A FULL SUBTRACTOR built ONLY from NAND gates — nine of them (the minimal
// count). It computes A − B − Bin on three bits, into a Diff and a borrow-out
// Bout. The Diff is the same double-XOR as the full adder; the borrow reuses two
// signals the XOR network already produces — x3 = (A'·B)' and x7 = ((A XOR B)'·Bin)':
//   Bout = x3 NAND x7 = A'·B + Bin·(A XOR B)'
// so no extra inverter is needed. Wires are coloured by the bit they carry
// (green = 1) — trace the two borrow sources combining.

const strings = {
  en: {
    a: 'A',
    b: 'B',
    bin: '$B_{in}$',
    diff: 'Diff',
    bout: '$B_{out}$',
    intro:
      'A full subtractor computes A − B − Bin over three bits, into a Diff and a borrow-out. Nine NAND gates; green wires carry a 1 — trace where the borrow comes from.',
    s000: '0 − 0 − 0 = 0. Diff 0, Bout 0.',
    s001: '0 − 0 − 1 → we borrow: Diff 1, Bout 1.',
    s010: '0 − 1 − 0 → we borrow: Diff 1, Bout 1.',
    s100: '1 − 0 − 0 = 1. Diff 1, Bout 0. A clean subtraction.',
    s111: '1 − 1 − 1 → borrow again: Diff 1, Bout 1.',
  },
  fr: {
    a: 'A',
    b: 'B',
    bin: '$B_{in}$',
    diff: 'Diff',
    bout: '$B_{out}$',
    intro:
      'Un soustracteur complet calcule A − B − Bin sur trois bits, en une différence et un emprunt sortant. Neuf portes NAND ; les fils verts portent un 1 — tracez d’où vient l’emprunt.',
    s000: '0 − 0 − 0 = 0. Diff 0, Bout 0.',
    s001: '0 − 0 − 1 → on emprunte : Diff 1, Bout 1.',
    s010: '0 − 1 − 0 → on emprunte : Diff 1, Bout 1.',
    s100: '1 − 0 − 0 = 1. Diff 1, Bout 0. Une soustraction nette.',
    s111: '1 − 1 − 1 → on emprunte encore : Diff 1, Bout 1.',
  },
};

export const fullSubtractorNand = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const { nodes, connections, step } = buildNandCircuit(
    [
      { id: 'A', label: s.a },
      { id: 'B', label: s.b },
      { id: 'Bin', label: s.bin },
    ],
    [
      { id: 'x1', a: 'A', b: 'B' },
      { id: 'x2', a: 'A', b: 'x1' },
      { id: 'x3', a: 'x1', b: 'B' }, // (A'·B)'
      { id: 'ab', a: 'x2', b: 'x3' }, // A XOR B
      { id: 'x5', a: 'ab', b: 'Bin' },
      { id: 'x6', a: 'ab', b: 'x5' },
      { id: 'x7', a: 'x5', b: 'Bin' }, // ((A XOR B)'·Bin)'
      { id: 'nDiff', a: 'x6', b: 'x7' }, // (A XOR B) XOR Bin = Diff
      // Borrow reuses x3 = (A'·B)' and x7 = ((A XOR B)'·Bin)' — no extra inverter.
      { id: 'nBout', a: 'x3', b: 'x7' }, // A'·B + Bin·(A XOR B)'
    ],
    [
      { id: 'diffOut', from: 'nDiff', label: s.diff },
      { id: 'boutOut', from: 'nBout', label: s.bout },
    ]
  );
  return {
    direction: 'circuit',
    nodes,
    connections,
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 5000 },
      step({ A: 0, B: 0, Bin: 0 }, s.s000),
      step({ A: 0, B: 0, Bin: 1 }, s.s001),
      step({ A: 0, B: 1, Bin: 0 }, s.s010),
      step({ A: 1, B: 0, Bin: 0 }, s.s100),
      step({ A: 1, B: 1, Bin: 1 }, s.s111, { last: true }),
      { type: 'wait', duration: 2500 },
    ],
  };
};
