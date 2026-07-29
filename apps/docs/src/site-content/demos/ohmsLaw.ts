import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Ohm's law explainer on `direction: 'circuit'`. A 12 V battery drives a current
// through an ammeter (in SERIES — it reads the current THROUGH the loop) and a
// 6 Ω resistor; a voltmeter sits in PARALLEL across the resistor (it reads the
// potential difference ACROSS it). The narration walks through the four
// quantities and how they relate:
//   • Voltage / potential difference (V, volts) — the "push", measured across.
//   • Current / amperage (I, amperes) — the flow rate, measured through.
//   • Resistance (R, ohms) — opposition to the flow. Ohm's law: V = I·R.
//   • Power / wattage (P, watts) — energy per second: P = V·I.
// With V = 12 V and R = 6 Ω → I = 2 A and P = 24 W. Numbers, units and Ohm's law
// are language-invariant.
const AMBER = '#f59e0b';

const LOOP = [
  'batt:+',
  'amm:a',
  'amm:b',
  'jTR',
  'R1:a',
  'R1:b',
  'jBR',
  'jBL',
  'batt:-',
];

const strings = {
  en: {
    battery: 'Battery',
    amm: 'Ammeter',
    volt: 'Voltmeter',
    intro:
      'Ohm’s law ties together the four quantities of a circuit. A 12 V battery, a 6 Ω resistor, an ammeter (in series) and a voltmeter (across the resistor).',
    voltage:
      'VOLTAGE (potential difference, in volts) is the “push” the battery provides: 12 V. It is measured ACROSS a component — the voltmeter is in parallel.',
    voltmeter:
      'Notice the current does NOT flow through the voltmeter: it has a near-infinite resistance, so it reads the voltage without drawing current or disturbing the loop. That is why it goes in parallel.',
    current:
      'CURRENT (amperage, in amperes) is the flow of charge THROUGH the loop — the ammeter (in series, so ALL the current passes through it) reads I = V ÷ R = 12 ÷ 6 = 2 A.',
    resistance:
      'RESISTANCE (in ohms) is the opposition to that flow. Ohm’s law: V = I · R. A bigger resistor → less current for the same voltage.',
    power:
      'POWER (wattage, in watts) is the energy delivered per second: P = V · I = 12 × 2 = 24 W, dissipated as heat in the resistor.',
  },
  fr: {
    battery: 'Pile',
    amm: 'Ampèremètre',
    volt: 'Voltmètre',
    intro:
      'La loi d’Ohm relie les quatre grandeurs d’un circuit. Une pile 12 V, une résistance de 6 Ω, un ampèremètre (en série) et un voltmètre (aux bornes de la résistance).',
    voltage:
      'La TENSION (différence de potentiel, en volts) est la « poussée » fournie par la pile : 12 V. Elle se mesure AUX BORNES d’un composant — le voltmètre est en parallèle.',
    voltmeter:
      'Remarque : le courant ne passe PAS par le voltmètre. Sa résistance est quasi infinie, donc il lit la tension sans prélever de courant ni perturber la boucle. C’est pour ça qu’il se branche en parallèle.',
    current:
      'Le COURANT (ampérage, en ampères) est le débit de charge À TRAVERS la boucle — l’ampèremètre (en série, donc TOUT le courant le traverse) lit I = V ÷ R = 12 ÷ 6 = 2 A.',
    resistance:
      'La RÉSISTANCE (en ohms) est l’opposition à ce débit. Loi d’Ohm : V = I · R. Une résistance plus grande → moins de courant pour la même tension.',
    power:
      'La PUISSANCE (wattage, en watts) est l’énergie délivrée par seconde : P = V · I = 12 × 2 = 24 W, dissipée en chaleur dans la résistance.',
  },
};

export const ohmsLaw = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'circuit',
    nodes: [
      {
        id: 'batt',
        type: 'battery',
        x: 0.14,
        y: 0.3,
        text: s.battery,
        value: 12,
        unit: 'V',
      },
      { id: 'amm', type: 'ammeter', x: 0.4, y: 0.3, text: s.amm },
      { id: 'jTR', type: 'junction', x: 0.66, y: 0.3 },
      {
        id: 'R1',
        type: 'resistor',
        x: 0.66,
        y: 0.57,
        rotation: 90,
        value: 6,
        unit: 'Ω',
      },
      { id: 'jBR', type: 'junction', x: 0.66, y: 0.84 },
      { id: 'jBL', type: 'junction', x: 0.1, y: 0.84 },
      // Voltmeter in parallel across the resistor: vertical (rotation 90) so its
      // terminals point up/down, tapping jTR (top) and jBR (bottom) with clean
      // L-wires on the right — no current flows through it.
      {
        id: 'volt',
        type: 'voltmeter',
        x: 0.88,
        y: 0.57,
        rotation: 90,
        text: s.volt,
      },
    ],
    connections: [
      { from: 'batt:+', to: 'amm:a' },
      { from: 'amm:b', to: 'jTR' },
      { from: 'jTR', to: 'R1:a' },
      { from: 'R1:b', to: 'jBR' },
      { from: 'jBR', to: 'jBL' },
      { from: 'jBL', to: 'batt:-' },
      { from: 'jTR', to: 'volt:a' },
      { from: 'volt:b', to: 'jBR' },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4000 },
      {
        type: 'flow',
        route: LOOP,
        color: AMBER,
        duration: 5000,
        count: 8,
        keep_until_end: true,
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_icon', object: 'batt', icon: '12 V' },
          {
            type: 'comment',
            object: 'batt',
            text: s.voltage,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_icon', object: 'volt', icon: '12 V' },
          { type: 'highlight', object: 'volt' },
          {
            type: 'comment',
            object: 'volt',
            text: s.voltmeter,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_icon', object: 'amm', icon: '2 A' },
          { type: 'highlight', object: 'amm' },
          {
            type: 'comment',
            object: 'amm',
            text: s.current,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: 'R1' },
          {
            type: 'comment',
            object: 'R1',
            text: s.resistance,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          // Power is dissipated as heat in the RESISTOR, not the voltmeter.
          { type: 'highlight', object: 'R1' },
          { type: 'comment', text: s.power, keep_until_end: true },
        ],
      },
      { type: 'wait', duration: 2500 },
    ],
  };
};
