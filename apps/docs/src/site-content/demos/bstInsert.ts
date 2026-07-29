import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Binary search tree — INSERTION, slowed down for beginners. The new key starts
// as an ORPHAN (a traveling token, detached from the tree) and walks DOWN one
// node at a time: at each node we compare and go left or right, until we reach
// an EMPTY child — where the new node is then created. The destination node (7)
// is declared in the tree but `visible: false`, so its slot is reserved (and no
// edge is drawn) until `set_visible` reveals it. Numbers are language-invariant.
const NODE = 'steelblue';
const NEW = 'seagreen';
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
      'Inserting into a binary search tree: smaller keys go left, larger keys go right. We want to add the key 7.',
    orphan:
      '7 starts as an orphan, outside the tree, at the root. We compare it with each node to find its place.',
    cmp8: 'Compare with 8: 7 < 8 → the new key belongs in the LEFT subtree.',
    cmp4: 'Compare with 4: 7 > 4 → go to the RIGHT.',
    cmp6: 'Compare with 6: 7 > 6 → go right. But 6 has no right child — the search stops here.',
    placed: 'That empty spot is where 7 belongs: we place it there…',
    linked: '…then connect it as the right child of 6.',
    done: 'Done — 7 is now part of the tree, and it stays a valid binary search tree.',
  },
  fr: {
    intro:
      'Insertion dans un arbre binaire de recherche : les clés plus petites vont à gauche, les plus grandes à droite. On veut ajouter la clé 7.',
    orphan:
      '7 commence orpheline, hors de l’arbre, à la racine. On la compare à chaque nœud pour trouver sa place.',
    cmp8: 'On compare avec 8 : 7 < 8 → la nouvelle clé va dans le sous-arbre GAUCHE.',
    cmp4: 'On compare avec 4 : 7 > 4 → on va à DROITE.',
    cmp6: 'On compare avec 6 : 7 > 6 → à droite. Mais 6 n’a pas d’enfant droit — la recherche s’arrête ici.',
    placed: 'Cette place vide est celle de 7 : on l’y dépose…',
    linked: '…puis on le relie comme enfant droit de 6.',
    done: 'Terminé — 7 fait maintenant partie de l’arbre, qui reste un arbre binaire de recherche valide.',
  },
};

export const bstInsert = (locale: Locale): DataFlowSpec => {
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
    nodes: [
      ...['8', '4', '12', '2', '6', '10', '14'].map(node),
      {
        id: '7',
        type: 'circle',
        body: '7',
        background_color: NEW,
        text_color: INK,
        visible: false,
      },
    ],
    packets: [{ id: 'k', kind: 'subicon', icon: '7' }],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3400 },
      { type: 'comment', object: '8', text: s.orphan, duration: 3200 },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '8', to: '4', duration: 900 },
          { type: 'comment', object: '8', text: s.cmp8, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '4', to: '6', duration: 900 },
          { type: 'comment', object: '4', text: s.cmp4, keep_until_next: true },
        ],
      },
      { type: 'comment', object: '6', text: s.cmp6, duration: 3000 },
      {
        type: 'parallel',
        actions: [
          { type: 'set_visible', object: '7', visible: true, duration: 500 },
          { type: 'comment', object: '6', text: s.placed, duration: 1500 },
        ],
      },
      { type: 'comment', object: '7', text: s.linked, duration: 2400 },
      { type: 'comment', object: '7', text: s.done, keep_until_end: true },
      { type: 'wait', delay_ms: 1400 },
    ],
  };
};
