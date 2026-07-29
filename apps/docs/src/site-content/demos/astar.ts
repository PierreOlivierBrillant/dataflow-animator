import type { DataFlowSpec } from '@dataflow-animator/react';
import type { Locale } from '../../i18n';

// A* on a grid with a WALL (direction:'graph', nodes placed by x/y). A* ranks
// open cells by f = g + h (cost so far + Manhattan distance still to go) and
// always expands the smallest f. The wall in column 1 blocks the straight line,
// so the search has to skirt it through the bottom row — a real choice, not a
// straight shot. Decomposed for students: one step per expansion, each showing
// the newly discovered frontier cells and their f-badge. The punchline: A*
// expands only the 6 cells along the detour and leaves the f=5/f=7 cells in the
// frontier unexpanded — the heuristic keeps it aimed at G, unlike Dijkstra.
//
// Grid 4×3, S = r1c0, G = r1c3, walls r0c1 & r1c1. Optimal path (length 5):
// r1c0→r2c0→r2c1→r2c2→r1c2→r1c3. Coordinates and f-values are language-invariant.
const CLOSED = '#0d9488'; // teal — expanded (closed) cell
const FRONTIER = '#b45309'; // amber — discovered, still in the open set
const PATH = '#16a34a'; // green — final path
const WALL = '#334155'; // slate — impassable cell
const INK = 'white';

const COLS = 4;
const ROWS = 3;
const nid = (r: number, c: number) => `r${r}c${c}`;
const WALLS = new Set(['r0c1', 'r1c1']);
const START = 'r1c0';
const GOAL = 'r1c3';

/** Grid nodes and 4-connected unit edges, skipping the wall cells. */
function buildGrid(): {
  nodes: DataFlowSpec['nodes'];
  connections: NonNullable<DataFlowSpec['connections']>;
} {
  const nodes: DataFlowSpec['nodes'] = [];
  const connections: NonNullable<DataFlowSpec['connections']> = [];
  const open = (r: number, c: number) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && !WALLS.has(nid(r, c));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = nid(r, c);
      const wall = WALLS.has(id);
      nodes.push({
        id,
        type: 'circle',
        body: id === START ? 'S' : id === GOAL ? 'G' : '',
        x: 0.12 + (c * 0.76) / (COLS - 1),
        y: 0.2 + (r * 0.6) / (ROWS - 1),
        ...(wall ? { background_color: WALL, border_color: WALL } : {}),
      });
      if (wall) continue;
      if (open(r, c + 1))
        connections.push({
          id: `h${r}${c}`,
          from: id,
          to: nid(r, c + 1),
          text: '1',
          path: 'straight',
          arrow_head: 'none',
        });
      if (open(r + 1, c))
        connections.push({
          id: `v${r}${c}`,
          from: id,
          to: nid(r + 1, c),
          text: '1',
          path: 'straight',
          arrow_head: 'none',
        });
    }
  }
  return { nodes, connections };
}

// One-action helpers (each goes inside a parallel step).
const close = (id: string): DataFlowSpec['timeline'][number] => ({
  type: 'set_color',
  object: id,
  background_color: CLOSED,
  text_color: INK,
});
const discover = (id: string, f: string): DataFlowSpec['timeline'][number] => ({
  type: 'parallel',
  actions: [
    {
      type: 'set_color',
      object: id,
      background_color: FRONTIER,
      text_color: INK,
    },
    { type: 'set_icon', object: id, icon: f },
  ],
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
      'A* explores a grid from S to G, each move costing 1. It ranks open cells by f = g + h — cost so far plus the Manhattan distance still to go — and expands the smallest f. The dark cells are walls.',
    s: 'Open S: g=0, h=3, f=3. Expand it. The two neighbours get f=5; the wall in column 1 blocks the straight route.',
    e1: 'The frontier ties at f=5. Take the cell skirting the wall (bottom row) and expand it: it opens the next cell, again f=5.',
    e2: 'Expand, f=5. g grows by 1, h shrinks by 1 — f stays 5 all along the detour.',
    e3: 'Expand, f=5. It opens two cells at f=5, including the way back up toward G.',
    e4: 'Expand, f=5. G is now reachable at f=5. The cell above has f=7 (it points away from G).',
    g: 'G leaves the frontier with f=5 → shortest path found, length 5.',
    done: 'Path around the wall, length 5. A* expanded just 6 cells and left the f=5 and f=7 cells unexpanded — the heuristic kept it aimed at G, where Dijkstra would have flooded outward.',
  },
  fr: {
    intro:
      'A* explore une grille de S à G, chaque pas coûtant 1. Il classe les cases ouvertes par f = g + h — coût déjà payé plus la distance de Manhattan restante — et développe le plus petit f. Les cases sombres sont des murs.',
    s: 'On ouvre S : g=0, h=3, f=3. On le développe. Les deux voisins reçoivent f=5 ; le mur en colonne 1 bloque la route directe.',
    e1: 'Le front est à égalité à f=5. On prend la case qui contourne le mur (rangée du bas) et on la développe : elle ouvre la suivante, encore f=5.',
    e2: 'On développe, f=5. g augmente de 1, h diminue de 1 — f reste 5 tout le long du détour.',
    e3: 'On développe, f=5. Deux cases s’ouvrent à f=5, dont le chemin qui remonte vers G.',
    e4: 'On développe, f=5. G est désormais atteignable à f=5. La case au-dessus vaut f=7 (elle s’éloigne de G).',
    g: 'G quitte le front avec f=5 → plus court chemin trouvé, longueur 5.',
    done: 'Chemin contournant le mur, longueur 5. A* n’a développé que 6 cases et laissé les cases f=5 et f=7 non développées — l’heuristique l’a gardé pointé vers G, là où Dijkstra aurait inondé alentour.',
  },
};

export const astar = (locale: Locale): DataFlowSpec => {
  const s = strings[locale];
  const { nodes, connections } = buildGrid();
  const pathNodes = ['r1c0', 'r2c0', 'r2c1', 'r2c2', 'r1c2', 'r1c3'];
  const pathEdges = ['v10', 'h20', 'h21', 'v12', 'h12'];
  return {
    direction: 'graph',
    nodes,
    connections,
    packets: [],
    timeline: [
      { type: 'comment', text: s.intro, duration: 4400 },
      {
        type: 'parallel',
        actions: [
          close('r1c0'),
          { type: 'set_icon', object: 'r1c0', icon: '3' },
          discover('r0c0', '5'),
          discover('r2c0', '5'),
          say('r1c0', s.s),
        ],
      },
      {
        type: 'parallel',
        actions: [close('r2c0'), discover('r2c1', '5'), say('r2c0', s.e1)],
      },
      {
        type: 'parallel',
        actions: [close('r2c1'), discover('r2c2', '5'), say('r2c1', s.e2)],
      },
      {
        type: 'parallel',
        actions: [
          close('r2c2'),
          discover('r2c3', '5'),
          discover('r1c2', '5'),
          say('r2c2', s.e3),
        ],
      },
      {
        type: 'parallel',
        actions: [
          close('r1c2'),
          discover('r1c3', '5'),
          discover('r0c2', '7'),
          say('r1c2', s.e4),
        ],
      },
      { type: 'parallel', actions: [close('r1c3'), say('r1c3', s.g)] },
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
      { type: 'wait', duration: 1800 },
    ],
  };
};
