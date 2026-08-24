import { describe, expect, it } from 'vitest';
import type { DataFlowSpec, TreeSpec } from '../types';
import {
  computeLayout,
  connectionAxis,
  treeEdges,
  treeEdgeStyle,
  treeLayout,
} from './layout';

describe('computeLayout — linear', () => {
  it('left-to-right: increasing lane = increasing x', () => {
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'a', type: 'client', lane: 1 },
        { id: 'b', type: 'server', lane: 2 },
        { id: 'c', type: 'database', lane: 3 },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a.cx).toBeLessThan(layout.b.cx);
    expect(layout.b.cx).toBeLessThan(layout.c.cx);
    // aligned vertically (single column per lane)
    expect(layout.a.cy).toBeCloseTo(layout.b.cy);
  });

  it('stacks nodes of the same lane on the transverse axis', () => {
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'a', type: 'user', lane: 1 },
        { id: 'b', type: 'user', lane: 1 },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a.cx).toBeCloseTo(layout.b.cx);
    expect(layout.a.cy).not.toBeCloseTo(layout.b.cy);
  });

  it('centres a lane pair on the stage rather than pushing it to the edges', () => {
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'a', type: 'client', lane: 1 },
        { id: 'b', type: 'server', lane: 2 },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    // One step governs both axes; two lanes sit symmetrically around the centre
    // rather than being stretched to fill the stage.
    expect(layout.a.cx + layout.b.cx).toBeCloseTo(1, 5);
    expect(layout.a.cx).toBeGreaterThan(0);
    expect(layout.b.cx).toBeLessThan(1);
    expect(layout.a.cy).toBeCloseTo(0.5, 5);
    expect(layout.b.cy).toBeCloseTo(0.5, 5);
  });

  it('keeps one constant step whatever the number of lanes', () => {
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: Array.from({ length: 6 }, (_, i) => ({
        id: `n${i}`,
        type: 'server' as const,
        lane: i + 1,
      })),
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    // The gap between neighbours is the same everywhere — the property the old
    // per-axis distribution could not hold, since its step shrank with the
    // count. Six lanes: five identical gaps.
    const gaps = Array.from(
      { length: 5 },
      (_, i) => layout[`n${i + 1}`].cx - layout[`n${i}`].cx
    );
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 5);
    // …and the row stays centred.
    expect(layout.n0.cx + layout.n5.cx).toBeCloseTo(1, 5);
  });

  it('align_with: the aligned node does not collide with free nodes in its lane', () => {
    // Reproduces the bug: lane 1 = [server, db, fcm(align_with)], lane 2 = [alice].
    // Without the fix, fcm inherits cy=alice.cy=0.5, identical to db.cy — collision.
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'alice', type: 'client', lane: 2 },
        { id: 'server', type: 'server', lane: 1 },
        { id: 'db', type: 'database', lane: 1 },
        { id: 'fcm', type: 'cloud', lane: 1, align_with: 'alice' },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    // fcm must be aligned with alice (same cy)
    expect(layout.fcm.cy).toBeCloseTo(layout.alice.cy);
    // free nodes in the same lane must not overlap with fcm/alice
    expect(layout.server.cy).not.toBeCloseTo(layout.alice.cy);
    expect(layout.db.cy).not.toBeCloseTo(layout.alice.cy);
    // free nodes do not overlap each other
    expect(layout.server.cy).not.toBeCloseTo(layout.db.cy);
  });

  it('multiple align_with in the same lane: no collision even if targets have the same initial cy', () => {
    // Problematic config: bob and alice are alone in their lane → cy=0.5 both.
    // Without resolveCollisions, server, token_db and fcm all overlap at cy=0.5.
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'bob', type: 'bob', lane: 1 },
        { id: 'alice', type: 'alice', lane: 3 },
        { id: 'server', type: 'server', lane: 2 },
        { id: 'token_db', type: 'database', lane: 2, align_with: 'bob' },
        { id: 'fcm', type: 'cloud', lane: 2, align_with: 'alice' },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    // No collision in lane 2
    expect(layout.server.cy).not.toBeCloseTo(layout.token_db.cy);
    expect(layout.server.cy).not.toBeCloseTo(layout.fcm.cy);
    expect(layout.token_db.cy).not.toBeCloseTo(layout.fcm.cy);
    // The align_with constraints are still honored
    expect(layout.token_db.cy).toBeCloseTo(layout.bob.cy);
    expect(layout.fcm.cy).toBeCloseTo(layout.alice.cy);
  });

  it('top-to-bottom: increasing lane = increasing y', () => {
    const spec: DataFlowSpec = {
      direction: 'top-to-bottom',
      nodes: [
        { id: 'a', type: 'client', lane: 1 },
        { id: 'b', type: 'server', lane: 2 },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a.cy).toBeLessThan(layout.b.cy);
  });
});

