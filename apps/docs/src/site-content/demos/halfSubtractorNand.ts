import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';
import { buildNandCircuit } from './nandCircuitBuilder';

// A HALF-SUBTRACTOR built ONLY from NAND gates. It computes A − B on two bits:
//   Diff   = A XOR B                     (the same four-NAND XOR as the adder)
//   Borrow = (NOT A) AND B               (1 only when 0 − 1 needs to borrow)
// Five NAND gates, sharing the XOR's first NAND, mirror the NAND half-adder — the
// only change is the last gate: NAND(n3, n3) instead of NAND(n1, n1), since n3
// already carries (A'·B)'. Wires are coloured by the bit they carry (green = 1).

const strings = {
  en: {
    a: 'A',
    b: 'B',
    diff: 'Diff',
    borrow: 'Borrow',
    intro:
      'A half-subtractor computes A − B from NAND gates only. Diff is A XOR B; Borrow is 1 only when we take 1 from 0. Green wires carry a 1 — trace the borrow.',
    s00: '0 − 0 → Diff 0, Borrow 0. Nothing to take away.',
    s01: '0 − 1 → we must borrow: Diff 1, Borrow 1.',
    s10: '1 − 0 → Diff 1, Borrow 0. A clean subtraction.',
    s11: '1 − 1 → Diff 0, Borrow 0. Equal bits cancel.',
  },
  fr: {
    a: 'A',
    b: 'B',
    diff: 'Diff',
    borrow: 'Emprunt',
    intro:
      'Un demi-soustracteur calcule A − B, uniquement en NAND. La différence est A XOR B ; l’emprunt vaut 1 seulement quand on retire 1 de 0. Les fils verts portent un 1 — tracez l’emprunt.',
    s00: '0 − 0 → Diff 0, Emprunt 0. Rien à retirer.',
    s01: '0 − 1 → il faut emprunter : Diff 1, Emprunt 1.',
    s10: '1 − 0 → Diff 1, Emprunt 0. Une soustraction nette.',
    s11: '1 − 1 → Diff 0, Emprunt 0. Des bits égaux s’annulent.',
  },
};

export const halfSubtractorNand = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const { nodes, connections, step } = buildNandCircuit(
    [
      { id: 'A', label: s.a },
      { id: 'B', label: s.b },
    ],
    [
      { id: 'n1', a: 'A', b: 'B' },
      { id: 'n2', a: 'A', b: 'n1' },
      { id: 'n3', a: 'n1', b: 'B' },
      { id: 'nDiff', a: 'n2', b: 'n3' },
      { id: 'nBorrow', a: 'n3', b: 'n3' },
    ],
    [
      { id: 'diffOut', from: 'nDiff', label: s.diff },
      { id: 'borrowOut', from: 'nBorrow', label: s.borrow },
    ]
  );
  return {
    direction: 'circuit',
    nodes,
    connections,
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4500 },
      step({ A: 0, B: 0 }, s.s00),
      step({ A: 0, B: 1 }, s.s01),
      step({ A: 1, B: 0 }, s.s10),
      step({ A: 1, B: 1 }, s.s11, { last: true }),
      { type: 'wait', duration: 2500 },
    ],
  };
};
