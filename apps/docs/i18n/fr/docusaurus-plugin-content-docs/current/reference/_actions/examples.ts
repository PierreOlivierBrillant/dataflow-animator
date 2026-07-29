import { DataFlowSpec } from '@dataflow-animator/react';

/** `move` : un paquet voyage d'un nœud à l'autre (apparition + arrivée). */
export const moveExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'browser',
      type: 'laptop',
      text: 'Navigateur',
      icon: 'chrome',
      lane: 1,
    },
    { id: 'api', type: 'server', text: 'API', icon: 'node', lane: 2 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api', duration: 700 },
  ],
};

/** `arrow` : une flèche animée se dessine progressivement entre deux nœuds. */
export const arrowExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'client', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'server', type: 'server', text: 'Serveur', lane: 2 },
  ],
  packets: [],
  timeline: [
    {
      type: 'arrow',
      from: 'client',
      to: 'server',
      style: 'animated',
      arrow_head: 'forward',
      text: 'requête',
      duration: 800,
    },
  ],
};

/** `parallel` : un `move` et un `arrow` de types différents partent au même instant. */
export const parallelExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'b', type: 'server', text: 'API', lane: 2 },
    { id: 'c', type: 'server', text: 'Worker', lane: 1 },
    { id: 'd', type: 'database', text: 'File', icon: 'redis', lane: 2 },
  ],
  packets: [
    { id: 'p1', kind: 'http_packet', packet_content: { header: 'POST /job' } },
  ],
  timeline: [
    {
      type: 'parallel',
      actions: [
        { type: 'move', object: 'p1', from: 'a', to: 'b', duration: 800 },
        {
          type: 'arrow',
          from: 'c',
          to: 'd',
          style: 'animated',
          arrow_head: 'forward',
          text: 'mise en file',
          duration: 800,
        },
      ],
    },
  ],
};

/** `loading` : un spinner tourne sur la base pendant qu'elle « traite » la requête. */
export const loadingExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'api', type: 'server', text: 'API', icon: 'node', lane: 1 },
    { id: 'db', type: 'database', text: 'Base', icon: 'postgres', lane: 2 },
  ],
  packets: [
    { id: 'q', kind: 'sql_request', request_content: 'SELECT * FROM users' },
    {
      id: 'rows',
      kind: 'sql_response',
      response_content: { header: '42 lignes' },
    },
  ],
  timeline: [
    {
      id: 'send',
      type: 'move',
      object: 'q',
      from: 'api',
      to: 'db',
      duration: 600,
    },
    {
      type: 'loading',
      id: 'work',
      object: 'db',
      duration: 1200,
      wait_for: 'send',
    },
    {
      type: 'move',
      object: 'rows',
      from: 'db',
      to: 'api',
      duration: 600,
      wait_for: 'work',
    },
  ],
};

/** `set_content` : les trois modes de contenu (`code`, `text`, `table`) tour à tour. */
export const setContentExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'editor', type: 'laptop', text: 'Éditeur', lane: 1 },
    {
      id: 'browser',
      type: 'laptop',
      text: 'Navigateur',
      icon: 'chrome',
      lane: 2,
    },
    { id: 'admin', type: 'server', text: 'Admin', lane: 3 },
  ],
  packets: [],
  timeline: [
    {
      type: 'set_content',
      object: 'editor',
      content: {
        type: 'code',
        language: 'javascript',
        value: 'const add = (a, b) => a + b;',
      },
      keep_until_end: true,
    },
    {
      type: 'set_content',
      object: 'browser',
      content: { type: 'text', url: 'exemple.com/users', value: 'Alice\nBob' },
      keep_until_end: true,
    },
    {
      type: 'set_content',
      object: 'admin',
      content: {
        type: 'table',
        columns: ['id', 'nom'],
        rows_data: [
          [1, 'Alice'],
          [2, 'Bob'],
        ],
      },
      keep_until_end: true,
    },
  ],
};

/** `comment` : une bulle omnisciente (sans `object`) puis des bulles attachées aux nœuds. */
export const commentExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'user', type: 'user', text: 'Utilisateur', lane: 1 },
    { id: 'app', type: 'server', text: 'App', lane: 2 },
  ],
  packets: [],
  timeline: [
    { type: 'comment', text: 'Étape 1 — Connexion', duration: 1000 },
    {
      type: 'comment',
      object: 'user',
      text: 'L’utilisateur clique sur « Connexion »',
      duration: 1000,
    },
    {
      type: 'comment',
      object: 'app',
      text: 'Session créée ✓',
      keep_until_end: true,
    },
  ],
};

