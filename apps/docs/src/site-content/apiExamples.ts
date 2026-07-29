import type {
  Action,
  DataFlowSpec,
  Node,
  Packet,
} from '@dataflow-animator/react';
import type { Locale } from '../i18n';

/**
 * Specs + légendes de démonstration pour la colonne « Exemples » de la Référence
 * API, construites par locale.
 *
 * Clé = `${NomDéfinition}.${propriété}` (ex. `Node.icon`, `MoveAction.type`).
 * Chaque spec isole l'effet de la propriété concernée et est rendue par un VRAI
 * `<DataFlowPlayer>`. Convention de lecture (côté rendu) : une spec dont la
 * `timeline` n'est pas vide est jouée en boucle automatiquement (le comportement
 * doit être visible) ; sinon c'est un aperçu statique.
 *
 * Les démos d'actions (et tous leurs champs, sauf `id`) sont GÉNÉRÉES par
 * `buildActionDemos` : champ spécifique + 8 champs de timing de `ActionBase`. On
 * ne met pas d'exemple pour les `id` (valeur arbitraire) ni pour la racine `nodes`.
 *
 * Tout texte visible passe par le helper `tr(en, fr)` : la version anglaise est
 * la source. Les valeurs techniques (verbes HTTP, SQL, couleurs) restent telles
 * quelles.
 */

export interface ApiExamples {
  specs: Record<string, DataFlowSpec>;
  notes: Record<string, string>;
}

/** Fusionne le cœur d'une action avec des surcharges (champs communs ou spécifiques). */
function withProps(core: Action, props: Record<string, unknown>): Action {
  // Les surcharges utilisées ici sont toutes des champs valides de l'action ou de
  // ActionBase ; le cast localise l'assouplissement nécessaire au merge générique.
  return { ...core, ...props } as Action;
}

interface ActionRecipe {
  defName: string;
  scene: Node[];
  packets?: Packet[];
  core: Action;
  /** Nœud support du commentaire de suivi (démos de cycle de vie). */
  refNode: string;
  /** Champs spécifiques (hors timing) : `type` + champs propres à l'action. */
  fields: { name: string; props?: Record<string, unknown>; note: string }[];
}

