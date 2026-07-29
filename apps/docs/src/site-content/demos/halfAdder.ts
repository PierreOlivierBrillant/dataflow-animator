import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A HALF-ADDER: the classic first digital-logic circuit, and a small "complex
// engineering diagram". Two 1-bit inputs A and B fan out to two gates:
//   • Sum   = A XOR B
//   • Carry = A AND B
// Together they compute A + B in binary (1 + 1 = 10₂ → Sum 0, Carry 1). The
// timeline steps through all four input combinations, lighting HIGH signals
// green so you can watch the truth table build up. Bit values are
// language-invariant; only the narration is translated.
const HIGH = '#16a34a';
const LOW = '#e5e7eb';
const INK_HI = 'white';
const INK_LO = '#334155';

const bit = (v: number) =>
  v === 1
    ? { background_color: HIGH, text_color: INK_HI }
    : { background_color: LOW, text_color: INK_LO };

const strings = {
  en: {
    a: 'A',
    b: 'B',
    sum: 'Sum',
    carry: 'Carry',
    intro:
      'A half-adder adds two bits. A and B fan out to two gates: XOR gives the Sum, AND gives the Carry. Watch every input combination.',
    s00: '0 + 0: XOR → Sum 0, AND → Carry 0. Result 00.',
    s01: '0 + 1: the inputs differ, so XOR → Sum 1; AND → Carry 0. Result 01.',
    s10: '1 + 0: same idea → Sum 1, Carry 0. Result 01.',
    s11: '1 + 1: inputs are equal, so XOR → Sum 0; but AND → Carry 1. Result 10 — binary two.',
  },
  fr: {
    a: 'A',
    b: 'B',
    sum: 'Somme',
    carry: 'Retenue',
    intro:
      'Un demi-additionneur additionne deux bits. A et B se répartissent vers deux portes : XOR donne la Somme, AND donne la Retenue. Observons chaque combinaison.',
    s00: '0 + 0 : XOR → Somme 0, AND → Retenue 0. Résultat 00.',
    s01: '0 + 1 : les entrées diffèrent, donc XOR → Somme 1 ; AND → Retenue 0. Résultat 01.',
    s10: '1 + 0 : même idée → Somme 1, Retenue 0. Résultat 01.',
    s11: '1 + 1 : entrées égales, donc XOR → Somme 0 ; mais AND → Retenue 1. Résultat 10 — deux en binaire.',
  },
};

export const halfAdder = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const step = (
    a: number,
    b: number,
    sum: number,
    carry: number,
    text: string,
    last = false
  ): DataFlowSpec['timeline'][number] => ({
    type: 'parallel',
    actions: [
      { type: 'set_icon', object: 'A', icon: String(a) },
      { type: 'set_icon', object: 'B', icon: String(b) },
      { type: 'set_color', object: 'A', ...bit(a) },
      { type: 'set_color', object: 'B', ...bit(b) },
      { type: 'set_icon', object: 'sumOut', icon: String(sum) },
      { type: 'set_icon', object: 'carryOut', icon: String(carry) },
      { type: 'set_color', object: 'sumOut', ...bit(sum) },
      { type: 'set_color', object: 'carryOut', ...bit(carry) },
      {
        type: 'comment',
        text,
        ...(last ? { keep_until_end: true } : { keep_until_next: true }),
      },
    ],
  });
  return {
    direction: 'circuit',
    diagonal_wires: true,
    // No coordinates: this is a connected feed-forward network, so the engine
    // auto-arranges it left-to-right (inputs → gates → outputs) in layers.
    nodes: [
      { id: 'A', type: 'signal', text: s.a },
      { id: 'B', type: 'signal', text: s.b },
      { id: 'xor', type: 'xor_gate', text: 'XOR' },
      { id: 'and', type: 'and_gate', text: 'AND' },
      { id: 'sumOut', type: 'signal', text: s.sum },
      { id: 'carryOut', type: 'signal', text: s.carry },
    ],
    connections: [
      // A and B each fan out to both gates.
      { from: 'A', to: 'xor:a' },
      { from: 'A', to: 'and:a' },
      { from: 'B', to: 'xor:b' },
      { from: 'B', to: 'and:b' },
      // Gate outputs.
      { from: 'xor:y', to: 'sumOut' },
      { from: 'and:y', to: 'carryOut' },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4000 },
      step(0, 0, 0, 0, s.s00),
      step(0, 1, 1, 0, s.s01),
      step(1, 0, 1, 0, s.s10),
      step(1, 1, 0, 1, s.s11, true),
      { type: 'wait', duration: 2500 },
    ],
  };
};