/** `set_visible` : un nœud déclaré `visible: false` est révélé en cours de chronologie. */
export const setVisibleExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'app', type: 'server', text: 'App', lane: 1 },
    {
      id: 'cache',
      type: 'database',
      text: 'Cache',
      icon: 'redis',
      lane: 2,
      visible: false,
    },
  ],
  packets: [],
  timeline: [
    { type: 'comment', text: 'Pas encore de cache', duration: 1000 },
    { type: 'set_visible', object: 'cache', visible: true },
    {
      type: 'comment',
      object: 'cache',
      text: 'Cache Redis ajouté',
      keep_until_end: true,
    },
  ],
};

/** `set_color` : un nœud est recoloré en cours de chronologie (fondu rouge → noir). */
export const setColorExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'n',
      type: 'circle',
      text: 'nœud',
      body: '7',
      background_color: 'crimson',
      text_color: 'white',
      lane: 1,
    },
  ],
  packets: [],
  timeline: [
    { type: 'comment', object: 'n', text: 'Inséré rouge', duration: 900 },
    {
      type: 'set_color',
      object: 'n',
      background_color: '#1f2937',
      duration: 600,
    },
    {
      type: 'comment',
      object: 'n',
      text: 'Recoloré noir',
      keep_until_end: true,
    },
  ],
};

/** `set_color` sur une connexion : un parcours allume chaque arête de A → B → C. */
export const connectionRecolorExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'circle', body: 'A', lane: 1 },
    { id: 'b', type: 'circle', body: 'B', lane: 2 },
    { id: 'c', type: 'circle', body: 'C', lane: 3 },
  ],
  packets: [],
  connections: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  timeline: [
    { type: 'comment', text: 'Parcours du chemin A → B → C', duration: 700 },
    { type: 'set_color', object: 'ab', color: 'seagreen', duration: 500 },
    { type: 'set_color', object: 'bc', color: 'seagreen', duration: 500 },
  ],
};

/** `rotate` : rotations enchaînées vers des angles absolus ; le label reste droit. */
export const setIconExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'v', type: 'circle', text: 'nœud', body: 'v', icon: '∞', lane: 1 },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      object: 'v',
      text: 'Distance provisoire : ∞',
      duration: 900,
    },
    { type: 'set_icon', object: 'v', icon: '7' },
    { type: 'comment', object: 'v', text: 'Relâché à 7', duration: 900 },
    { type: 'set_icon', object: 'v', icon: '5' },
    {
      type: 'comment',
      object: 'v',
      text: 'Amélioré à 5',
      keep_until_end: true,
    },
  ],
};

export const rotateExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [{ id: 'gear', type: 'star', text: 'engrenage', body: '⚙', lane: 1 }],
  packets: [],
  timeline: [
    { type: 'rotate', object: 'gear', to: 90, duration: 600 },
    { type: 'rotate', object: 'gear', to: 360, duration: 800 },
  ],
};

/** `rotate_subtree` : une rotation gauche rééquilibre une chaîne penchée à droite. */
export const rotateSubtreeExample: DataFlowSpec = {
  direction: 'tree',
  tree: { root: 'a', children: { a: { right: 'b' }, b: { right: 'c' } } },
  nodes: [
    {
      id: 'a',
      type: 'circle',
      body: '10',
      background_color: 'steelblue',
      text_color: 'white',
    },
    {
      id: 'b',
      type: 'circle',
      body: '20',
      background_color: 'steelblue',
      text_color: 'white',
    },
    {
      id: 'c',
      type: 'circle',
      body: '30',
      background_color: 'steelblue',
      text_color: 'white',
    },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      object: 'a',
      text: 'Déséquilibré — une rotation gauche autour de 10 fait monter 20',
      duration: 1500,
    },
    { type: 'rotate_subtree', object: 'a', rotation: 'left' },
  ],
};

/** `highlight` : un halo pulsé sur un nœud statique, puis sur une connexion permanente. */
export const highlightExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'api', type: 'server', text: 'API', lane: 1 },
    { id: 'db', type: 'database', text: 'Base', icon: 'postgres', lane: 2 },
  ],
  connections: [
    { id: 'link', from: 'api', to: 'db', style: 'dashed', arrow_head: 'both' },
  ],
  packets: [],
  timeline: [
    { type: 'highlight', object: 'db', duration: 800 },
    { type: 'highlight', object: 'link', duration: 800 },
  ],
};
