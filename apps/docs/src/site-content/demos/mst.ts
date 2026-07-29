import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// Kruskal's minimum spanning tree on an auto-placed `direction: 'graph'` layout
// (no coordinates — the engine positions the nodes to avoid edge crossings).
// Edges are taken in increasing weight; each is ADDED if it joins two separate trees,
// or SKIPPED if both ends are already connected (that would close a cycle).
// Decomposed for students: one step per edge, in sorted order — so the
// cycle-forming edges are actually MET while the forest is still growing, and
// each rejection lights up the loop it would have closed (that's the part that
// was missing when all rejects were lumped at the end).
//
// Sorted edges: ab(1) bc(2) ac(3✗) cd(4) de(5) be(6✗) ef(7) cf(8✗).
// The ✗ edges close a cycle. MST = ab, bc, cd, de, ef, total 1+2+4+5+7 = 19.
// Node keys (A…F) and weights are language-invariant.
const TREE = '#16a34a'; // green — chosen spanning-tree edge
const JOIN = '#0d9488'; // teal — node joined to the forest
const REJECT = '#dc2626'; // red — edge skipped (would close a cycle)
const INK = 'white';

const N = (id: string) => ({
  id,
  type: 'circle' as const,
  body: id,
});

const E = (id: string, from: string, to: string, w: number) => ({
  id,
  from,
  to,
  text: String(w),
  path: 'straight' as const,
  arrow_head: 'none' as const,
});

/** Add an edge to the tree: colour it green and its newly joined node(s) teal. */
const accept = (
  edge: string,
  joined: string[],
  near: string,
  text: string
): DataFlowSpec['timeline'][number] => ({
  type: 'parallel',
  actions: [
    { type: 'set_color', object: edge, color: TREE },
    ...joined.map((id) => ({
      type: 'set_color' as const,
      object: id,
      background_color: JOIN,
      text_color: INK,
    })),
    { type: 'comment', object: near, text, keep_until_next: true },
  ],
});

/** Skip an edge: light up the existing path (the cycle it would close) and
 *  paint the candidate red. */
const reject = (
  candidate: string,
  cyclePath: string[],
  near: string,
  text: string
): DataFlowSpec['timeline'][number] => ({
  type: 'parallel',
  actions: [
    { type: 'set_color', object: candidate, color: REJECT },
    ...cyclePath.map((id) => ({
      type: 'highlight' as const,
      object: id,
      duration: 1700,
    })),
    { type: 'comment', object: near, text, keep_until_next: true },
  ],
});

const strings = {
  en: {
    intro:
      'Kruskal’s minimum spanning tree: sort the edges by weight, then take each in turn — ADD it if its ends are in different trees, SKIP it if they are already connected (that would close a cycle).',
    ab: '1 — A–B links two lone nodes. Add it.',
    bc: '2 — B–C brings in C. Add it.',
    ac: '3 — A–C: but A and C are already joined through A–B–C (highlighted). Adding it would close a cycle → skip.',
    cd: '4 — C–D brings in D. Add it.',
    de: '5 — D–E brings in E. Add it.',
    be: '6 — B–E: B and E are already connected via B–C–D–E (highlighted) → cycle → skip.',
    ef: '7 — E–F brings in the last node F. Five edges now join all six nodes: the tree is complete.',
    cf: '8 — C–F would also close a cycle (C–D–E–F) → skip. Kruskal stops once n−1 = 5 edges are chosen.',
    done: 'Minimum spanning tree = A–B, B–C, C–D, D–E, E–F, total weight 1+2+4+5+7 = 19.',
  },
  fr: {
    intro:
      'Arbre couvrant minimal de Kruskal : on trie les arêtes par poids, puis on prend chacune à son tour — on l’AJOUTE si ses extrémités sont dans des arbres différents, on l’ÉCARTE si elles sont déjà reliées (cela fermerait un cycle).',
    ab: '1 — A–B relie deux nœuds isolés. On l’ajoute.',
    bc: '2 — B–C fait entrer C. On l’ajoute.',
    ac: '3 — A–C : mais A et C sont déjà reliés par A–B–C (en surbrillance). L’ajouter fermerait un cycle → on l’écarte.',
    cd: '4 — C–D fait entrer D. On l’ajoute.',
    de: '5 — D–E fait entrer E. On l’ajoute.',
    be: '6 — B–E : B et E sont déjà reliés via B–C–D–E (en surbrillance) → cycle → on l’écarte.',
    ef: '7 — E–F fait entrer le dernier nœud F. Cinq arêtes relient les six nœuds : l’arbre est complet.',
    cf: '8 — C–F fermerait aussi un cycle (C–D–E–F) → on l’écarte. Kruskal s’arrête dès que n−1 = 5 arêtes sont choisies.',
    done: 'Arbre couvrant minimal = A–B, B–C, C–D, D–E, E–F, poids total 1+2+4+5+7 = 19.',
  },
};

export const mst = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  return {
    direction: 'graph',
    // No coordinates: the engine auto-places the nodes (minimizing edge
    // crossings), so each rejected cycle (B–C–D–E, C–D–E–F) reads as a clean loop.
    nodes: ['A', 'B', 'C', 'D', 'E', 'F'].map(N),
    connections: [
      E('ab', 'A', 'B', 1),
      E('bc', 'B', 'C', 2),
      E('ac', 'A', 'C', 3),
      E('cd', 'C', 'D', 4),
      E('de', 'D', 'E', 5),
      E('be', 'B', 'E', 6),
      E('ef', 'E', 'F', 7),
      E('cf', 'C', 'F', 8),
    ],
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4000 },
      accept('ab', ['A', 'B'], 'A', s.ab),
      accept('bc', ['C'], 'C', s.bc),
      reject('ac', ['ab', 'bc'], 'A', s.ac),
      accept('cd', ['D'], 'D', s.cd),
      accept('de', ['E'], 'E', s.de),
      reject('be', ['bc', 'cd', 'de'], 'E', s.be),
      accept('ef', ['F'], 'F', s.ef),
      reject('cf', ['cd', 'de', 'ef'], 'F', s.cf),
      { type: 'comment', text: s.done, keep_until_end: true },
      { type: 'wait', duration: 1600 },
    ],
  };
};
