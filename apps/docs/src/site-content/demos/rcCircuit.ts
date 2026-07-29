import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// An RC charging circuit — the first TRANSIENT (time-varying) circuit, after the
// steady-state ones. A 9 V battery, a switch, a 10 kΩ resistor and a 100 µF
// capacitor in a series loop (no coordinates → the engine arranges the loop as a
// rectangle). Closing the switch charges the capacitor THROUGH the resistor:
//   • the capacitor voltage rises exponentially, Vc(t) = V·(1 − e^(−t/RC));
//   • the time constant τ = R·C = 10 kΩ × 100 µF = 1 s;
//   • Vc reaches 63 % of V after one τ, ~99 % after 5τ;
//   • as Vc rises the current falls, and once charged the capacitor blocks DC,
//     so the current STOPS. The animated current runs while charging, then ends.
// Component values are language-invariant; only labels and narration translate.
const AMBER = '#f59e0b';
const CHARGED = '#16a34a';

// The current's path once around the loop (conventional current, + → −).
const LOOP = [
  'battery:+',
  'sw:a',
  'sw:b',
  'R:a',
  'R:b',
  'C:a',
  'C:b',
  'battery:-',
];

const strings = {
  en: {
    battery: 'Battery',
    sw: 'Switch',
    intro:
      'An RC circuit: a 10 kΩ resistor charges a 100 µF capacitor from a 9 V battery. Closing the switch starts a transient — the capacitor voltage rises exponentially with time constant τ = R·C = 1 s.',
    close:
      'Close the switch — the capacitor begins to charge through the resistor.',
    t0: 't = 0: the capacitor is empty (0 V), so the full 9 V is across R and the current is maximal, I = V ⁄ R.',
    tau: 't = τ = R·C = 1 s: Vc has risen to 63 % of 9 V ≈ 5.7 V. As Vc grows it opposes the source, so the current has fallen.',
    full: 't ≈ 5τ: the capacitor is essentially fully charged (9 V). It now blocks DC — the current stops.',
  },
  fr: {
    battery: 'Pile',
    sw: 'Interrupteur',
    intro:
      'Un circuit RC : une résistance de 10 kΩ charge un condensateur de 100 µF depuis une pile 9 V. Fermer l’interrupteur lance un régime transitoire — la tension du condensateur monte exponentiellement avec la constante de temps τ = R·C = 1 s.',
    close:
      'On ferme l’interrupteur — le condensateur commence à se charger à travers la résistance.',
    t0: 't = 0 : le condensateur est vide (0 V), donc les 9 V sont aux bornes de R et le courant est maximal, I = V ⁄ R.',
    tau: 't = τ = R·C = 1 s : Vc a atteint 63 % de 9 V ≈ 5,7 V. En montant, Vc s’oppose à la source, donc le courant a diminué.',
    full: 't ≈ 5τ : le condensateur est quasiment chargé (9 V). Il bloque alors le continu — le courant s’arrête.',
  },
};

export const rcCircuit = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const charging = (
    vc: string,
    text: string
  ): DataFlowSpec['timeline'][number] => ({
    type: 'parallel',
    actions: [
      { type: 'flow', route: LOOP, color: AMBER, duration: 3000, count: 6 },
      { type: 'set_icon', object: 'C', icon: vc },
      { type: 'comment', text, keep_until_next: true },
    ],
  });
  return {
    direction: 'circuit',
    nodes: [
      { id: 'battery', type: 'battery', text: s.battery, value: 9, unit: 'V' },
      { id: 'sw', type: 'switch', text: s.sw, closed: false },
      { id: 'R', type: 'resistor', value: 10, unit: 'kΩ' },
      { id: 'C', type: 'capacitor', value: 100, unit: 'µF' },
    ],
    connections: [
      { from: 'battery:+', to: 'sw:a' },
      { from: 'sw:b', to: 'R:a' },
      { from: 'R:b', to: 'C:a' },
      { from: 'C:b', to: 'battery:-' },
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4500 },
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
      charging('0.0', s.t0),
      charging('5.7', s.tau),
      {
        type: 'parallel',
        actions: [
          // No flow: the current has stopped now that C is charged.
          { type: 'set_icon', object: 'C', icon: '9.0' },
          {
            type: 'set_color',
            object: 'C',
            border_color: CHARGED,
            text_color: CHARGED,
          },
          { type: 'highlight', object: 'C' },
          { type: 'comment', text: s.full, keep_until_end: true },
        ],
      },
      { type: 'wait', duration: 2500 },
    ],
  };
};
