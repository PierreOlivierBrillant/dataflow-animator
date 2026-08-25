import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A NAND gate ONE LEVEL DOWN: not the ⌐D symbol, but the four MOS transistors
// inside it. The rest of the gallery builds every arithmetic circuit out of
// NAND gates; this demo is the floor under that family — where the NAND itself
// comes from.
//
// The structure is the CMOS rule, and it is worth reading off the picture:
//   * pull-up (pMOS, on top)   — the two in PARALLEL, so ONE of them conducting
//     is enough to tie the output to VDD. A pMOS conducts when its gate is LOW.
//   * pull-down (nMOS, below)  — the two in SERIES, so BOTH must conduct to tie
//     the output to ground. An nMOS conducts when its gate is HIGH.
// Hence: output = 0 only when A = B = 1. That is NAND, and the two networks are
// exact complements — never both on, so the gate never burns static power.
//
// Each step lights the transistors that CONDUCT and colours every wire by the
// level it carries, so the path from a supply rail to the output is visible.
type Bit = 0 | 1;
type Step = DataFlowSpec['timeline'][number];

const HIGH = '#16a34a'; // logic 1 / conducting
const LOW_WIRE = '#9aa4b2'; // logic 0
const OFF = '#cbd5e1'; // blocked transistor, or a node nothing is driving
const LOW_PAD = '#e5e7eb';
const INK_HI = 'white';
const INK_LO = '#334155';

const pad = (v: Bit) =>
  v === 1
    ? { background_color: HIGH, text_color: INK_HI }
    : { background_color: LOW_PAD, text_color: INK_LO };

const strings = {
  en: {
    a: 'A',
    b: 'B',
    y: 'Y',
    vdd: 'VDD',
    intro:
      'Inside a NAND gate: four MOS transistors. Two pMOS in PARALLEL on top — a pMOS conducts on a LOW gate. Two nMOS in SERIES below — an nMOS conducts on a HIGH one.',
    s00: 'A = 0, B = 0. Both pMOS conduct, so the output is tied to VDD through TWO paths. The series nMOS chain is broken twice over. Y = 1.',
    s01: 'A = 0, B = 1. P2 blocks and N2 conducts — but P1 still ties the output to VDD, and N1 still breaks the chain to ground. One path is enough: Y = 1.',
    s10: 'A = 1, B = 0. The mirror image: P1 blocks, N1 conducts, and P2 alone holds the output high. Y = 1.',
    s11: 'A = 1, B = 1. NOW both pMOS block and both nMOS conduct: the only complete path runs to GROUND. Y = 0 — the single zero of the NAND truth table.',
    outro:
      'Exactly one network conducts at a time — which is why CMOS draws almost no power while it holds a value.',
  },
  fr: {
    a: 'A',
    b: 'B',
    y: 'Y',
    vdd: 'VDD',
    intro:
      'À l’intérieur d’une porte NAND : quatre transistors MOS. Deux pMOS en PARALLÈLE au-dessus — un pMOS conduit sur une grille BASSE. Deux nMOS en SÉRIE au-dessous — un nMOS conduit sur une grille HAUTE.',
    s00: 'A = 0, B = 0. Les deux pMOS conduisent : la sortie est reliée à VDD par DEUX chemins. La chaîne série des nMOS est coupée deux fois. Y = 1.',
    s01: 'A = 0, B = 1. P2 bloque et N2 conduit — mais P1 relie toujours la sortie à VDD, et N1 coupe toujours le chemin vers la masse. Un seul chemin suffit : Y = 1.',
    s10: 'A = 1, B = 0. L’image miroir : P1 bloque, N1 conduit, et P2 maintient seul la sortie à l’état haut. Y = 1.',
    s11: 'A = 1, B = 1. MAINTENANT les deux pMOS bloquent et les deux nMOS conduisent : le seul chemin complet mène à la MASSE. Y = 0 — l’unique zéro de la table de vérité du NAND.',
    outro:
      'Un seul réseau conduit à la fois : c’est pourquoi le CMOS ne consomme presque rien tant qu’il maintient une valeur.',
  },
};