describe('computeLayout — circular', () => {
  it('places main in the center and others around it', () => {
    const spec: DataFlowSpec = {
      direction: 'circular',
      nodes: [
        { id: 'hub', type: 'server', main: true },
        { id: 'n1', type: 'client' },
        { id: 'n2', type: 'client' },
        { id: 'n3', type: 'client' },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec, { aspect: 1 });
    expect(layout.hub).toEqual({ cx: 0.5, cy: 0.5 });
    for (const id of ['n1', 'n2', 'n3']) {
      const d = Math.hypot(layout[id].cx - 0.5, layout[id].cy - 0.5);
      expect(d).toBeGreaterThan(0.2); // on the ring
    }
  });

  it('places all static nodes (connections are not nodes)', () => {
    const spec: DataFlowSpec = {
      direction: 'left-to-right',
      nodes: [
        { id: 'a', type: 'client', lane: 1 },
        { id: 'b', type: 'server', lane: 2 },
      ],
      connections: [{ from: 'a', to: 'b' }],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a).toBeDefined();
    expect(layout.b).toBeDefined();
  });
});

describe('computeLayout — graph', () => {
  /** Straight-edge crossing count (mirrors the engine's own check), so the
   *  auto-layout can be asserted crossing-free. Edges sharing a node are
   *  skipped; a "crossing" is a proper interior intersection. */
  const crossings = (
    layout: Record<string, { cx: number; cy: number }>,
    edges: Array<[string, string]>
  ): number => {
    const o = (
      p: { cx: number; cy: number },
      q: { cx: number; cy: number },
      r: { cx: number; cy: number }
    ) => (q.cx - p.cx) * (r.cy - p.cy) - (q.cy - p.cy) * (r.cx - p.cx);
    let n = 0;
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a1, a2] = edges[i];
        const [b1, b2] = edges[j];
        if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
        const p1 = layout[a1];
        const p2 = layout[a2];
        const p3 = layout[b1];
        const p4 = layout[b2];
        const d1 = o(p3, p4, p1);
        const d2 = o(p3, p4, p2);
        const d3 = o(p1, p2, p3);
        const d4 = o(p1, p2, p4);
        if (
          d1 > 0 !== d2 > 0 &&
          d3 > 0 !== d4 > 0 &&
          d1 !== 0 &&
          d2 !== 0 &&
          d3 !== 0 &&
          d4 !== 0
        )
          n++;
      }
    }
    return n;
  };

  const circleNodes = (ids: string[]): DataFlowSpec['nodes'] =>
    ids.map((id) => ({ id, type: 'circle' as const }));
  const edge = (from: string, to: string) => ({
    from,
    to,
    arrow_head: 'none' as const,
  });

  it('a fully anchored graph is an exact passthrough of x/y', () => {
    const spec: DataFlowSpec = {
      direction: 'graph',
      nodes: [
        { id: 'a', type: 'circle', x: 0.1, y: 0.5 },
        { id: 'b', type: 'circle', x: 0.9, y: 0.2 },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a).toEqual({ cx: 0.1, cy: 0.5 });
    expect(layout.b).toEqual({ cx: 0.9, cy: 0.2 });
  });

  it('a lone node without coordinates falls back to the center', () => {
    const spec: DataFlowSpec = {
      direction: 'graph',
      nodes: [{ id: 'a', type: 'circle' }],
      packets: [],
      timeline: [],
    };
    expect(computeLayout(spec).a).toEqual({ cx: 0.5, cy: 0.5 });
  });

  it('ignores lane / main / align_with on anchored nodes (only x/y matter)', () => {
    const spec: DataFlowSpec = {
      direction: 'graph',
      nodes: [
        { id: 'a', type: 'circle', x: 0.3, y: 0.3, lane: 5, main: true },
        { id: 'b', type: 'circle', x: 0.7, y: 0.7, align_with: 'a' },
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    expect(layout.a).toEqual({ cx: 0.3, cy: 0.3 });
    expect(layout.b).toEqual({ cx: 0.7, cy: 0.7 });
  });

  // Planar graph: a path A–B–C–D–E–F plus the chords A–C, B–E, C–F (the MST
  // demo topology). A crossing-free straight-line embedding exists.
  const planarEdges: Array<[string, string]> = [
    ['A', 'B'],
    ['B', 'C'],
    ['A', 'C'],
    ['C', 'D'],
    ['D', 'E'],
    ['B', 'E'],
    ['E', 'F'],
    ['C', 'F'],
  ];
  const planarSpec: DataFlowSpec = {
    direction: 'graph',
    nodes: circleNodes(['A', 'B', 'C', 'D', 'E', 'F']),
    connections: planarEdges.map(([a, b]) => edge(a, b)),
    packets: [],
    timeline: [],
  };

  it('auto-places coordinate-free nodes with no edge crossings', () => {
    const layout = computeLayout(planarSpec);
    expect(crossings(layout, planarEdges)).toBe(0);
    // and every node lands on the stage
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(layout[id].cx).toBeGreaterThanOrEqual(0);
      expect(layout[id].cx).toBeLessThanOrEqual(1);
      expect(layout[id].cy).toBeGreaterThanOrEqual(0);
      expect(layout[id].cy).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic (no Math.random): two runs are identical', () => {
    expect(computeLayout(planarSpec)).toEqual(computeLayout(planarSpec));
  });

  it('keeps anchored nodes fixed and spreads the free ones around them', () => {
    const spec: DataFlowSpec = {
      direction: 'graph',
      nodes: [
        { id: 'A', type: 'circle', x: 0.05, y: 0.5 },
        ...circleNodes(['B', 'C', 'D', 'E']),
        { id: 'F', type: 'circle', x: 0.95, y: 0.5 },
      ],
      connections: [
        edge('A', 'B'),
        edge('B', 'C'),
        edge('C', 'D'),
        edge('D', 'E'),
        edge('E', 'F'),
        edge('A', 'C'),
        edge('D', 'F'),
      ],
      packets: [],
      timeline: [],
    };
    const layout = computeLayout(spec);
    // anchors are honored exactly
    expect(layout.A).toEqual({ cx: 0.05, cy: 0.5 });
    expect(layout.F).toEqual({ cx: 0.95, cy: 0.5 });
    // free nodes are actually placed (not all stacked at the center)
    const free = ['B', 'C', 'D', 'E'].map((id) => layout[id]);
    const distinct = new Set(
      free.map((p) => `${p.cx.toFixed(3)},${p.cy.toFixed(3)}`)
    );
    expect(distinct.size).toBe(4);
  });
});

describe('computeLayout — circuit (feed-forward DAG)', () => {
  // A diamond: one gate fans out to a top and a bottom branch that re-merge.
  const diamond: DataFlowSpec = {
    direction: 'circuit',
    nodes: [
      { id: 'in', type: 'signal' },
      { id: 'x1', type: 'nand_gate' },
      { id: 'top', type: 'nand_gate' },
      { id: 'bot', type: 'nand_gate' },
      { id: 'out', type: 'signal' },
    ],
    connections: [
      { from: 'in', to: 'x1' },
      { from: 'x1', to: 'top' },
      { from: 'x1', to: 'bot' },
      { from: 'top', to: 'out' },
      { from: 'bot', to: 'out' },
    ],
    packets: [],
    timeline: [],
  };

  it('centres a fan-out / fan-in node between its two branches (median)', () => {
    const layout = computeLayout(diamond);
    const lo = Math.min(layout.top.cy, layout.bot.cy);
    const hi = Math.max(layout.top.cy, layout.bot.cy);
    const mid = (lo + hi) / 2;
    expect(hi - lo).toBeGreaterThan(0.05); // the branches are spread apart
    // The fan-out gate and the merge pad both sit on the branch midline instead
    // of clinging to rank 0 — the balanced-schematic property the median gives.
    expect(layout.x1.cy).toBeCloseTo(mid, 5);
    expect(layout.out.cy).toBeCloseTo(mid, 5);
  });

  it('aligns each layer on one vertical rail (no x-stagger)', () => {
    const layout = computeLayout(diamond);
    expect(layout.top.cx).toBeCloseTo(layout.bot.cx, 6); // same column ⇒ same x
    expect(layout.in.cx).toBeLessThan(layout.x1.cx); // layers march left→right
    expect(layout.x1.cx).toBeLessThan(layout.top.cx);
    expect(layout.top.cx).toBeLessThan(layout.out.cx);
  });

  // The NAND full adder of the docs gallery (`demos/fullAdderNand.ts`): three input
  // pads feeding nine gates. Its input column is the case least squares handles
  // worst — A, B and Cin all want a rail between roughly the same two slots but must
  // stay a slot apart, so the isotonic optimum parks all three BETWEEN the rails
  // their wires aim at and not one lead out of six leaves straight.
  const fullAdder: DataFlowSpec = {
    direction: 'circuit',
    nodes: [
      { id: 'A', type: 'signal' },
      { id: 'B', type: 'signal' },
      { id: 'Cin', type: 'signal' },
      ...['x1', 'x2', 'x3', 'ab', 'x5', 'x6', 'x7', 'nSum', 'nCout'].map(
        (id) => ({ id, type: 'nand_gate' as const })
      ),
      { id: 'sumOut', type: 'signal' },
      { id: 'coutOut', type: 'signal' },
    ],
    connections: [
      ...(
        [
          ['x1', 'A', 'B'],
          ['x2', 'A', 'x1:y'],
          ['x3', 'x1:y', 'B'],
          ['ab', 'x2:y', 'x3:y'],
          ['x5', 'ab:y', 'Cin'],
          ['x6', 'ab:y', 'x5:y'],
          ['x7', 'x5:y', 'Cin'],
          ['nSum', 'x6:y', 'x7:y'],
          ['nCout', 'x5:y', 'x1:y'],
        ] as const
      ).flatMap(([g, a, b]) => [
        { from: a, to: `${g}:a` },
        { from: b, to: `${g}:b` },
      ]),
      { from: 'nSum:y', to: 'sumOut' },
      { from: 'nCout:y', to: 'coutOut' },
    ],
    packets: [],
    timeline: [],
  };

  it('snaps an input pad onto its gate rail rather than splitting the difference', () => {
    const layout = computeLayout(fullAdder);
    // A lands on x2's row and B on x1's and x3's, so those three leads are drawn
    // dead straight — worth the length it adds to A's other wire.
    expect(layout.A.cy).toBeCloseTo(layout.x2.cy, 5);
    expect(layout.B.cy).toBeCloseTo(layout.x1.cy, 5);
    expect(layout.B.cy).toBeCloseTo(layout.x3.cy, 5);
    // The pads stay ordered and spread, never collapsed onto one rail.
    expect(layout.A.cy).toBeLessThan(layout.B.cy);
    expect(layout.B.cy).toBeLessThan(layout.Cin.cy);
  });

  it('never drags an interior gate off its median to win a rail', () => {
    const layout = computeLayout(fullAdder);
    // `ab` merges the two XOR halves and feeds the carry chain: it mediates, so it
    // keeps the midline between its branches. Snapping it would buy one straight
    // wire and pull the whole spine into a single band.
    expect(layout.ab.cy).toBeCloseTo((layout.x2.cy + layout.x3.cy) / 2, 5);
  });

  it('nudges a gate so its input PIN, not its centre, meets its driver rail', () => {
    const layout = computeLayout(fullAdder);
    // x1 drives x3's `a` from the same rail. A gate's output leaves at mid-height
    // and `a` enters at 0.32, so aligned CENTRES still leave the wire a 0.18-body
    // climb: x3 drops by exactly that, and the two share a rail to drop from.
    expect(layout.x3.cy).toBeCloseTo(layout.x1.cy, 5);
    expect(layout.x3.pinNudge).toBeCloseTo(0.5 - 0.32, 5);
    // x5 → x7:a is the same shape one XOR later — the rule is general, not a patch.
    expect(layout.x7.pinNudge).toBeCloseTo(0.5 - 0.32, 5);
  });

  it('leaves a gate alone when it is not on its driver rail', () => {
    const layout = computeLayout(fullAdder);
    // x2 takes x1's output on `b` but sits a row above it: the wire has to turn
    // anyway, and a sub-body nudge cannot buy that back.
    expect(layout.x2.cy).not.toBeCloseTo(layout.x1.cy, 5);
    expect(layout.x2.pinNudge).toBeUndefined();
  });

  it('nudges a signal PAD onto the gate pin it faces on its rail', () => {
    const layout = computeLayout(fullAdder);
    // A pad's port is welded to its face centre, so the only way to straighten its
    // lead into a gate's `a` (at 0.32) is to move the PAD itself.
    expect(layout.A.cy).toBeCloseTo(layout.x2.cy, 5);
    expect(layout.A.pinNudge).toBeCloseTo(0.32 - 0.5, 5);
    // Resolved against the GATE's height, not the pad's: a pad is not a gate's size,
    // so the offset it cancels only means anything against the body declaring it.
    expect(layout.A.pinNudgeRef).toBe('x2');
  });

  it('nudges a pad whose two rail partners agree on the move', () => {
    // B feeds `b` (0.68) on BOTH x1 and x3, and shares their rail: different
    // partners, same requested move → the pad takes it and both leads draw straight.
    const layout = computeLayout(fullAdder);
    expect(layout.B.cy).toBeCloseTo(layout.x1.cy, 5);
    expect(layout.B.pinNudge).toBeCloseTo(0.68 - 0.5, 5);
  });

  it('leaves a pad centred when its rail partners pull it opposite ways', () => {
    // One pad drives `a` (up) and `b` (down) of the SAME gate on its rail: no move
    // can straighten both, so the pad stays put rather than favour one wire.
    const layout = computeLayout({
      direction: 'circuit',
      nodes: [
        { id: 'in', type: 'signal' },
        { id: 'g', type: 'nand_gate' },
        { id: 'out', type: 'signal' },
      ],
      connections: [
        { from: 'in', to: 'g:a' },
        { from: 'in', to: 'g:b' },
        { from: 'g:y', to: 'out' },
      ],
      packets: [],
      timeline: [],
    });
    expect(layout.in.cy).toBeCloseTo(layout.g.cy, 5);
    expect(layout.in.pinNudge).toBeUndefined();
    // The gate's output pin IS centred, so the sink pad needs no nudge at all.
    expect(layout.out.pinNudge).toBeUndefined();
  });

  it('leaves a gate alone when both inputs pull it the opposite way', () => {
    // NOT(a NAND a): one driver feeds BOTH pins from the same rail, so `a` wants
    // the gate down and `b` wants it up by as much. Neither wire can win; moving
    // would trade a balanced gate for an arbitrary wire, so it stays put.
    const layout = computeLayout({
      direction: 'circuit',
      nodes: [
        { id: 'in', type: 'signal' },
        { id: 'g', type: 'nand_gate' },
        { id: 'inv', type: 'nand_gate' },
        { id: 'out', type: 'signal' },
      ],
      connections: [
        { from: 'in', to: 'g:a' },
        { from: 'in', to: 'g:b' },
        { from: 'g:y', to: 'inv:a' },
        { from: 'g:y', to: 'inv:b' },
        { from: 'inv:y', to: 'out' },
      ],
      packets: [],
      timeline: [],
    });
    expect(layout.inv.cy).toBeCloseTo(layout.g.cy, 5);
    expect(layout.inv.pinNudge).toBeUndefined();
  });
});

describe('connectionAxis', () => {
  it('left-to-right: inter-lane → horizontal, even with steep slope', () => {
    // significant Δcx (different lanes) → horizontal, regardless of Δcy.
    const a = { cx: 0.2, cy: 0.5 };
    const auth = { cx: 0.8, cy: 0.1 }; // much higher → Δcy > Δcx
    expect(connectionAxis(a, auth, 'left-to-right')).toBe('horizontal');
  });

  it('left-to-right: same lane (same cx) → vertical', () => {
    const a = { cx: 0.5, cy: 0.2 };
    const b = { cx: 0.5, cy: 0.8 };
    expect(connectionAxis(a, b, 'left-to-right')).toBe('vertical');
  });

  it('right-to-left: inter-lane → horizontal', () => {
    expect(
      connectionAxis(
        { cx: 0.8, cy: 0.5 },
        { cx: 0.2, cy: 0.2 },
        'right-to-left'
      )
    ).toBe('horizontal');
  });

  it('top-to-bottom: inter-lane → vertical; same lane → horizontal', () => {
    expect(
      connectionAxis(
        { cx: 0.5, cy: 0.2 },
        { cx: 0.1, cy: 0.8 },
        'top-to-bottom'
      )
    ).toBe('vertical');
    expect(
      connectionAxis(
        { cx: 0.2, cy: 0.5 },
        { cx: 0.8, cy: 0.5 },
        'top-to-bottom'
      )
    ).toBe('horizontal');
  });

  it('circular: dominant axis in pixels (aspect breaks the tie)', () => {
    const a = { cx: 0.2, cy: 0.5 };
    const b = { cx: 0.5, cy: 0.9 }; // Δcx=0.3, Δcy=0.4
    expect(connectionAxis(a, b, 'circular', 1)).toBe('vertical');
    expect(connectionAxis(a, b, 'circular', 3)).toBe('horizontal'); // 0.3×3 > 0.4
  });

  it('graph: dominant axis in pixels, like circular (no flow axis)', () => {
    const a = { cx: 0.2, cy: 0.5 };
    const b = { cx: 0.5, cy: 0.9 }; // Δcx=0.3, Δcy=0.4
    expect(connectionAxis(a, b, 'graph', 1)).toBe('vertical');
    expect(connectionAxis(a, b, 'graph', 3)).toBe('horizontal'); // 0.3×3 > 0.4
  });

  it('tree: parent→child edge always anchors vertically', () => {
    // Even a far-left child one level down stays a North/South attachment.
    expect(
      connectionAxis({ cx: 0.5, cy: 0.2 }, { cx: 0.1, cy: 0.5 }, 'tree')
    ).toBe('vertical');
  });
});

describe('treeLayout', () => {
  //        g(13)
  //       /     \
  //     p(8)    u(17)
  //     /
  //   n(1)
  const ids = ['g', 'p', 'u', 'n'];
  const tree: TreeSpec = {
    root: 'g',
    children: { g: { left: 'p', right: 'u' }, p: { left: 'n' } },
  };

  it('in-order rank drives the horizontal order (BST → sorted keys)', () => {
    const m = treeLayout(ids, tree);
    // In-order traversal is 1, 8, 13, 17 → n < p < g < u on the x axis.
    expect(m.n.cx).toBeLessThan(m.p.cx);
    expect(m.p.cx).toBeLessThan(m.g.cx);
    expect(m.g.cx).toBeLessThan(m.u.cx);
  });

  it('depth drives the vertical position (root on top)', () => {
    const m = treeLayout(ids, tree);
    expect(m.g.cy).toBeLessThan(m.p.cy); // root above its children
    expect(m.p.cy).toBeCloseTo(m.u.cy); // same depth → same row
    expect(m.p.cy).toBeLessThan(m.n.cy); // grandchild below
  });

  it('a rotation preserves the in-order x order (only depths change)', () => {
    const before = treeLayout(ids, tree);
    // Left rotation around g: u becomes root, g its left child.
    const rotated: TreeSpec = {
      root: 'u',
      children: { u: { left: 'g' }, g: { left: 'p' }, p: { left: 'n' } },
    };
    const after = treeLayout(ids, rotated);
    // Horizontal slots unchanged: same in-order sequence n < p < g < u.
    for (const id of ids) expect(after[id].cx).toBeCloseTo(before[id].cx);
    // ...but u rose to the top and g sank one level.
    expect(after.u.cy).toBeLessThan(before.u.cy);
    expect(after.g.cy).toBeGreaterThan(before.g.cy);
  });

  it('treeEdges lists parent→child pairs (left then right)', () => {
    expect(treeEdges(tree)).toEqual(
      expect.arrayContaining([
        ['g', 'p'],
        ['g', 'u'],
        ['p', 'n'],
      ])
    );
    expect(treeEdges(tree)).toHaveLength(3);
  });

  it('a node unreachable from the root falls back to the center', () => {
    const m = treeLayout(['g', 'orphan'], { root: 'g', children: {} });
    expect(m.orphan).toEqual({ cx: 0.5, cy: 0.5 });
  });
});

describe('treeEdgeStyle', () => {
  const tree: TreeSpec = {
    root: 'g',
    children: { g: { left: 'p', right: 'u' }, p: { left: 'n' } },
  };

  it('applies the tree edge defaults (straight, solid, no head)', () => {
    expect(treeEdgeStyle(tree, 'p')).toEqual({
      style: 'solid',
      path: 'straight',
      arrow_head: 'none',
      text: undefined,
      color: undefined,
      highlighted: false,
    });
  });

  it('the tree-wide `edge_style` default applies to every edge', () => {
    const styled: TreeSpec = { ...tree, edge_style: { path: 'step' } };
    expect(treeEdgeStyle(styled, 'p').path).toBe('step');
    expect(treeEdgeStyle(styled, 'u').path).toBe('step');
  });

  it('a per-edge override merges over the default (keyed by child id)', () => {
    const styled: TreeSpec = {
      ...tree,
      edge_style: { path: 'step', color: 'gray' },
      edges: { p: { style: 'dashed', color: 'crimson' } },
    };
    // Edge above `p`: override wins on style/color, keeps the default path.
    expect(treeEdgeStyle(styled, 'p')).toMatchObject({
      style: 'dashed',
      path: 'step',
      color: 'crimson',
    });
    // Edge above `u`: only the default applies.
    expect(treeEdgeStyle(styled, 'u')).toMatchObject({
      style: 'solid',
      path: 'step',
      color: 'gray',
    });
  });
});
