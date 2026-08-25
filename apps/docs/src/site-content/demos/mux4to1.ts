import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A 4:1 MULTIPLEXER — the circuit that picks one of four inputs with two select
// bits, and the reason `type: 'block'` exists. A 2:1 mux is a library symbol
// because its terminal count never varies; a 4:1, an 8:1, a 16:1 each have a
// different one, so they are the same node type with a different `pins` list
// rather than three more symbols to draw.
//
// The two select bits are read as a binary number: S1 S0 = 10 selects D2. Each
// step lights the ONE input path that reaches the output, so the "switch" the
// mux really is stays visible instead of being asserted in the narration.
type Bit = 0 | 1;
type Step = DataFlowSpec['timeline'][number];

const HIGH = '#16a34a';
const LOW_WIRE = '#9aa4b2';
const OFF = '#cbd5e1'; // a path the select bits are not routing
const LOW_PAD = '#e5e7eb';
const INK_HI = 'white';
const INK_LO = '#334155';

/** The four data inputs are fixed; only the SELECT changes from step to step. */
const DATA: Bit[] = [1, 0, 0, 1];

const pad = (v: Bit) =>
  v === 1
    ? { background_color: HIGH, text_color: INK_HI }
    : { background_color: LOW_PAD, text_color: INK_LO };

const strings = {
  en: {
    y: 'Y',
    s1: 'S1',
    s0: 'S0',
    intro:
      'A 4:1 multiplexer: four data inputs, two select bits, one output. The select bits read as a binary number — S1 S0 = 10 picks D2.',
    step: (n: number, s1: Bit, s0: Bit, v: Bit) =>
      `S1 S0 = ${s1}${s0} → D${n} reaches the output. Only that path conducts; the other three are ignored whatever they carry. Y = ${v}.`,
    outro:
      'One block, four data terminals. An 8:1 mux is the same node with four more entries in its pin list — not another symbol to draw.',
  },
  fr: {
    y: 'Y',
    s1: 'S1',
    s0: 'S0',
    intro:
      'Un multiplexeur 4:1 : quatre entrées de données, deux bits de sélection, une sortie. Les bits de sélection se lisent comme un nombre binaire — S1 S0 = 10 choisit D2.',
    step: (n: number, s1: Bit, s0: Bit, v: Bit) =>
      `S1 S0 = ${s1}${s0} → D${n} atteint la sortie. Seul ce chemin conduit ; les trois autres sont ignorés quoi qu’ils transportent. Y = ${v}.`,
    outro:
      'Un seul boîtier, quatre bornes de données. Un mux 8:1, c’est le même nœud avec quatre entrées de plus dans sa liste de broches — pas un symbole de plus à dessiner.',
  },
};

export const mux4to1 = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];

  const step = (sel: number, last = false): Step => {
    const s1 = ((sel >> 1) & 1) as Bit;
    const s0 = (sel & 1) as Bit;
    const y = DATA[sel];
    const actions: NonNullable<Extract<Step, { type: 'parallel' }>['actions']> =
      [];
    for (let i = 0; i < 4; i++) {
      actions.push({
        type: 'set_icon',
        object: `d${i}`,
        icon: String(DATA[i]),
      });
      actions.push({ type: 'set_color', object: `d${i}`, ...pad(DATA[i]) });
      // The unselected paths are dimmed rather than coloured by their bit: they
      // carry a level, but not one the output can see.
      actions.push({
        type: 'set_color',
        object: `w${i}`,
        color: i === sel ? (DATA[i] ? HIGH : LOW_WIRE) : OFF,
      });
    }
    for (const [id, v] of [
      ['s1', s1],
      ['s0', s0],
    ] as const) {
      actions.push({ type: 'set_icon', object: id, icon: String(v) });
      actions.push({ type: 'set_color', object: id, ...pad(v) });
      actions.push({
        type: 'set_color',
        object: `w${id}`,
        color: v ? HIGH : LOW_WIRE,
      });
    }
    actions.push({ type: 'set_icon', object: 'y', icon: String(y) });
    actions.push({ type: 'set_color', object: 'y', ...pad(y) });
    actions.push({
      type: 'set_color',
      object: 'wy',
      color: y ? HIGH : LOW_WIRE,
    });
    actions.push({
      type: 'comment',
      text: s.step(sel, s1, s0, y),
      ...(last ? { keep_until_end: true } : { keep_until_next: true }),
    });
    return { type: 'parallel', actions };
  };

  return {
    direction: 'circuit',
    nodes: [
      // Four stacked pads need 3 × ~0.18 of vertical room and must stay inside
      // the 0.13..0.87 edge margin — that is what fixes this ladder, not taste.
      ...DATA.map((v, i) => ({
        id: `d${i}`,
        type: 'signal' as const,
        x: 0.11,
        y: 0.16 + i * 0.18,
        text: `D${i}`,
        icon: String(v),
      })),
      {
        id: 'mux',
        type: 'block',
        x: 0.52,
        y: 0.43,
        body: 'MUX 4:1',
        pins: [
          { name: 'i0', label: 'D0' },
          { name: 'i1', label: 'D1' },
          { name: 'i2', label: 'D2' },
          { name: 'i3', label: 'D3' },
          { name: 'y', side: 'right', label: 'Y' },
          { name: 's1', side: 'bottom', label: 'S1' },
          { name: 's0', side: 'bottom', label: 'S0' },
        ],
      },
      // Staggered rather than side by side under their terminals: two pads on
      // one row closer than ~0.21 apart shrink the whole schematic.
      { id: 's1', type: 'signal', x: 0.4, y: 0.86, text: s.s1, icon: '0' },
      { id: 's0', type: 'signal', x: 0.64, y: 0.86, text: s.s0, icon: '0' },
      { id: 'y', type: 'signal', x: 0.89, y: 0.43, text: s.y, icon: '1' },
    ],
    connections: [
      ...DATA.map((_, i) => ({
        id: `w${i}`,
        from: `d${i}`,
        to: `mux:i${i}`,
        color: OFF,
      })),
      { id: 'ws1', from: 's1', to: 'mux:s1', color: LOW_WIRE },
      { id: 'ws0', from: 's0', to: 'mux:s0', color: LOW_WIRE },
      { id: 'wy', from: 'mux:y', to: 'y', color: LOW_WIRE },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro },
      step(0),
      step(1),
      step(2),
      step(3),
      { type: 'comment', text: s.outro, keep_until_end: true },
      { type: 'wait', duration: 2500 },
    ],
  };
};
