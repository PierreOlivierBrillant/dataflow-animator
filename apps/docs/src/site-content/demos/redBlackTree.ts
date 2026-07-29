import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Red-black tree — the RECOLORING case, told in full for students. We start from
// a VALID red-black tree, INSERT a new key (5, always red) by walking it down,
// hit a red-red violation, look at the UNCLE (red) and fix it by recoloring —
// the operation `set_color` exists for. The recolor stops at 20 because its
// parent 40 is black. The new node is the green token that lands as node 5.
// Colors: crimson = red, dark = black. Numbers are language-invariant.
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
      'A valid red-black tree: the root is black, no red node has a red child, and every path holds the same number of black nodes.',
    insert: 'Insert the key 5. In a red-black tree, a NEW node is always RED.',
    cmp40: '5 < 40 → go LEFT',
    cmp20: '5 < 20 → go LEFT',
    cmp10: '5 < 10 → 10’s left child is empty: this is the spot',
    placed: '5 is placed at the empty spot, in red…',
    linked: '…then linked to its parent 10.',
    violation:
      'Problem: 5 is red and its parent 10 is red too — a red-red violation, which is forbidden.',
    uncle:
      'We look at the UNCLE (the parent’s sibling): node 30. It is RED → this is the recolor case.',
    recolor1: 'Recolor the parent 10 and the uncle 30 to BLACK.',
    recolor2:
      'Recolor the grandparent 20 to RED to keep the black counts equal.',
    stop: '20’s parent (40) is black, so 20 being red creates no new violation — we can stop.',
    done: 'Valid red-black tree again ✓',
  },
  fr: {
    intro:
      'Un arbre rouge-noir valide : la racine est noire, aucun nœud rouge n’a d’enfant rouge, et chaque chemin compte le même nombre de nœuds noirs.',
    insert:
      'Insérons la clé 5. Dans un arbre rouge-noir, un NOUVEAU nœud est toujours ROUGE.',
    cmp40: '5 < 40 → à GAUCHE',
    cmp20: '5 < 20 → à GAUCHE',
    cmp10: '5 < 10 → l’enfant gauche de 10 est vide : c’est la place',
    placed: 'On place 5 à l’emplacement vide, en rouge…',
    linked: '…puis on le relie à son parent 10.',
    violation:
      'Problème : 5 est rouge et son parent 10 est rouge aussi — une violation rouge-rouge, interdite.',
    uncle:
      'On regarde l’ONCLE (le frère du parent) : le nœud 30. Il est ROUGE → c’est le cas recoloration.',
    recolor1: 'On recolore le parent 10 et l’oncle 30 en NOIR.',
    recolor2:
      'On recolore le grand-parent 20 en ROUGE pour garder les comptes de noirs égaux.',
    stop: 'Le parent de 20 (le 40) est noir, donc 20 en rouge ne crée pas de nouvelle violation — on peut s’arrêter.',
    done: 'Arbre rouge-noir de nouveau valide ✓',
  },
};

export const redBlackTree = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'tree',
    tree: {
      root: '40',
      children: {
        '40': { left: '20', right: '60' },
        '20': { left: '10', right: '30' },
        '60': { left: '55', right: '70' },
        '10': { left: '5' },
      },
    },
    nodes: [
      N('40', BLACK),
      N('20', BLACK),
      N('60', BLACK),
      N('10', RED),
      N('30', RED),
      N('55', RED),
      N('70', RED),
      N('5', RED, true),
    ],
    packets: [{ id: 'k', kind: 'subicon', icon: '5' }],
    timeline: [
      { type: 'comment', text: s.intro, duration: 3400 },
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
          { type: 'highlight', object: '30', duration: 2200 },
          {
            type: 'comment',
            object: '30',
            text: s.uncle,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_color', object: '10', background_color: BLACK },
          { type: 'set_color', object: '30', background_color: BLACK },
          { type: 'comment', text: s.recolor1, keep_until_next: true },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'set_color', object: '20', background_color: RED },
          {
            type: 'comment',
            object: '20',
            text: s.recolor2,
            keep_until_next: true,
          },
        ],
      },
      {
        type: 'parallel',
        actions: [
          { type: 'highlight', object: '40', duration: 2200 },
          {
            type: 'comment',
            object: '40',
            text: s.stop,
            keep_until_next: true,
          },
        ],
      },
      { type: 'comment', text: s.done, keep_until_end: true },
      { type: 'wait', delay_ms: 1400 },
    ],
  };
};
