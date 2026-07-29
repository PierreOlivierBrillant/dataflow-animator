import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Red-black tree — the ROTATION case, told in full for students (vs. the pure
// recoloring of `redBlackTree`). We start from a VALID tree, INSERT a new key
// (5, red) by walking it down, hit a red-red violation whose UNCLE is BLACK
// (absent). A black uncle means recoloring alone can't fix it: we ROTATE
// (narrated move by move) and then recolor. This is the left-left case → right
// rotation around the grandparent 20. Numbers are language-invariant.
const RED = 'crimson';
const BLACK = '#1f2937';
const INK = 'white';

const N = (id: string, color: string, hidden = false) => ({
  id,
  type: 'circle' as const,
  body: id,
  background_color: color,
  text_color: INK,
  ...(hidden ? { visible: false } : {}),
});

const strings = {
  en: {
    intro:
      'A valid red-black tree. We are about to insert a key on its left side.',
    insert: 'Insert the key 5 (red), walking it down from the root.',
    cmp40: '5 < 40 → go LEFT',
    cmp20: '5 < 20 → go LEFT',
    cmp10: '5 < 10 → 10’s left child is empty: this is the spot',
    placed: '5 is placed at the empty spot, in red…',
    linked: '…then linked to its parent 10.',
    violation: 'Red-red violation: 5 and its parent 10 are both red.',
    uncle:
      'The UNCLE (10’s sibling) is BLACK — here it is absent. A black uncle means recoloring is NOT enough: we must ROTATE.',
    rotIntro:
      'It is the left-left case: a right rotation around the grandparent 20. Watch who moves where.',
    rotStep1: '1) 10, the LEFT child of 20, moves UP to take 20’s place.',
    rotStep2: '2) 20 moves DOWN and becomes the RIGHT child of 10.',
    glide: 'The nodes glide into place.',
    recolor: 'Finally we recolor: 10 becomes black, 20 becomes red.',
    done: 'Valid red-black tree ✓ — 10 is black with two red children.',
  },
  fr: {
    intro: 'Un arbre rouge-noir valide. On va insérer une clé sur sa gauche.',
    insert:
      'Insérons la clé 5 (rouge) en la faisant descendre depuis la racine.',
    cmp40: '5 < 40 → à GAUCHE',
    cmp20: '5 < 20 → à GAUCHE',
    cmp10: '5 < 10 → l’enfant gauche de 10 est vide : c’est la place',
    placed: 'On place 5 à l’emplacement vide, en rouge…',
    linked: '…puis on le relie à son parent 10.',
    violation:
      'Violation rouge-rouge : 5 et son parent 10 sont tous deux rouges.',
    uncle:
      'L’ONCLE (le frère de 10) est NOIR — ici absent. Un oncle noir signifie que recolorer ne suffit PAS : il faut une ROTATION.',
    rotIntro:
      'C’est le cas gauche-gauche : une rotation droite autour du grand-parent 20. Regardons qui bouge.',
    rotStep1:
      '1) 10, l’enfant GAUCHE de 20, monte pour prendre la place de 20.',
    rotStep2: '2) 20 descend et devient l’enfant DROIT de 10.',
    glide: 'Les nœuds glissent en place.',
    recolor: 'Enfin on recolore : 10 devient noir, 20 devient rouge.',
    done: 'Arbre rouge-noir valide ✓ — 10 est noir avec deux enfants rouges.',
  },
};

export const redBlackRotation = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'tree',
    tree: {
      root: '40',
      children: {
        '40': { left: '20', right: '60' },
        '20': { left: '10' },
        '10': { left: '5' },
        '60': { right: '70' },
      },
    },
    nodes: [
      N('40', BLACK),
      N('20', BLACK),
      N('60', BLACK),
      N('10', RED),
      N('70', RED),
      N('5', RED, true),
    ],
    packets: [{ id: 'k', kind: 'subicon', icon: '5' }],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3000 },
      { type: 'comment', object: '40', text: s.insert, duration: 2800 },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '40', to: '20', duration: 900 },
          {
            type: 'comment',
            object: '40',
            text: s.cmp40,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'move', object: 'k', from: '20', to: '10', duration: 900 },
          {
            type: 'comment',
            object: '20',
            text: s.cmp20,
            keep_until_next: true,
          },
        ],
      },
      { type: 'comment', object: '10', text: s.cmp10, duration: 2600 },
      {
        type: 'parallel',
        actions: [
          { type: 'set_visible', object: '5', visible: true, duration: 500 },
          { type: 'comment', object: '10', text: s.placed, duration: 1500 },
        ],
      },
      { type: 'comment', object: '5', text: s.linked, duration: 2200 },
      { type: 'comment', object: '5', text: s.violation, duration: 2800 },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: '20', duration: 2400 },
          {
            type: 'comment',
            object: '20',
            text: s.uncle,
            keep_until_next: true,
          },
        ],
      },
      { type: 'comment', object: '10', text: s.rotIntro, duration: 3200 },
      { type: 'comment', object: '10', text: s.rotStep1, duration: 2800 },
      { type: 'comment', object: '20', text: s.rotStep2, duration: 2800 },
      {
        type: 'parallel',
        actions: [
          {
            type: 'rotate_subtree',
            object: '20',
            rotation: 'right',
            duration: 1700,
          },
          { type: 'comment', text: s.glide, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_color', object: '10', background_color: BLACK },
          { type: 'set_color', object: '20', background_color: RED },
          { type: 'comment', text: s.recolor, keep_until_next: true },
        ],
      },
      { type: 'comment', object: '10', text: s.done, keep_until_end: true },
      { type: 'wait', delay_ms: 1400 },
    ],
  };
};
