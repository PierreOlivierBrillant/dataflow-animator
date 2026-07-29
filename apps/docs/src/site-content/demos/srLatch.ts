import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// An SR LATCH from two cross-coupled NAND gates — the simplest MEMORY element,
// and the natural next step after the combinational NAND circuits. Active-LOW
// inputs S̄ and R̄:
//   Q  = S̄ NAND Q̄        Q̄ = R̄ NAND Q
// The outputs feed back into each other (a cycle — hence coordinates), so the
// circuit REMEMBERS: with S̄ = R̄ = 1 it holds the last value. Each wire is
// coloured by the bit it carries (green = 1), and because it is stateful the
// values are given per step. S̄ = 0 sets Q = 1; R̄ = 0 resets Q = 0.
type Bit = 0 | 1;
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
const wire = (v: Bit) => (v ? HIGH : LOW_WIRE);

const strings = {
  en: {
    sbar: 'S̄',
    rbar: 'R̄',
    q: 'Q',
    qbar: 'Q̄',
    intro:
      'Cross-couple two NAND gates and you get a LATCH — one bit of memory. Active-low inputs: S̄ = 0 SETS Q to 1, R̄ = 0 RESETS Q to 0. The outputs feed back, so with S̄ = R̄ = 1 the latch HOLDS its value.',
    set: 'SET: S̄ = 0 forces Q = 1 (and Q̄ = 0). The 0 on S̄ pins the top NAND’s output high.',
    hold1:
      'HOLD: S̄ = R̄ = 1. Nothing drives a change — the feedback keeps Q = 1. This is the memory.',
    reset: 'RESET: R̄ = 0 forces Q̄ = 1, which pulls Q = 0.',
    hold0:
      'HOLD again: S̄ = R̄ = 1 keeps Q = 0. The same inputs remember EITHER value — that is storage.',
  },
  fr: {
    sbar: 'S̄',
    rbar: 'R̄',
    q: 'Q',
    qbar: 'Q̄',
    intro:
      'Deux portes NAND couplées en croix forment un VERROU — un bit de mémoire. Entrées actives à l’état bas : S̄ = 0 MET Q à 1, R̄ = 0 REMET Q à 0. Les sorties se rebouclent, donc avec S̄ = R̄ = 1 le verrou CONSERVE sa valeur.',
    set: 'MISE À 1 : S̄ = 0 force Q = 1 (et Q̄ = 0). Le 0 sur S̄ maintient la sortie de la NAND du haut à 1.',
    hold1:
      'MAINTIEN : S̄ = R̄ = 1. Rien ne provoque de changement — le rebouclage garde Q = 1. C’est la mémoire.',
    reset: 'REMISE À 0 : R̄ = 0 force Q̄ = 1, ce qui tire Q = 0.',
    hold0:
      'MAINTIEN à nouveau : S̄ = R̄ = 1 garde Q = 0. Les mêmes entrées mémorisent l’une OU l’autre valeur — c’est le stockage.',
  },
};

export const srLatch = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  // Stateful: the six net values are given per step (S̄, R̄ inputs; Q, Q̄ outputs
  // with the cross-feedback). Wire ids: wS (S̄→g1), wR (R̄→g2), wQ (g1→Q),
  // wQb (g2→Q̄), wFB1 (g1→g2, carries Q), wFB2 (g2→g1, carries Q̄).
  const step = (
    Sbar: Bit,
    Rbar: Bit,
    Q: Bit,
    Qbar: Bit,
    text: string,
    last = false
  ): Step => ({
    type: 'parallel',
    actions: [
      { type: 'set_icon', object: 'Sbar', icon: String(Sbar) },
      { type: 'set_color', object: 'Sbar', ...pad(Sbar) },
      { type: 'set_icon', object: 'Rbar', icon: String(Rbar) },
      { type: 'set_color', object: 'Rbar', ...pad(Rbar) },
      { type: 'set_icon', object: 'Q', icon: String(Q) },
      { type: 'set_color', object: 'Q', ...pad(Q) },
      { type: 'set_icon', object: 'Qbar', icon: String(Qbar) },
      { type: 'set_color', object: 'Qbar', ...pad(Qbar) },
      { type: 'set_color', object: 'wS', color: wire(Sbar) },
      { type: 'set_color', object: 'wR', color: wire(Rbar) },
      { type: 'set_color', object: 'wQ', color: wire(Q) },
      { type: 'set_color', object: 'wQb', color: wire(Qbar) },
      { type: 'set_color', object: 'wFB1', color: wire(Q) },
      { type: 'set_color', object: 'wFB2', color: wire(Qbar) },
      {
        type: 'comment',
        text,
        ...(last ? { keep_until_end: true } : { keep_until_next: true }),
      },
    ],
  });
  return {
    direction: 'circuit',
    // 45° wires: the same-row inputs/outputs stay straight, while the two
    // cross-coupling feedback wires become clean diagonals.
    diagonal_wires: true,
    nodes: [
      { id: 'Sbar', type: 'signal', x: 0.1, y: 0.28, text: s.sbar, icon: '1' },
      { id: 'Rbar', type: 'signal', x: 0.1, y: 0.72, text: s.rbar, icon: '1' },
      { id: 'g1', type: 'nand_gate', x: 0.44, y: 0.28, text: 'NAND' },
      { id: 'g2', type: 'nand_gate', x: 0.44, y: 0.72, text: 'NAND' },
      { id: 'Q', type: 'signal', x: 0.82, y: 0.28, text: s.q, icon: '0' },
      { id: 'Qbar', type: 'signal', x: 0.82, y: 0.72, text: s.qbar, icon: '0' },
    ],
    connections: [
      { id: 'wS', from: 'Sbar', to: 'g1:a', color: LOW_WIRE },
      { id: 'wR', from: 'Rbar', to: 'g2:b', color: LOW_WIRE },
      // Cross-coupling: g1 output (Q) → g2 input; g2 output (Q̄) → g1 input.
      { id: 'wFB1', from: 'g1:y', to: 'g2:a', color: LOW_WIRE },
      { id: 'wFB2', from: 'g2:y', to: 'g1:b', color: LOW_WIRE },
      { id: 'wQ', from: 'g1:y', to: 'Q', color: LOW_WIRE },
      { id: 'wQb', from: 'g2:y', to: 'Qbar', color: LOW_WIRE },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 5000 },
      step(0, 1, 1, 0, s.set),
      step(1, 1, 1, 0, s.hold1),
      step(1, 0, 0, 1, s.reset),
      step(1, 1, 0, 1, s.hold0, true),
      { type: 'wait', duration: 2500 },
    ],
  };
};
