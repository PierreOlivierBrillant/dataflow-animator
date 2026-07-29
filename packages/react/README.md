# @dataflow-animator/react

Composant React qui compile une spécification JSON en une animation
déterministe et navigable de flux de données (client/serveur, requêtes
SQL, microservices…).

- Aucune coordonnée à fournir — le moteur place les nœuds.
- Lecteur intégré : lecture, pause, navigation par étapes, plein écran.
- SSR-safe, utilisable directement dans Docusaurus, Next.js, Vite, etc.
- Coloration syntaxique intégrée (Prism, remplaçable).

Ce paquet est une **liaison React** au-dessus de
[`@dataflow-animator/core`](../core/README.md), qui contient le moteur, le
rendu DOM et la feuille de style. Le cœur est une dépendance : il s'installe
tout seul, et c'est de lui que vient la CSS.

## Installation

```bash
npm install @dataflow-animator/react
```

`react` et `react-dom` (≥ 18) sont attendus en `peerDependencies`.
`@dataflow-animator/core` est une dépendance normale — rien à installer en plus.

> **ESM uniquement.** Ce package ne fournit pas d'entrée CommonJS. Votre
> bundler (Vite, Next.js, esbuild…) doit supporter les modules ES. Node.js
> ≥ 12 avec `"type": "module"` ou un flag `--input-type=module` est requis
> pour les usages hors bundler.

## Utilisation

```tsx
import { DataFlowPlayer } from '@dataflow-animator/react';
import '@dataflow-animator/core/styles.css';

const spec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Navigateur', lane: 1 },
    { id: 'api', type: 'server', text: 'API', lane: 2 },
    { id: 'db', type: 'database', text: 'PostgreSQL', lane: 3 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
    {
      id: 'sql',
      kind: 'sql_request',
      request_content: 'SELECT * FROM users',
    },
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api' },
    { type: 'move', object: 'sql', from: 'api', to: 'db' },
  ],
};

export default function Example() {
  return <DataFlowPlayer spec={spec} />;
}
```

## Concepts en une page

Une **spec** décrit trois choses :

1. **`nodes`** — les nœuds du diagramme (serveurs, clients, bases…).
   Placement automatique selon `direction` (linéaire ou `circular`) et `lane`.
2. **`packets`** — les payloads qui circuleront entre nœuds
   (paquets HTTP, requêtes/réponses SQL).
3. **`timeline`** — la chronologie : `move`, `arrow`, `parallel`, `loading`,
   `set_content`, `comment`, `highlight`.

Le moteur compile la spec en une chronologie déterministe : le temps `t` (ms)
est l'unique source de vérité, ce qui rend le seek, la navigation par étapes
et le SSR triviaux.

## Props principales du `<DataFlowPlayer>`

| Prop        | Type                                       | Défaut          | Description                                           |
| ----------- | ------------------------------------------ | --------------- | ----------------------------------------------------- |
| `spec`      | `DataFlowSpec`                             | —               | La spécification à animer.                            |
| `height`    | `number \| string`                         | `420`           | Hauteur de la scène.                                  |
| `autoPlay`  | `boolean`                                  | `false`         | Démarre la lecture automatiquement.                   |
| `loop`      | `boolean`                                  | `false`         | Rejoue en boucle à la fin.                            |
| `controls`  | `boolean`                                  | `true`          | Affiche la barre de contrôles.                        |
| `theme`     | `'light' \| 'dark' \| 'auto'`              | `'auto'`        | Suit `prefers-color-scheme` et `[data-theme]` parent. |
| `density`   | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Échelle visuelle.                                     |
| `speed`     | `number`                                   | `1`             | Vitesse de lecture.                                   |
| `highlight` | `Highlighter`                              | Prism           | Remplacer la coloration syntaxique.                   |
| `debug`     | `boolean`                                  | `false`         | Overlay de debug de la timeline.                      |

## Extensibilité

```ts
import { registerNodeIcon, registerSubIcon } from '@dataflow-animator/react';

// Une icône est du MARKUP SVG (ou une fabrique `() => SVGElement`), pas un
// ReactNode : le lecteur rend hors de React depuis la v3.
registerNodeIcon('queue', '<svg viewBox="0 0 24 24">…</svg>');
registerSubIcon('kafka', '<svg viewBox="0 0 24 24">…</svg>');
```

Une sous-icône peut aussi être un **texte libre** (`'v2'`, `'API'`, `'JWT'`),
automatiquement rendu en pastille.

## Sans React ?

Le cœur se monte seul, sans aucun framework :
`mountPlayer(container, spec, options)` — voir
[`@dataflow-animator/core`](../core/README.md).

## Documentation

Site complet (démos, playground, référence API) :
<https://github.com/PierreOlivierBrillant/react-dataflow-animator>.

## Licence

[MIT](../../LICENSE)
