import { DataFlowSpec, Direction } from '@dataflow-animator/react';

export const orientationExample: (direction: Direction) => DataFlowSpec = (
  direction: Direction
) => ({
  direction: direction,
  nodes: [
    { id: 'a', type: 'server', text: 'A', lane: 1 },
    { id: 'b', type: 'server', text: 'B', lane: 2 },
    { id: 'c', type: 'server', text: 'C', lane: 3 },
  ],
  packets: [],
  connections: [
    { from: 'a', to: 'b', style: 'animated' },
    { from: 'b', to: 'c', style: 'animated' },
  ],
  timeline: [],
});

/**
 * Convergence des liens (`merge_edges`) : plusieurs clients vers un serveur.
 * `merge` bascule le drapeau `merge_edges` du serveur : la même spec se rend
 * convergée (défaut) ou écartée.
 */
export const mergeEdgesExample: (merge: boolean) => DataFlowSpec = (merge) => ({
  direction: 'left-to-right',
  nodes: [
    { id: 'c1', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'c2', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'c3', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'c4', type: 'laptop', text: 'Client', lane: 1 },
    {
      id: 'srv',
      type: 'server',
      text: 'Serveur',
      icon: 'nginx',
      lane: 2,
      merge_edges: merge,
    },
  ],
  packets: [],
  connections: [
    { from: 'c1', to: 'srv', style: 'animated' },
    { from: 'c2', to: 'srv', style: 'animated' },
    { from: 'c3', to: 'srv', style: 'animated' },
    { from: 'c4', to: 'srv', style: 'animated' },
  ],
  timeline: [],
});

/**
 * Points de connexion d'un nœud rond (`ports`) : un hub circulaire à huit
 * rayons. `'direct'` (le défaut) laisse chaque arête toucher le hub exactement
 * là où elle pointe — huit ancres radiales distinctes. Un nombre fini fixe ces
 * directions au plus proche parmi autant de créneaux régulièrement répartis, si
 * bien que des rayons se regroupent sur des points communs. Clés (`body`)
 * invariantes par langue.
 */
export const portsExample: (ports: 'direct' | number) => DataFlowSpec = (
  ports
) => ({
  direction: 'circular',
  nodes: [
    { id: 'hub', type: 'circle', body: 'H', main: true, ports },
    { id: 'n1', type: 'circle', body: '1' },
    { id: 'n2', type: 'circle', body: '2' },
    { id: 'n3', type: 'circle', body: '3' },
    { id: 'n4', type: 'circle', body: '4' },
    { id: 'n5', type: 'circle', body: '5' },
    { id: 'n6', type: 'circle', body: '6' },
    { id: 'n7', type: 'circle', body: '7' },
    { id: 'n8', type: 'circle', body: '8' },
  ],
  packets: [],
  connections: [
    { from: 'n1', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n2', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n3', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n4', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n5', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n6', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n7', to: 'hub', path: 'straight', arrow_head: 'none' },
    { from: 'n8', to: 'hub', path: 'straight', arrow_head: 'none' },
  ],
  timeline: [],
});

export const circularExample: DataFlowSpec = {
  direction: 'circular',
  nodes: [
    { id: 'a', type: 'server', text: 'A' },
    { id: 'b', type: 'server', text: 'B' },
    { id: 'c', type: 'server', text: 'C' },
    { id: 'd', type: 'server', text: 'D' },
    { id: 'e', type: 'server', text: 'E' },
    { id: 'main', type: 'server', text: 'Principal', main: true },
  ],
  packets: [],
  connections: [
    { from: 'a', to: 'main', style: 'animated' },
    { from: 'b', to: 'main', style: 'animated' },
    { from: 'c', to: 'main', style: 'animated' },
    { from: 'd', to: 'main', style: 'animated' },
    { from: 'e', to: 'main', style: 'animated' },
  ],
  timeline: [],
};

/**
 * Mode arbre : un arbre binaire placé par rang in-order (horizontal) et
 * profondeur (vertical). Les arêtes parent→enfant sont dessinées automatiquement
 * depuis le bloc `tree` — pas de `connections`. Les clés (`body`) sont
 * invariantes par langue.
 */
