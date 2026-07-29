import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// AVL tree — the FULL story, slowed down for students just discovering balanced
// trees. We start from a BALANCED tree, INSERT a new key (10) by walking it down
// from the root step by step, then walk back UP checking each balance factor
// until we find the node that broke the rule (50, factor +2), and fix it with a
// single right rotation — narrated move by move so it is clear who becomes whose
// left/right child. The inserted node is tinted green to track it. Key numbers
// (in `body` / the token icon) are language-invariant.
const NODE = 'steelblue';
const NEW = 'seagreen';
const INK = 'white';

const N = (id: string, isNew = false) => ({
  id,
  type: 'circle' as const,
  body: id,
  background_color: isNew ? NEW : NODE,
  text_color: INK,
  ...(isNew ? { visible: false } : {}),
});

const strings = {
  en: {
    intro:
      'A balanced AVL tree: every node’s balance factor (left height − right height) is in [−1, +1].',
    insert:
      'Let’s insert the key 10. Like in any BST, we route it down from the root.',
    cmp50: '10 < 50 → go into the LEFT subtree',
    cmp30: '10 < 30 → go LEFT again',
    cmp20: '10 < 20 → and 20’s left child is empty: this is the spot',
    placed: '10 is placed at the empty spot…',
    linked: '…then linked to its parent 20 (the green node).',
    walk: 'After an insertion we walk back UP to the root, checking each balance factor.',
    bf20: '20: left height 1, right height 0 → factor +1. Still OK.',
    bf30: '30: left height 2, right height 1 → factor +1. Still OK.',
    bf50: '50: left height 3, right height 1 → factor +2. UNBALANCED!',
    rotIntro:
      'It is the left-left case. We right-rotate around 50 — watch exactly who moves where.',
    rotStep1: '1) 30, the LEFT child of 50, moves UP and becomes the new root.',
    rotStep2: '2) 50 moves DOWN and becomes the RIGHT child of 30.',
    rotStep3:
      '3) 40, which was 30’s RIGHT child, slides over to become 50’s LEFT child.',
    glide: 'Now the nodes glide into those new positions.',
    done: 'Balanced again ✓ Every factor is back in [−1, +1], and the tree is one level shorter.',
  },
  fr: {
    intro:
      'Un arbre AVL équilibré : chaque nœud a un facteur d’équilibre (hauteur gauche − hauteur droite) dans [−1, +1].',
    insert:
      'Insérons la clé 10. Comme dans tout ABR, on la fait descendre depuis la racine.',
    cmp50: '10 < 50 → on descend dans le sous-arbre GAUCHE',
    cmp30: '10 < 30 → encore à GAUCHE',
    cmp20: '10 < 20 → et l’enfant gauche de 20 est vide : c’est la place',
    placed: 'On place 10 à l’emplacement vide…',
    linked: '…puis on le relie à son parent 20 (le nœud vert).',
    walk: 'Après une insertion, on REMONTE vers la racine en vérifiant chaque facteur d’équilibre.',
    bf20: '20 : hauteur gauche 1, droite 0 → facteur +1. Toujours OK.',
    bf30: '30 : hauteur gauche 2, droite 1 → facteur +1. Toujours OK.',
    bf50: '50 : hauteur gauche 3, droite 1 → facteur +2. DÉSÉQUILIBRÉ !',
    rotIntro:
      'C’est le cas gauche-gauche. On fait une rotation droite autour de 50 — regardons précisément qui bouge.',
    rotStep1:
      '1) 30, l’enfant GAUCHE de 50, monte et devient la nouvelle racine.',
    rotStep2: '2) 50 descend et devient l’enfant DROIT de 30.',
    rotStep3:
      '3) 40, qui était l’enfant DROIT de 30, se déplace pour devenir l’enfant GAUCHE de 50.',
    glide: 'Les nœuds glissent alors vers ces nouvelles positions.',
    done: 'De nouveau équilibré ✓ Chaque facteur est dans [−1, +1], et l’arbre a perdu un niveau.',
  },
};

export const avlTree = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'tree',
    tree: {
      root: '50',
      children: {
        '50': { left: '30', right: '70' },
        '30': { left: '20', right: '40' },
        '20': { left: '10' },
      },
    },
    nodes: [N('50'), N('30'), N('70'), N('20'), N('40'), N('10', true)],
    packets: [{ id: 'k', kind: 'subicon', icon: '10' }],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3200 },
      { type: 'comment', object: '50', text: s.insert, duration: 2800 },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '50', to: '30', duration: 900 },
          {
            type: 'comment',
            object: '50',
            text: s.cmp50,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '30', to: '20', duration: 900 },
          {
            type: 'comment',
            object: '30',
            text: s.cmp30,
            keep_until_next: true,
          },
        ],
      },
      { type: 'comment', object: '20', text: s.cmp20, duration: 2600 },
      {
        type: 'parallel',
        actions: [
          { type: 'set_visible', object: '10', visible: true, duration: 500 },
          { type: 'comment', object: '20', text: s.placed, duration: 1500 },
        ],
      },
      { type: 'comment', object: '10', text: s.linked, duration: 2400 },
      { type: 'comment', text: s.walk, duration: 3000 },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: '20', duration: 2000 },
          {
            type: 'comment',
            object: '20',
            text: s.bf20,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: '30', duration: 2000 },
          {
            type: 'comment',
            object: '30',
            text: s.bf30,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: '50', duration: 2400 },
          {
            type: 'comment',
            object: '50',
            text: s.bf50,
            keep_until_next: true,
          },
        ],
      },
      { type: 'comment', object: '50', text: s.rotIntro, duration: 3200 },
      { type: 'comment', object: '30', text: s.rotStep1, duration: 2800 },
      { type: 'comment', object: '50', text: s.rotStep2, duration: 2800 },
      { type: 'comment', object: '40', text: s.rotStep3, duration: 3000 },
      {
        type: 'parallel',
        actions: [
          {
            type: 'rotate_subtree',
            object: '50',
            rotation: 'right',
            duration: 1700,
          },
          { type: 'comment', text: s.glide, keep_until_next: true },
        ],
      },
      { type: 'comment', object: '30', text: s.done, keep_until_end: true },
      { type: 'wait', delay_ms: 1400 },
    ],
  };
};
