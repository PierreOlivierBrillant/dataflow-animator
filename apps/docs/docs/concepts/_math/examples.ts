import { DataFlowSpec } from '@dataflow-animator/react';

/**
 * The motivating case: a full subtractor's I/O pads, labelled the way a circuit
 * diagram would label them. Note the doubled backslash in `\\overline` — a JS
 * string eats a lone one.
 */
export const subscriptExample: DataFlowSpec = {
  direction: 'circuit',
  nodes: [
    { id: 'a', type: 'signal', text: '$A$', icon: '1', lane: 1 },
    { id: 'bin', type: 'signal', text: '$B_{in}$', icon: '0', lane: 1 },
    { id: 'gate', type: 'nand_gate', lane: 2 },
    { id: 'out', type: 'signal', text: '$\\overline{A}$', icon: '1', lane: 3 },
  ],
  connections: [
    { from: 'a', to: 'gate:a' },
    { from: 'bin', to: 'gate:b' },
    { from: 'gate:y', to: 'out' },
  ],
  packets: [],
  timeline: [],
};

/** Variables italic, units upright — the LaTeX convention, on a component label. */
export const unitsExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'r',
      type: 'resistor',
      text: '$R_1$',
      value: '10',
      unit: 'kΩ',
      lane: 1,
    },
    {
      id: 'c',
      type: 'capacitor',
      text: '$C_1$',
      value: '4.7',
      unit: 'µF',
      lane: 2,
    },
    { id: 'tau', type: 'circle', body: '$\\tau$', lane: 3 },
  ],
  connections: [
    { from: 'r', to: 'c', text: '$V_{out}$' },
    { from: 'c', to: 'tau', text: '$\\tau = R_1 C_1$' },
  ],
  packets: [],
  timeline: [],
};

/** Superscripts, Greek and relations, in a comment and on a shape. */
export const mathExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'n', type: 'square', body: '$n^2$', lane: 1 },
    { id: 'sum', type: 'circle', body: '$\\Sigma$', lane: 2 },
    { id: 'res', type: 'square', body: '$O(n^2)$', lane: 3 },
  ],
  connections: [
    { from: 'n', to: 'sum' },
    { from: 'sum', to: 'res', text: '$n \\geq 1$' },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      text: 'The cost grows as $O(n^2)$ — with $\\alpha \\approx 1$.',
      duration: 3000,
    },
  ],
};