export const treeExample: DataFlowSpec = {
  direction: 'tree',
  tree: {
    root: '8',
    children: {
      '8': { left: '3', right: '13' },
      '3': { left: '1', right: '6' },
      '13': { right: '17' },
    },
  },
  nodes: [
    { id: '8', type: 'circle', body: '8' },
    { id: '3', type: 'circle', body: '3' },
    { id: '13', type: 'circle', body: '13' },
    { id: '1', type: 'circle', body: '1' },
    { id: '6', type: 'circle', body: '6' },
    { id: '17', type: 'circle', body: '17' },
  ],
  packets: [],
  timeline: [],
};

/**
 * Mode graphe : un graphe pondéré quelconque placé à la main via les `x`/`y` de
 * chaque nœud (fractions de la scène). Les arêtes sont de simples `connections` —
 * non orientées (`arrow_head: 'none'`), droites, et pondérées via `text`. Les
 * clés (`body`) et les poids sont invariants par langue.
 */
export const graphExample: DataFlowSpec = {
  direction: 'graph',
  nodes: [
    { id: 'A', type: 'circle', body: 'A', x: 0.12, y: 0.5 },
    { id: 'B', type: 'circle', body: 'B', x: 0.42, y: 0.18 },
    { id: 'C', type: 'circle', body: 'C', x: 0.42, y: 0.82 },
    { id: 'D', type: 'circle', body: 'D', x: 0.72, y: 0.5 },
  ],
  packets: [],
  connections: [
    { from: 'A', to: 'B', text: '7', path: 'straight', arrow_head: 'none' },
    { from: 'A', to: 'C', text: '2', path: 'straight', arrow_head: 'none' },
    { from: 'B', to: 'C', text: '3', path: 'straight', arrow_head: 'none' },
    { from: 'B', to: 'D', text: '4', path: 'straight', arrow_head: 'none' },
    { from: 'C', to: 'D', text: '6', path: 'straight', arrow_head: 'none' },
  ],
  timeline: [],
};

/**
 * Mode circuit : un schéma électrique. Les nœuds sont des composants placés par
 * `x`/`y` ; les `connections` sont tracées comme des FILS orthogonaux (sans tête)
 * entre des bornes NOMMÉES (`"batt:+"`, `"R1:a"`…). Un `flow` fait circuler des
 * charges dans la boucle (courant conventionnel, + → −). Les valeurs des
 * composants sont invariantes de langue.
 */
export const circuitExample: DataFlowSpec = {
  direction: 'circuit',
  // AUCUNE coordonnée : les quatre composants forment une boucle, donc le moteur
  // les place automatiquement sur un rectangle (composants verticaux auto-tournés).
  nodes: [
    { id: 'batt', type: 'battery', value: 9, unit: 'V' },
    { id: 'sw', type: 'switch', closed: true },
    { id: 'R1', type: 'resistor', value: 220, unit: 'Ω' },
    { id: 'led', type: 'led', text: 'LED' },
  ],
  packets: [],
  connections: [
    { from: 'batt:+', to: 'sw:a' },
    { from: 'sw:b', to: 'R1:a' },
    { from: 'R1:b', to: 'led:a' },
    { from: 'led:b', to: 'batt:-' },
  ],
  timeline: [
    {
      type: 'flow',
      route: [
        'batt:+',
        'sw:a',
        'sw:b',
        'R1:a',
        'R1:b',
        'led:a',
        'led:b',
        'batt:-',
      ],
      color: '#f59e0b',
      duration: 6000,
      count: 8,
      keep_until_end: true,
    },
  ],
};

/** Exemple concret de la section « Mode circulaire » : un hub central. */
export const circularHubExample: DataFlowSpec = {
  direction: 'circular',
  nodes: [
    {
      id: 'gateway',
      type: 'server',
      text: 'Gateway',
      icon: 'nginx',
      main: true,
    },
    { id: 'auth', type: 'server', text: 'Auth', icon: 'dotnet' },
    { id: 'orders', type: 'server', text: 'Orders', icon: 'node' },
    { id: 'billing', type: 'server', text: 'Billing', icon: 'java' },
    { id: 'search', type: 'server', text: 'Search', icon: 'python' },
  ],
  packets: [],
  connections: [
    { from: 'auth', to: 'gateway', style: 'animated' },
    { from: 'orders', to: 'gateway', style: 'animated' },
    { from: 'billing', to: 'gateway', style: 'animated' },
    { from: 'search', to: 'gateway', style: 'animated' },
  ],
  timeline: [],
};