function build(locale: Locale): ApiExamples {
  const tr = (en: string, fr: string): string => (locale === 'fr' ? fr : en);

  // ── Specs statiques ────────────────────────────────────────────────────────
  const staticSpecs: Record<string, DataFlowSpec> = {
    // ── DataFlowSpec (racine) ─────────────────────────────────────────────
    'DataFlowSpec.direction': {
      direction: 'top-to-bottom',
      nodes: [
        { id: 'a', type: 'client', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
        { id: 'c', type: 'database', text: 'DB', lane: 3 },
      ],
      packets: [],
      timeline: [],
    },
    'DataFlowSpec.nodes': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      timeline: [],
    },
    'DataFlowSpec.connections': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      connections: [{ from: 'a', to: 'b', text: 'HTTP' }],
      timeline: [],
    },
    'DataFlowSpec.zones': {
      nodes: [
        { id: 'a', type: 'server', text: 'API', lane: 1 },
        { id: 'b', type: 'database', text: 'DB', lane: 2 },
      ],
      packets: [],
      zones: [{ contains: ['a', 'b'], label: 'Backend', color: 'steelblue' }],
      timeline: [],
    },
    'DataFlowSpec.packets': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [
        { id: 'p', kind: 'http_packet', packet_content: { header: 'GET /' } },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'DataFlowSpec.timeline': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      timeline: [
        { type: 'arrow', from: 'a', to: 'b', text: tr('call', 'appel') },
      ],
    },

    // ── Node ──────────────────────────────────────────────────────────────
    'Node.text': {
      nodes: [
        { id: 'n', type: 'server', text: tr('Web server', 'Serveur web') },
      ],
      packets: [],
      timeline: [],
    },
    'Node.visible': {
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
        { type: 'set_visible', object: 'cache', visible: true, duration: 700 },
      ],
    },
    'Node.icon': {
      nodes: [{ id: 'n', type: 'server', text: 'API', icon: 'react' }],
      packets: [],
      timeline: [],
    },
    'Node.lane': {
      nodes: [
        { id: 'a', type: 'server', text: 'web 1', lane: 1 },
        { id: 'b', type: 'server', text: 'web 2', lane: 1 },
        { id: 'c', type: 'database', text: 'DB', lane: 2 },
      ],
      packets: [],
      timeline: [],
    },
    'Node.main': {
      direction: 'circular',
      nodes: [
        { id: 'hub', type: 'server', text: 'Hub', main: true },
        { id: 'a', type: 'client', text: 'A' },
        { id: 'b', type: 'client', text: 'B' },
        { id: 'c', type: 'client', text: 'C' },
      ],
      packets: [],
      timeline: [],
    },
    'Node.align_with': {
      nodes: [
        { id: 'a', type: 'client', text: 'A', lane: 1 },
        { id: 'b1', type: 'server', text: 'B1', lane: 2 },
        { id: 'b2', type: 'server', text: 'B2', lane: 2 },
        { id: 'c', type: 'database', text: 'C', lane: 3, align_with: 'b1' },
      ],
      packets: [],
      timeline: [],
    },
    'Node.url': {
      nodes: [
        {
          id: 'n',
          type: 'server',
          text: tr('Status (link)', 'Status (lien)'),
          url: 'https://status.example.com',
        },
      ],
      packets: [],
      timeline: [],
    },
    'Node.background_color': {
      nodes: [
        { id: 'n', type: 'square', body: 'API', background_color: '#3b82f6' },
      ],
      packets: [],
      timeline: [],
    },
    'Node.border_color': {
      nodes: [
        { id: 'n', type: 'square', body: 'API', border_color: 'steelblue' },
      ],
      packets: [],
      timeline: [],
    },
    'Node.text_color': {
      nodes: [
        { id: 'n', type: 'simple_node', body: 'Worker', text_color: 'tomato' },
      ],
      packets: [],
      timeline: [],
    },
    'Node.content': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: 'IDE',
          content: {
            type: 'code',
            language: 'javascript',
            value: 'const x = 1;',
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'Node.body': {
      nodes: [{ id: 'n', type: 'simple_node', body: 'Worker' }],
      packets: [],
      timeline: [],
    },
    'Node.header': {
      nodes: [
        {
          id: 'n',
          type: 'complex_node',
          header: 'POST /login',
          body: '200 OK',
        },
      ],
      packets: [],
      timeline: [],
    },
    'Node.language': {
      nodes: [
        {
          id: 'n',
          type: 'complex_node',
          header: 'SELECT id',
          body: 'FROM users',
          language: 'sql',
        },
      ],
      packets: [],
      timeline: [],
    },
    'Node.rotation': {
      nodes: [{ id: 'n', type: 'triangle', text: '45°', rotation: 45 }],
      packets: [],
      timeline: [],
    },

    // ── Connection ──────────────────────────────────────────────────────────
    'Connection.style': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      connections: [{ from: 'a', to: 'b', style: 'animated' }],
      timeline: [],
    },
    'Connection.arrow_head': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      connections: [{ from: 'a', to: 'b', arrow_head: 'both' }],
      timeline: [],
    },
    'Connection.text': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [],
      connections: [{ from: 'a', to: 'b', text: 'HTTPS' }],
      timeline: [],
    },

    // ── Packet ──────────────────────────────────────────────────────────────
    'Packet.kind': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [
        {
          id: 'p',
          kind: 'http_packet',
          packet_content: { header: 'GET /api' },
        },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'Packet.request_content': {
      nodes: [
        { id: 'a', type: 'server', text: 'API', lane: 1 },
        { id: 'b', type: 'database', text: 'DB', lane: 2 },
      ],
      packets: [
        {
          id: 'p',
          kind: 'sql_request',
          request_content: 'SELECT * FROM users',
        },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'Packet.response_content': {
      // Réponse en TEXTE court (le paquet en mouvement reste lisible). Le mode
      // tableau est démontré, lui, par ObjectContent.rows_data (nœud statique).
      nodes: [
        { id: 'a', type: 'database', text: 'DB', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [
        {
          id: 'p',
          kind: 'sql_response',
          response_content: {
            rows: 2,
            header: '200 OK',
            body: { type: 'text', value: 'Alice · Bob' },
          },
        },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'Packet.packet_content': {
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [
        {
          id: 'p',
          kind: 'http_packet',
          packet_content: {
            header: 'POST /login',
            body: { type: 'text', value: '{ "user": "ada" }' },
          },
        },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'Packet.body': {
      // A `complex_node` packet: the text node, but it travels. Same fields as
      // the node (`header`/`body`/`language`), rendered by the same panel.
      nodes: [
        { id: 'a', type: 'server', text: 'API', lane: 1 },
        { id: 'b', type: 'laptop', text: 'Client', lane: 2 },
      ],
      packets: [
        {
          id: 'p',
          kind: 'complex_node',
          header: 'event: ping',
          body: '{ "ok": true }',
          language: 'json',
        },
      ],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },
    'Packet.icon': {
      // A `subicon` packet: the node's tech badge, but it travels. Same value
      // space as the node `icon`, resolved by the same getSubIcon.
      nodes: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [{ id: 'p', kind: 'subicon', icon: 'react' }],
      timeline: [{ type: 'move', object: 'p', from: 'a', to: 'b' }],
    },

    // ── ObjectContent ─────────────────────────────────────────────────────────
    'ObjectContent.type': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: tr('Browser', 'Navigateur'),
          content: {
            type: 'text',
            url: 'https://app.example.com',
            value: tr('Hello 👋', 'Bonjour 👋'),
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'ObjectContent.value': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: 'Terminal',
          content: {
            type: 'code',
            language: 'javascript',
            value: 'const x = 1;',
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'ObjectContent.language': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: tr('Query', 'Requête'),
          content: {
            type: 'code',
            language: 'sql',
            value: 'SELECT * FROM users;',
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'ObjectContent.url': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: tr('Window', 'Fenêtre'),
          content: {
            type: 'text',
            url: 'https://app.example.com/login',
            value: tr('Login page', 'Page de connexion'),
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'ObjectContent.columns': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: tr('Result', 'Résultat'),
          content: {
            type: 'table',
            columns: ['id', 'email'],
            rows_data: [
              [1, 'ada@x.io'],
              [2, 'bob@x.io'],
            ],
          },
        },
      ],
      packets: [],
      timeline: [],
    },
    'ObjectContent.rows_data': {
      nodes: [
        {
          id: 'n',
          type: 'laptop',
          text: tr('Result', 'Résultat'),
          content: {
            type: 'table',
            columns: ['id', 'email'],
            rows_data: [
              [1, 'ada@x.io'],
              [2, 'bob@x.io'],
            ],
          },
        },
      ],
      packets: [],
      timeline: [],
    },
  };

  const staticNotes: Record<string, string> = {
    'DataFlowSpec.direction': tr(
      'Here `top-to-bottom`: the flow goes down.',
      'Ici `top-to-bottom` : le flux descend.'
    ),
    'DataFlowSpec.connections': tr(
      'Permanent link (scenery) shown from the start.',
      'Lien permanent (décor) affiché dès le départ.'
    ),
    'DataFlowSpec.zones': tr(
      'A zone groups nodes in the background.',
      'Une zone regroupe des nœuds en arrière-plan.'
    ),
    'DataFlowSpec.packets': tr(
      'A packet declared here, moved by the timeline.',
      'Un paquet déclaré ici, déplacé par la timeline.'
    ),
    'DataFlowSpec.timeline': tr(
      'An `arrow` action played as a step.',
      'Une action `arrow` jouée comme étape.'
    ),

    'Node.visible': tr(
      '`visible: false` at first, revealed by `set_visible`.',
      '`visible: false` au départ, révélé par `set_visible`.'
    ),
    'Node.icon': tr(
      '`icon: "react"` — overlaid tech badge.',
      '`icon: "react"` — badge techno superposé.'
    ),
    'Node.lane': tr(
      'lane 1 (stacked nodes) then lane 2 (next column).',
      'lane 1 (nœuds empilés) puis lane 2 (colonne suivante).'
    ),
    'Node.main': tr(
      '`main: true`: node at the center (circular layout).',
      '`main: true` : nœud au centre (disposition circular).'
    ),
    'Node.align_with': tr('`c` aligned with `b1`.', '`c` aligné sur `b1`.'),
    'Node.url': tr(
      '`url` makes the node clickable (opens a new tab).',
      '`url` rend le nœud cliquable (ouvre un nouvel onglet).'
    ),
    'Node.background_color': '`background_color: "#3b82f6"`.',
    'Node.border_color': '`border_color: "steelblue"`.',
    'Node.text_color': '`text_color: "tomato"`.',
    'Node.content': tr(
      'Initial node content (here a code terminal).',
      'Contenu initial du nœud (ici un terminal de code).'
    ),
    'Node.header': tr(
      'Header above the body (HTTP-packet look).',
      'En-tête au-dessus du corps (allure paquet HTTP).'
    ),
    'Node.language': tr(
      '`language: "sql"` colors the node text.',
      '`language: "sql"` colore le texte du nœud.'
    ),
    'Node.rotation': tr(
      '`rotation: 45` orients the visual; the label stays upright.',
      '`rotation: 45` oriente le visuel ; le label reste droit.'
    ),

    'Connection.style': tr(
      '`style: "dashed"` — dashed line.',
      '`style: "dashed"` — ligne en tirets.'
    ),
    'Connection.arrow_head': tr(
      '`arrow_head: "both"` — arrowhead at both ends.',
      '`arrow_head: "both"` — pointe aux deux extrémités.'
    ),
    'Connection.text': tr(
      'Label shown in the middle of the link.',
      'Libellé affiché au milieu du lien.'
    ),

    'Packet.kind': tr(
      '`http_packet`: blue packet with a header.',
      '`http_packet` : paquet bleu avec en-tête.'
    ),
    'Packet.request_content': tr(
      'SQL query carried by a `sql_request`.',
      'Requête SQL portée par un `sql_request`.'
    ),
    'Packet.response_content': tr(
      'Response (here short text; can also be a table).',
      'Réponse (ici texte court ; peut aussi être un tableau).'
    ),
    'Packet.packet_content': tr(
      'Header + body of an `http_packet`.',
      'En-tête + corps d’un `http_packet`.'
    ),
    'Packet.body': tr(
      '`simple_node` / `complex_node` packet: the text node, but it travels.',
      'Paquet `simple_node` / `complex_node` : le nœud texte, mais il voyage.'
    ),
    'Packet.icon': tr(
      '`subicon` packet: the tech badge, but it travels.',
      'Paquet `subicon` : le badge techno, mais il voyage.'
    ),

    'ObjectContent.type': tr(
      '`type: "text"` → window with an address bar.',
      '`type: "text"` → fenêtre avec barre d’adresse.'
    ),
    'ObjectContent.value': tr(
      'Source code shown in a terminal.',
      'Code source affiché dans un terminal.'
    ),
    'ObjectContent.language': tr(
      '`language: "sql"` colors the code.',
      '`language: "sql"` colore le code.'
    ),
    'ObjectContent.url': tr(
      'URL shown in the address bar.',
      'URL affichée dans la barre d’adresse.'
    ),
    'ObjectContent.columns': tr(
      'Table column headers.',
      'En-têtes de colonnes du tableau.'
    ),
    'ObjectContent.rows_data': tr(
      'Table data rows.',
      'Lignes de données du tableau.'
    ),
  };

  // ── Actions : démos générées pour TOUS les champs (sauf `id`) ───────────────
  // Chaque action a une « scène » + une action « cœur ». On génère un exemple par
  // champ spécifique (type, object, from, to, text, content, actions…) PUIS pour
  // les 8 champs de timing/cycle de vie de `ActionBase`. Les démos de timing
  // reposent surtout sur leur légende, l'effet étant subtil.

  /** Démos des 8 champs de timing/cycle de vie de `ActionBase`, communs à toutes les actions. */
  const TIMING_FIELDS: {
    name: string;
    note: string;
    timeline: (core: Action, ref: string) => Action[];
  }[] = [
    {
      name: 'duration',
      note: tr(
        '`duration` sets the animation speed — slowed to 2.5 s here.',
        '`duration` règle la vitesse de l’animation — ici ralentie à 2,5 s.'
      ),
      timeline: (core) => [withProps(core, { duration: 2500 })],
    },
    {
      name: 'delay_ms',
      note: tr(
        '`delay_ms` delays the start — by 0.9 s here.',
        '`delay_ms` retarde le démarrage — ici de 0,9 s.'
      ),
      timeline: (core) => [withProps(core, { delay_ms: 900 })],
    },
    {
      name: 'fade_in_ms',
      note: tr(
        '`fade_in_ms`: fade-in — 1.6 s here.',
        '`fade_in_ms` : apparition en fondu — ici 1,6 s.'
      ),
      timeline: (core) => [withProps(core, { fade_in_ms: 1600 })],
    },
    {
      name: 'fade_out_ms',
      note: tr(
        '`fade_out_ms`: fade-out — 1.6 s here.',
        '`fade_out_ms` : disparition en fondu — ici 1,6 s.'
      ),
      timeline: (core) => [
        withProps(core, { keep_until_next: false, fade_out_ms: 1600 }),
        { type: 'wait', duration: 1600 },
      ],
    },
    {
      name: 'wait_for',
      note: tr(
        'The next action starts when this one ends (`wait_for`).',
        'L’action suivante démarre à la fin de celle-ci (`wait_for`).'
      ),
      timeline: (core, ref) => [
        withProps(core, { id: 'x1' }),
        {
          type: 'comment',
          object: ref,
          text: tr('next', 'ensuite'),
          wait_for: 'x1',
        },
      ],
    },
    {
      name: 'keep_until',
      note: tr(
        'Stays visible until the target action starts (`keep_until`).',
        'Reste visible jusqu’au démarrage de l’action ciblée (`keep_until`).'
      ),
      timeline: (core, ref) => [
        withProps(core, { keep_until: 'x2' }),
        {
          id: 'x2',
          type: 'comment',
          object: ref,
          text: tr('step 2', 'étape 2'),
          delay_ms: 1300,
        },
      ],
    },
    {
      name: 'keep_until_next',
      note: tr(
        'Stays visible until the next step begins.',
        'Reste visible jusqu’au début de l’étape suivante.'
      ),
      timeline: (core, ref) => [
        withProps(core, { keep_until_next: true }),
        {
          type: 'comment',
          object: ref,
          text: tr('step 2', 'étape 2'),
          delay_ms: 1300,
        },
      ],
    },
    {
      name: 'keep_until_end',
      note: tr(
        'Stays visible until the end of the timeline.',
        'Reste visible jusqu’à la fin de la chronologie.'
      ),
      timeline: (core, ref) => [
        withProps(core, { keep_until_end: true }),
        {
          type: 'comment',
          object: ref,
          text: tr('step 2', 'étape 2'),
          delay_ms: 1300,
        },
      ],
    },
  ];

  const ACTION_RECIPES: ActionRecipe[] = [
    {
      defName: 'MoveAction',
      scene: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      packets: [
        { id: 'p', kind: 'http_packet', packet_content: { header: 'GET /' } },
      ],
      core: { type: 'move', object: 'p', from: 'a', to: 'b' },
      refNode: 'b',
      fields: [
        {
          name: 'type',
          note: tr(
            'Moves the packet from `a` to `b`.',
            'Déplace le paquet de `a` vers `b`.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: the packet (declared in `packets`) being moved.',
            '`object` : le paquet (déclaré dans `packets`) déplacé.'
          ),
        },
        {
          name: 'from',
          note: tr('`from`: source node.', '`from` : nœud de départ.'),
        },
        {
          name: 'to',
          note: tr('`to`: target node.', '`to` : nœud d’arrivée.'),
        },
      ],
    },
    {
      defName: 'ArrowAction',
      scene: [
        { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
        { id: 'b', type: 'server', text: 'API', lane: 2 },
      ],
      core: {
        type: 'arrow',
        from: 'a',
        to: 'b',
        text: tr('request', 'requête'),
      },
      refNode: 'b',
      fields: [
        {
          name: 'type',
          note: tr('Draws an arrow `a → b`.', 'Trace une flèche `a → b`.'),
        },
        {
          name: 'from',
          note: tr('`from`: source node.', '`from` : nœud de départ.'),
        },
        {
          name: 'to',
          note: tr('`to`: target node.', '`to` : nœud d’arrivée.'),
        },
        {
          name: 'text',
          props: { text: '200 OK' },
          note: tr(
            '`text`: label shown in the middle.',
            '`text` : libellé affiché au milieu.'
          ),
        },
        {
          name: 'style',
          props: { style: 'dashed' },
          note: tr(
            '`style: "dashed"` — dashed line.',
            '`style: "dashed"` — ligne en tirets.'
          ),
        },
        {
          name: 'arrow_head',
          props: { arrow_head: 'both' },
          note: tr(
            '`arrow_head: "both"` — arrowhead at both ends.',
            '`arrow_head: "both"` — pointe aux deux extrémités.'
          ),
        },
      ],
    },
    {
      defName: 'ParallelAction',
      scene: [
        { id: 'a', type: 'server', text: 'API', lane: 1 },
        { id: 'b', type: 'database', text: 'DB 1', lane: 2 },
        { id: 'c', type: 'database', text: 'DB 2', lane: 2 },
      ],
      core: {
        type: 'parallel',
        actions: [
          { type: 'arrow', from: 'a', to: 'b' },
          { type: 'arrow', from: 'a', to: 'c' },
        ],
      },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'Several actions played at the same time.',
            'Plusieurs actions jouées au même instant.'
          ),
        },
        {
          name: 'actions',
          note: tr(
            '`actions`: the list played simultaneously.',
            '`actions` : la liste jouée simultanément.'
          ),
        },
      ],
    },
    {
      defName: 'LoadingAction',
      scene: [{ id: 'a', type: 'server', text: 'API' }],
      core: { type: 'loading', object: 'a', duration: 1500 },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'Loading spinner on the node.',
            'Spinner de chargement sur le nœud.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: the node showing the spinner.',
            '`object` : le nœud qui affiche le spinner.'
          ),
        },
      ],
    },
    {
      defName: 'SetContentAction',
      scene: [{ id: 'a', type: 'laptop', text: 'IDE' }],
      core: {
        type: 'set_content',
        object: 'a',
        content: {
          type: 'code',
          language: 'javascript',
          value: 'const x = 1;',
        },
      },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'The node content becomes a code terminal.',
            'Le contenu du nœud devient un terminal de code.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: the node whose content changes.',
            '`object` : le nœud dont le contenu change.'
          ),
        },
        {
          name: 'content',
          note: tr(
            '`content`: the new content shown.',
            '`content` : le nouveau contenu affiché.'
          ),
        },
      ],
    },
    {
      defName: 'CommentAction',
      scene: [{ id: 'a', type: 'server', text: 'API' }],
      core: {
        type: 'comment',
        object: 'a',
        text: tr(
          'The server validates the token',
          'Le serveur valide le token'
        ),
      },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'Comment bubble near the node.',
            'Bulle de commentaire près du nœud.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: commented node (omitted = top of the stage).',
            '`object` : nœud commenté (omis = haut du stage).'
          ),
        },
        {
          name: 'text',
          note: tr(
            '`text`: the bubble text.',
            '`text` : le texte de la bulle.'
          ),
        },
      ],
    },
    {
      defName: 'HighlightAction',
      scene: [{ id: 'a', type: 'server', text: 'API' }],
      core: { type: 'highlight', object: 'a' },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'The node is highlighted.',
            'Le nœud est mis en surbrillance.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: node (or connection) to highlight.',
            '`object` : nœud (ou connexion) à surligner.'
          ),
        },
      ],
    },
    {
      defName: 'RotateAction',
      scene: [{ id: 'a', type: 'width_rectangle', text: 'rotate' }],
      core: { type: 'rotate', object: 'a', to: 90 },
      refNode: 'a',
      fields: [
        {
          name: 'type',
          note: tr(
            'Animated rotation of the node visual.',
            'Rotation animée du visuel du nœud.'
          ),
        },
        {
          name: 'object',
          note: tr(
            '`object`: the node to rotate.',
            '`object` : le nœud à faire pivoter.'
          ),
        },
        {
          name: 'to',
          note: tr(
            '`to`: absolute target angle in degrees (eased). Exclusive with `spin`.',
            '`to` : angle cible absolu en degrés (avec inertie). Exclusif avec `spin`.'
          ),
        },
        {
          name: 'spin',
          // Override the `to` core with a continuous spin (to/spin are exclusive).
          props: { to: undefined, spin: 360, duration: 2500 },
          note: tr(
            '`spin`: continuous speed in deg/s (signed); spins for `duration`, or until `keep_until` / `keep_until_end`.',
            '`spin` : vitesse continue en deg/s (signée) ; tourne pendant `duration`, ou jusqu’à `keep_until` / `keep_until_end`.'
          ),
        },
      ],
    },
  ];

  const specs: Record<string, DataFlowSpec> = { ...staticSpecs };
  const notes: Record<string, string> = { ...staticNotes };
  for (const r of ACTION_RECIPES) {
    const base = (timeline: Action[]): DataFlowSpec => ({
      nodes: r.scene,
      packets: r.packets ?? [],
      timeline,
    });
    for (const f of r.fields) {
      specs[`${r.defName}.${f.name}`] = base([
        withProps(r.core, f.props ?? {}),
      ]);
      notes[`${r.defName}.${f.name}`] = f.note;
    }
    for (const t of TIMING_FIELDS) {
      specs[`${r.defName}.${t.name}`] = base(t.timeline(r.core, r.refNode));
      notes[`${r.defName}.${t.name}`] = t.note;
    }
  }

  return { specs, notes };
}

// Construit une fois par locale (la Référence API monte plusieurs PropsTable).
const cache = new Map<Locale, ApiExamples>();

export function getApiExamples(locale: Locale): ApiExamples {
  const hit = cache.get(locale);
  if (hit) return hit;
  const built = build(locale);
  cache.set(locale, built);
  return built;
}
