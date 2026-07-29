import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A minimal series circuit on `direction: 'circuit'` with NO coordinates: a 9 V
// battery, a switch, a 220 Ω resistor and an LED wired into a single loop. Since
// the connections form ONE cycle, the engine auto-places the four components
// around a rectangle (components on vertical edges are auto-rotated so the wires
// stay straight). Wires are declared between NAMED terminals (`"battery:+"`,
// `"R1:a"`…) and drawn as orthogonal wires (no arrow head). Closing the switch
// with a `toggle` energizes the loop; a `flow` then sends a train of charge dots
// once around it (conventional current, + → −) while the LED lights up.
//
// Component values (9 V, 220 Ω) and terminal names are language-invariant; only
// the node labels and the narration are translated.
const AMBER = '#f59e0b';

// The current's path once around the loop (conventional current, + → −).
const LOOP = [
  'battery:+',
  'sw:a',
  'sw:b',
  'R1:a',
  'R1:b',
  'led:a',
  'led:b',
  'battery:-',
];

const strings = {
  en: {
    battery: 'Battery',
    sw: 'Switch',
    intro:
      'A series loop: a 9 V battery, a switch, a 220 Ω resistor and an LED. No coordinates — the loop is auto-arranged. The switch is open, so no current flows.',
    close: 'Close the switch — the loop is now complete.',
    flow: 'Conventional current flows + → − through the resistor and the LED, which lights up.',
  },
  fr: {
    battery: 'Pile',
    sw: 'Interrupteur',
    intro:
      'Une boucle en série : une pile 9 V, un interrupteur, une résistance de 220 Ω et une LED. Aucune coordonnée — la boucle est disposée automatiquement. L’interrupteur est ouvert, aucun courant ne circule.',
    close: 'On ferme l’interrupteur — la boucle est maintenant complète.',
    flow: 'Le courant conventionnel circule + → − à travers la résistance et la LED, qui s’allume.',
  },
};

export const circuit = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'circuit',
    nodes: [
      { id: 'battery', type: 'battery', text: s.battery, value: 9, unit: 'V' },
      { id: 'sw', type: 'switch', text: s.sw, closed: false },
      { id: 'R1', type: 'resistor', value: 220, unit: 'Ω' },
      { id: 'led', type: 'led', text: 'LED' },
    ],
    connections: [
      { from: 'battery:+', to: 'sw:a' },
      { from: 'sw:b', to: 'R1:a' },
      { from: 'R1:b', to: 'led:a' },
      { from: 'led:b', to: 'battery:-' },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3500 },
      {
        type: 'parallel',
        actions: [
          { type: 'toggle', object: 'sw', closed: true },
          {
            type: 'comment',
            object: 'sw',
            text: s.close,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          {
            type: 'flow',
            route: LOOP,
            color: AMBER,
            duration: 6000,
            count: 8,
            keep_until_end: true,
          },
          { type: 'highlight', object: 'led', keep_until_end: true },
          { type: 'comment', text: s.flow, keep_until_end: true },
        ],
      },
      { type: 'wait', duration: 3000 },
    ],
  };
};
