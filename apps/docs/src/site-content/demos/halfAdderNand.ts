import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';
import { buildNandCircuit } from './nandCircuitBuilder';

// A HALF-ADDER built ONLY from NAND gates — the "universal gate" idea: NAND alone
// can realise any Boolean function. Five NAND gates reproduce the XOR (Sum) and
// AND (Carry) of the classic half-adder:
//   n1 = A NAND B                       (shared term, also ¬Carry)
//   n2 = A NAND n1,  n3 = n1 NAND B
//   Sum   = n2 NAND n3                   (= A XOR B, the 4-NAND XOR)
//   Carry = n1 NAND n1                   (= ¬n1 = A AND B)
// Every wire is coloured by the bit it carries (green = 1), so you can trace the
// signal through the gates. Bit values are language-invariant.

const strings = {
  en: {
    a: 'A',
    b: 'B',
    sum: 'Sum',
    carry: 'Carry',
    intro:
      'The same half-adder, but built ONLY from NAND gates. Watch the wires: green carries a 1, grey a 0 — trace how five NANDs reproduce the XOR (Sum) and AND (Carry).',
    s00: '0 + 0 → every NAND resolves to Sum 0, Carry 0.',
    s01: '0 + 1 → the four-NAND XOR gives Sum 1; the AND term gives Carry 0. Result 01.',
    s10: '1 + 0 → symmetric to the previous case: Sum 1, Carry 0. Result 01.',
    s11: '1 + 1 → XOR gives Sum 0, but the shared NAND term makes Carry 1. Result 10.',
  },
  fr: {
    a: 'A',
    b: 'B',
    sum: 'Somme',
    carry: 'Retenue',
    intro:
      'Le même demi-additionneur, mais uniquement en portes NAND. Observez les fils : le vert transporte un 1, le gris un 0 — tracez comment cinq NAND reproduisent le XOR (Somme) et le AND (Retenue).',
    s00: '0 + 0 → toutes les NAND ramènent à Somme 0, Retenue 0.',
    s01: '0 + 1 → le XOR à quatre NAND donne Somme 1 ; le terme AND donne Retenue 0. Résultat 01.',
    s10: '1 + 0 → symétrique du cas précédent : Somme 1, Retenue 0. Résultat 01.',
    s11: '1 + 1 → le XOR donne Somme 0, mais le terme NAND partagé rend Retenue 1. Résultat 10.',
  },
};

export const halfAdderNand = (locale: Locale): DataFlowSpec => {
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
      { id: 'nSum', a: 'n2', b: 'n3' },
      { id: 'nCarry', a: 'n1', b: 'n1' },
    ],
    [
      { id: 'sumOut', from: 'nSum', label: s.sum },
      { id: 'carryOut', from: 'nCarry', label: s.carry },
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