export const cmosNand = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  /** A transistor lights up when it CONDUCTS; blocked ones fade back. */
  const fet = (id: string, on: boolean) => ({
    type: 'set_color' as const,
    object: id,
    border_color: on ? HIGH : OFF,
  });
  const w = (id: string, color: string) => ({
    type: 'set_color' as const,
    object: id,
    color,
  });

  const step = (a: Bit, b: Bit, text: string, last = false): Step => {
    const y: Bit = a && b ? 0 : 1;
    // A pMOS conducts on a LOW gate, an nMOS on a HIGH one.
    const p1 = a === 0;
    const p2 = b === 0;
    const n1 = a === 1;
    const n2 = b === 1;
    // The node between the two series nMOS is only DRIVEN when N2 conducts
    // (it is then pulled to ground); otherwise nothing holds it, so it is drawn
    // as undriven rather than given a level it does not have.
    const mid = n2 ? LOW_WIRE : OFF;
    const out = y ? HIGH : LOW_WIRE;
    return {
      type: 'parallel',
      actions: [
        { type: 'set_icon', object: 'A', icon: String(a) },
        { type: 'set_color', object: 'A', ...pad(a) },
        { type: 'set_icon', object: 'B', icon: String(b) },
        { type: 'set_color', object: 'B', ...pad(b) },
        { type: 'set_icon', object: 'Y', icon: String(y) },
        { type: 'set_color', object: 'Y', ...pad(y) },
        fet('P1', p1),
        fet('P2', p2),
        fet('N1', n1),
        fet('N2', n2),
        // Gate wires carry their input's level, whatever the transistor does.
        w('wAp', a ? HIGH : LOW_WIRE),
        w('wAn', a ? HIGH : LOW_WIRE),
        w('wBp', b ? HIGH : LOW_WIRE),
        w('wBn', b ? HIGH : LOW_WIRE),
        // Supply rails are constant; only the branch through a CONDUCTING
        // transistor actually carries the rail to the output node.
        w('wV1', p1 ? HIGH : OFF),
        w('wV2', p2 ? HIGH : OFF),
        w('wP1', p1 ? HIGH : OFF),
        w('wP2', p2 ? HIGH : OFF),
        w('wOut', out),
        w('wN1', out),
        w('wMid', mid),
        w('wGnd', n2 ? LOW_WIRE : OFF),
        {
          type: 'comment',
          text,
          ...(last ? { keep_until_end: true } : { keep_until_next: true }),
        },
      ],
    };
  };

  return {
    direction: 'circuit',
    nodes: [
      // Coordinates are picked against `computeScale`'s limits, not by eye. Every
      // NON-junction node keeps 60 design-px of edge margin and sits ~0.19 from
      // the next one vertically; junction dots are exempt from both, which is
      // what lets the rails tuck in close. The whole schematic also starts BELOW
      // y = 0.25, because an unanchored `comment` renders at the top centre of
      // the stage and would otherwise sit on the pull-up row. And the diagram is
      // kept wider than it is tall: the frame's aspect feeds `sizeScale`, so a
      // square schematic renders its symbols ~30% smaller than a wide one for no
      // reason the reader can see.
      // The channel terminals ride the symbol's RIGHT edge, so the rails line up
      // at x = 0.66 while the transistor CENTRES sit half a symbol left of it.
      // Each input pad is levelled with ONE of the two gates it drives (A with
      // P1's, B with N2's), so that branch of the net is a straight run and only
      // the other one bends. Placed between the two instead, both branches bend
      // and the trunk boxes the transistor in.
      { id: 'A', type: 'signal', x: 0.11, y: 0.29, text: s.a, icon: '0' },
      { id: 'B', type: 'signal', x: 0.11, y: 0.68, text: s.b, icon: '0' },
      // Pull-up: two pMOS side by side, sources up to the rail, drains down to
      // the output node.
      // The rail terminal sits to the RIGHT of both pMOS, not between them: a
      // junction renders its label BELOW the dot, and from the middle of the row
      // that label lands inside the schematic, next to P1's drain wire.
      { id: 'vdd', type: 'junction', x: 0.9, y: 0.24, text: s.vdd },
      { id: 'P1', type: 'mosfet_p', x: 0.45, y: 0.29, text: 'P1' },
      { id: 'P2', type: 'mosfet_p', x: 0.78, y: 0.29, text: 'P2' },
      { id: 'out', type: 'junction', x: 0.66, y: 0.42 },
      // Pull-down: two nMOS stacked, drain-to-source, down to ground.
      { id: 'N1', type: 'mosfet_n', x: 0.6, y: 0.49, text: 'N1' },
      { id: 'N2', type: 'mosfet_n', x: 0.6, y: 0.68, text: 'N2' },
      { id: 'gnd', type: 'ground', x: 0.66, y: 0.87 },
      { id: 'Y', type: 'signal', x: 0.89, y: 0.52, text: s.y, icon: '1' },
    ],
    connections: [
      { id: 'wV1', from: 'vdd', to: 'P1:s', color: OFF },
      { id: 'wV2', from: 'vdd', to: 'P2:s', color: OFF },
      { id: 'wP1', from: 'P1:d', to: 'out', color: OFF },
      { id: 'wP2', from: 'P2:d', to: 'out', color: OFF },
      { id: 'wN1', from: 'out', to: 'N1:d', color: OFF },
      { id: 'wMid', from: 'N1:s', to: 'N2:d', color: OFF },
      { id: 'wGnd', from: 'N2:s', to: 'gnd:a', color: OFF },
      { id: 'wOut', from: 'out', to: 'Y', color: OFF },
      { id: 'wAp', from: 'A', to: 'P1:g', color: LOW_WIRE },
      { id: 'wAn', from: 'A', to: 'N1:g', color: LOW_WIRE },
      { id: 'wBp', from: 'B', to: 'P2:g', color: LOW_WIRE },
      { id: 'wBn', from: 'B', to: 'N2:g', color: LOW_WIRE },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro },
      step(0, 0, s.s00),
      step(0, 1, s.s01),
      step(1, 0, s.s10),
      step(1, 1, s.s11),
      { type: 'comment', text: s.outro, keep_until_end: true },
      { type: 'wait', duration: 2500 },
    ],
  };
};
