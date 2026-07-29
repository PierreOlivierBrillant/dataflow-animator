import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Binary search tree — SEARCH, slowed down for beginners. A query key (a
// traveling token) walks down the tree from the root: at each node we compare
// and go left or right, halving the search space each time, until the key is
// found. We look up 7 in an 8-node BST: 7 < 8 → left, 7 > 4 → right, 7 > 6 →
// right, found. Numbers are language-invariant; the comments carry the narration.
const NODE = 'steelblue';
const FOUND = 'seagreen';
const INK = 'white';

const node = (id: string) => ({
  id,
  type: 'circle' as const,
  body: id,
  background_color: NODE,
  text_color: INK,
});

const strings = {
  en: {
    intro:
      'Searching a binary search tree: at each node we go left if our key is smaller, right if it is larger. We are looking for 7.',
    start: 'We start at the root, 8, and compare.',
    cmp8: '7 < 8 → the key, if present, is in the LEFT subtree. We can ignore everything on the right.',
    cmp4: '7 > 4 → go to the RIGHT.',
    cmp6: '7 > 6 → go to the RIGHT child.',
    found:
      '7 = 7 → found! Only three comparisons in an 8-node tree: that is the O(log n) advantage.',
  },
  fr: {
    intro:
      'Recherche dans un arbre binaire de recherche : à chaque nœud on va à gauche si la clé est plus petite, à droite si elle est plus grande. On cherche 7.',
    start: 'On part de la racine, 8, et on compare.',
    cmp8: '7 < 8 → la clé, si elle existe, est dans le sous-arbre GAUCHE. On peut ignorer toute la droite.',
    cmp4: '7 > 4 → on va à DROITE.',
    cmp6: '7 > 6 → on descend vers l’enfant DROIT.',
    found:
      '7 = 7 → trouvé ! Trois comparaisons seulement dans un arbre de 8 nœuds : c’est l’avantage en O(log n).',
  },
};

export const bstSearch = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'tree',
    tree: {
      root: '8',
      children: {
        '8': { left: '4', right: '12' },
        '4': { left: '2', right: '6' },
        '6': { right: '7' },
        '12': { left: '10', right: '14' },
      },
    },
    nodes: ['8', '4', '12', '2', '6', '10', '14', '7'].map(node),
    packets: [{ id: 'q', kind: 'subicon', icon: '7' }],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3600 },
      { type: 'comment', object: '8', text: s.start, duration: 2400 },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'q', from: '8', to: '4', duration: 900 },
          { type: 'comment', object: '8', text: s.cmp8, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'q', from: '4', to: '6', duration: 900 },
          { type: 'comment', object: '4', text: s.cmp4, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'q', from: '6', to: '7', duration: 900 },
          { type: 'comment', object: '6', text: s.cmp6, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_color', object: '7', background_color: FOUND },
          { type: 'highlight', object: '7', duration: 1200 },
          { type: 'comment', object: '7', text: s.found, keep_until_end: true },
        ],
      },
      { type: 'wait', delay_ms: 1400 },
    ],
  };
};
