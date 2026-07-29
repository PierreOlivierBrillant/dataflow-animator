import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Dijkstra's shortest path on a `direction: 'graph'` layout. Nodes carry NO
// coordinates: the engine auto-places them (minimizing edge crossings). Every
// node carries its current tentative distance
// as a corner icon badge (∞ at first, updated with `set_icon`): that badge is
// the whole point — without it you cannot remember each node's value. The run is
// decomposed for students into one step per operation: SETTLE the nearest node,
// then RELAX each of its edges, one batch at a time. Nodes are amber while on
// the frontier and teal once settled; the final shortest path lights up green.
//
// Trace from A: A=0 → C=2 → B=3 (via C) → D=8 (via B) → E=10 (via D) → F=13
// (via E). Shortest path A→C→B→D→E→F = 13 (edges ac, bc, bd, de, ef). Node keys
// (A…F), distances and edge weights are language-invariant.
const SETTLED = '#0d9488'; // teal — settled (final) node
const FRONTIER = '#b45309'; // amber — reached but not settled yet
const PATH = '#16a34a'; // green — final shortest path
const INK = 'white';

/** Circle node showing its key (body) and its distance badge (icon, starts ∞). */
const N = (id: string) => ({
  id,
  type: 'circle' as const,
  body: id,
  icon: '∞',
});

const E = (id: string, from: string, to: string, w: number) => ({
  id,
  from,
  to,
  text: String(w),
  path: 'straight' as const,
  arrow_head: 'none' as const,
});

// One-action helpers (each goes inside a parallel step).
const settle = (id: string): DataFlowSpec['timeline'][number] => ({
  type: 'set_color',
  object: id,
  background_color: SETTLED,
  text_color: INK,
});
const frontier = (id: string): DataFlowSpec['timeline'][number] => ({
  type: 'set_color',
  object: id,
  background_color: FRONTIER,
  text_color: INK,
});
const dist = (id: string, v: string): DataFlowSpec['timeline'][number] => ({
  type: 'set_icon',
  object: id,
  icon: v,
});
const say = (
  object: string,
  text: string
): DataFlowSpec['timeline'][number] => ({
  type: 'comment',
  object,
  text,
  keep_until_next: true,
});

const strings = {
  en: {
    intro:
      'Dijkstra keeps a tentative distance on every node — the badge, ∞ at first. It repeatedly SETTLES the nearest unsettled node, then RELAXES its edges, lowering neighbours’ badges.',
    settleA: 'A is the source: distance 0. Settle it.',
    relaxA:
      'Relax A’s edges: B ← 4 and C ← 2 get their first tentative badges.',
    settleC: 'The nearest unsettled node is C = 2 → settle it.',
    relaxC: 'Relax C: B improves 4 → 3 (2 + 1), and D = 10, E = 12 appear.',
    settleB: 'Nearest unsettled is now B = 3 → settle it.',
    relaxB: 'Relax B → D: 3 + 5 = 8 beats 10, so D drops to 8.',
    settleD: 'Nearest unsettled is D = 8 → settle it.',
    relaxD: 'Relax D: E improves 12 → 10, and the target F appears at 14.',
    settleE: 'Nearest unsettled is E = 10 → settle it.',
    relaxE: 'Relax E → F: 10 + 3 = 13 beats 14, so F drops to 13.',
    settleF:
      'Only F is left, at 13 → settle it. The target’s distance is final.',
    done: 'Shortest path A→C→B→D→E→F = 13. Each badge is that node’s final shortest distance from A.',
  },
  fr: {
    intro:
      'Dijkstra garde une distance provisoire sur chaque nœud — le badge, ∞ au départ. Il RÈGLE tour à tour le nœud non réglé le plus proche, puis RELÂCHE ses arêtes, abaissant les badges des voisins.',
    settleA: 'A est la source : distance 0. On le règle.',
    relaxA:
      'On relâche les arêtes de A : B ← 4 et C ← 2 reçoivent leurs premiers badges provisoires.',
    settleC: 'Le nœud non réglé le plus proche est C = 2 → on le règle.',
    relaxC:
      'On relâche C : B s’améliore 4 → 3 (2 + 1), et D = 10, E = 12 apparaissent.',
    settleB: 'Le plus proche non réglé est maintenant B = 3 → on le règle.',
    relaxB: 'On relâche B → D : 3 + 5 = 8 bat 10, donc D tombe à 8.',
    settleD: 'Le plus proche non réglé est D = 8 → on le règle.',
    relaxD: 'On relâche D : E s’améliore 12 → 10, et la cible F apparaît à 14.',
    settleE: 'Le plus proche non réglé est E = 10 → on le règle.',
    relaxE: 'On relâche E → F : 10 + 3 = 13 bat 14, donc F tombe à 13.',
    settleF:
      'Il ne reste que F, à 13 → on le règle. La distance de la cible est définitive.',
    done: 'Plus court chemin A→C→B→D→E→F = 13. Chaque badge est la distance finale la plus courte du nœud depuis A.',
  },
};

export const dijkstra = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const pathNodes = ['A', 'C', 'B', 'D', 'E', 'F'];
  const pathEdges = ['ac', 'bc', 'bd', 'de', 'ef'];
  return {
    direction: 'graph',
    nodes: ['A', 'B', 'C', 'D', 'E', 'F'].map(N),
    connections: [
      E('ab', 'A', 'B', 4),
      E('ac', 'A', 'C', 2),
      E('bc', 'B', 'C', 1),
      E('bd', 'B', 'D', 5),
      E('cd', 'C', 'D', 8),
      E('ce', 'C', 'E', 10),
      E('de', 'D', 'E', 2),
      E('df', 'D', 'F', 6),
      E('ef', 'E', 'F', 3),
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4000 },
      {
        type: 'parallel',
        actions: [dist('A', '0'), settle('A'), say('A', s.settleA)],
      },
      {
        type: 'parallel',
        actions: [
          dist('B', '4'),
          frontier('B'),
          dist('C', '2'),
          frontier('C'),
          say('A', s.relaxA),
        ],
      },
      { type: 'parallel', actions: [settle('C'), say('C', s.settleC)] },
      {
        type: 'parallel',
        actions: [
          dist('B', '3'),
          dist('D', '10'),
          frontier('D'),
          dist('E', '12'),
          frontier('E'),
          say('C', s.relaxC),
        ],
      },
      { type: 'parallel', actions: [settle('B'), say('B', s.settleB)] },
      { type: 'parallel', actions: [dist('D', '8'), say('D', s.relaxB)] },
      { type: 'parallel', actions: [settle('D'), say('D', s.settleD)] },
      {
        type: 'parallel',
        actions: [
          dist('E', '10'),
          dist('F', '14'),
          frontier('F'),
          say('D', s.relaxD),
        ],
      },
      { type: 'parallel', actions: [settle('E'), say('E', s.settleE)] },
      { type: 'parallel', actions: [dist('F', '13'), say('F', s.relaxE)] },
      { type: 'parallel', actions: [settle('F'), say('F', s.settleF)] },
      {
        type: 'parallel',
        actions: [
          ...pathNodes.map((id) => ({
            type: 'set_color' as const,
            object: id,
            background_color: PATH,
            text_color: INK,
          })),
          ...pathEdges.map((id) => ({
            type: 'set_color' as const,
            object: id,
            color: PATH,
          })),
          { type: 'comment', text: s.done, keep_until_end: true },
        ],
      },
      { type: 'wait', duration: 1600 },
    ],
  };
};
