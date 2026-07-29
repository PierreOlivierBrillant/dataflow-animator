import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A parallel circuit on `direction: 'circuit'`: a 9 V battery feeds TWO branches,
// each a 220 Ω resistor in series with an LED, wired between a split junction and
// a join junction; the loop returns along the bottom. Two `flow` actions send
// current down BOTH branches at once, so you see it split at the node and
// recombine — the defining trait of a parallel network. Each branch has its own
// current-limiting resistor (an LED on its own would be destroyed): the full 9 V
// is across EACH branch, the resistor drops most of it and the LED ~2 V.
// Values and terminal names are language-invariant.
const AMBER = '#f59e0b';

// Current path through each branch (conventional current, + → −). The two share
// the battery↔split and join↔battery trunk, where the current adds up.
const TOP = [
  'battery:+',
  'jS',
  'R1:a',
  'R1:b',
  'led1:a',
  'led1:b',
  'jJ',
  'jBR',
  'jBL',
  'battery:-',
];
const BOTTOM = [
  'battery:+',
  'jS',
  'R2:a',
  'R2:b',
  'led2:a',
  'led2:b',
  'jJ',
  'jBR',
  'jBL',
  'battery:-',
];

const strings = {
  en: {
    battery: 'Battery',
    intro:
      'Two branches in parallel, each a 220 Ω resistor in series with an LED. The battery feeds both at once, so the full 9 V is across EACH branch.',
    flow: 'The current splits at the top junction and flows through both branches; each resistor limits its LED’s current. The branches recombine before returning to the battery — so the trunk current is the SUM of the two.',
  },
  fr: {
    battery: 'Pile',
    intro:
      'Deux branches en parallèle, chacune une résistance de 220 Ω en série avec une LED. La pile alimente les deux à la fois : les 9 V complets sont aux bornes de CHAQUE branche.',
    flow: 'Le courant se sépare à la jonction et traverse les deux branches ; chaque résistance limite le courant de sa LED. Les branches se recombinent avant de revenir à la pile — le courant du tronc est donc la SOMME des deux.',
  },
};

export const circuitParallel = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const branchFlow = (route: string[]): DataFlowSpec['timeline'][number] => ({
    type: 'flow',
    route,
    color: AMBER,
    duration: 5000,
    count: 6,
    keep_until_end: true,
  });
  return {
    direction: 'circuit',
    nodes: [
      {
        id: 'battery',
        type: 'battery',
        x: 0.13,
        y: 0.5,
        text: s.battery,
        value: 9,
        unit: 'V',
      },
      { id: 'jS', type: 'junction', x: 0.34, y: 0.5 },
      // Top branch: resistor then LED.
      { id: 'R1', type: 'resistor', x: 0.52, y: 0.26, value: 220, unit: 'Ω' },
      { id: 'led1', type: 'led', x: 0.72, y: 0.26, text: 'LED 1' },
      // Bottom branch.
      { id: 'R2', type: 'resistor', x: 0.52, y: 0.74, value: 220, unit: 'Ω' },
      { id: 'led2', type: 'led', x: 0.72, y: 0.74, text: 'LED 2' },
      { id: 'jJ', type: 'junction', x: 0.88, y: 0.5 },
      // jBR directly below jJ so the return wire drops straight (no jog).
      { id: 'jBR', type: 'junction', x: 0.88, y: 0.92 },
      { id: 'jBL', type: 'junction', x: 0.1, y: 0.92 },
    ],
    connections: [
      { from: 'battery:+', to: 'jS' },
      { from: 'jS', to: 'R1:a' },
      { from: 'R1:b', to: 'led1:a' },
      { from: 'led1:b', to: 'jJ' },
      { from: 'jS', to: 'R2:a' },
      { from: 'R2:b', to: 'led2:a' },
      { from: 'led2:b', to: 'jJ' },
      { from: 'jJ', to: 'jBR' },
      { from: 'jBR', to: 'jBL' },
      { from: 'jBL', to: 'battery:-' },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4000 },
      {
        type: 'parallel',
        actions: [
          branchFlow(TOP),
          branchFlow(BOTTOM),
          { type: 'highlight', object: 'led1', keep_until_end: true },
          { type: 'highlight', object: 'led2', keep_until_end: true },
          { type: 'comment', text: s.flow, keep_until_end: true },
        ],
      },
      { type: 'wait', duration: 3000 },
    ],
  };
};
