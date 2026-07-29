import { DataFlowSpec, NodeType } from '@dataflow-animator/react';

/** Tous les types de nœuds, disposés en grille pour un aperçu visuel. */
const NODE_TYPES: NodeType[] = [
  'desktop',
  'laptop',
  'mobile',
  'client',
  'server',
  'cloud',
  'database',
  'user',
  'admin',
  'users',
  'alice',
  'bob',
  'eve',
];

export const nodeTypesExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: NODE_TYPES.map((type, i) => ({
    id: type,
    type,
    text: type,
    // 4 colonnes : les nœuds d'une même lane s'empilent sur l'axe transverse.
    lane: (i % 4) + 1,
  })),
  packets: [],
  timeline: [],
};

/** Badges `icon` : technos connues (react-icons) et texte libre. */
export const iconsExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'spa', type: 'laptop', text: 'react', icon: 'react', lane: 1 },
    { id: 'api', type: 'server', text: 'node', icon: 'node', lane: 2 },
    { id: 'pg', type: 'database', text: 'postgres', icon: 'postgres', lane: 3 },
    // Texte libre : tronqué à 4 caractères, affiché en pastille.
    { id: 'edge', type: 'cloud', text: 'texte libre', icon: 'v2', lane: 4 },
  ],
  packets: [],
  timeline: [],
};

/** Nœuds textuels : `simple_node` (corps seul) et `complex_node` (en-tête + corps,
 *  allure paquet HTTP). `language` colore toutes les zones de texte du nœud. */
export const textNodesExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'snippet',
      type: 'simple_node',
      text: 'Extrait',
      icon: 'node', // un simple_node peut garder un subicon
      body: 'const total = a + b;',
      language: 'javascript',
      lane: 1,
    },
    {
      id: 'request',
      type: 'complex_node',
      text: 'Requête',
      header: 'GET /api/users HTTP/1.1',
      body: 'Host: api.example.com\nAccept: application/json',
      language: 'http', // appliqué à l'en-tête ET au corps
      lane: 2,
    },
  ],
  packets: [],
  timeline: [],
};

/** Formes géométriques : une forme dessinée pouvant contenir un court texte
 *  centré (`body`). `text` reste le label sous la forme. */
const SHAPE_TYPES: NodeType[] = [
  'square',
  'diamond',
  'circle',
  'triangle',
  'parallelogram',
  'width_rectangle',
  'height_rectangle',
  'star',
];

export const shapesExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: SHAPE_TYPES.map((type, i) => ({
    id: type,
    type,
    text: type,
    body: 'Texte',
    // 4 colonnes : les nœuds d'une même lane s'empilent sur l'axe transverse.
    lane: (i % 4) + 1,
  })),
  packets: [],
  timeline: [],
};

/** Couleurs personnalisées : `background_color` (nom prédéfini ou hex) et
 *  `border_color`. Sans bordure explicite, une bordure coordonnée est dérivée. */
export const colorsExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    // Hex + bordure dérivée automatiquement (aucune border_color).
    {
      id: 'api',
      type: 'server',
      text: 'bordure auto',
      background_color: '#bfdbfe',
      lane: 1,
    },
    // Couleur prédéfinie (nom) sur une forme, avec bordure explicite.
    {
      id: 'cache',
      type: 'circle',
      text: 'noms CSS',
      body: 'Cache',
      background_color: 'gold',
      border_color: 'darkgoldenrod',
      lane: 2,
    },
    // Panneau de texte teinté. Fond sombre sans text_color → texte auto-contrasté
    // (blanc) pour rester lisible.
    {
      id: 'note',
      type: 'simple_node',
      text: 'texte auto',
      body: 'TODO',
      background_color: '#1e3a8a',
      lane: 3,
    },
    // Couleur de texte explicite sur une forme.
    {
      id: 'tag',
      type: 'square',
      text: 'text_color',
      body: 'SALE',
      background_color: '#fee2e2',
      text_color: '#b91c1c',
      lane: 4,
    },
  ],
  packets: [],
  timeline: [],
};

/** Visibilité initiale + révélation via l'action `set_visible`. */
export const revealExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'app', type: 'server', text: 'App', lane: 1 },
    {
      id: 'cache',
      type: 'database',
      text: 'Cache (ajouté)',
      icon: 'redis',
      lane: 2,
      visible: false,
    },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      text: 'Au départ, le cache n’existe pas encore.',
      duration: 1200,
    },
    { type: 'set_visible', object: 'cache', visible: true },
    {
      type: 'comment',
      object: 'cache',
      text: 'On ajoute un cache Redis.',
      keep_until_end: true,
    },
  ],
};

/** Rotation : le champ statique `rotation` (degrés) oriente le visuel ; l'action
 *  `rotate` l'anime. Le label sous le nœud reste droit. Libellés invariants. */
export const rotationExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'r0', type: 'triangle', text: '0°', body: '0°', lane: 1 },
    {
      id: 'r45',
      type: 'triangle',
      text: '45°',
      body: '45°',
      rotation: 45,
      lane: 2,
    },
    {
      id: 'r90',
      type: 'triangle',
      text: '90°',
      body: '90°',
      rotation: 90,
      lane: 3,
    },
    // Animé : demi-tour puis tour complet (les `rotate` s'enchaînent).
    { id: 'spin', type: 'width_rectangle', text: 'rotate', body: '↻', lane: 4 },
  ],
  packets: [],
  timeline: [
    { type: 'rotate', object: 'spin', to: 180, duration: 700 },
    { type: 'rotate', object: 'spin', to: 360, duration: 700 },
  ],
};
