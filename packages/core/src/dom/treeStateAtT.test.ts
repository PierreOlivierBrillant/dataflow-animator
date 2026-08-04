import { describe, expect, it } from 'vitest';
import { computeTreeStateAtT } from './treeStateAtT';
import { compile } from '../engine/compiler';
import { evaluate } from '../engine/timeline';
import { computeLayout } from '../engine/layout';
import type { DataFlowSpec } from '../types';

/**
 * A left-leaning tree that a right rotation around `g` rebalances: `p` takes
 * the root, `g` becomes its right child.
 *
 *        g              p
 *       / \            / \
 *      p   u    →     n   g
 *     /                    \
 *    n                      u
 */
const spec: DataFlowSpec = {
  direction: 'tree',
  tree: {
    root: 'g',
    children: { g: { left: 'p', right: 'u' }, p: { left: 'n' } },
  },
  nodes: ['g', 'p', 'u', 'n'].map((id) => ({
    id,
    type: 'simple_node' as const,
    text: id,
  })),
  packets: [],
  // The trailing wait is not decoration: `evaluate` holds nothing past the end
  // of the timeline, so probing what a finished clip still carries needs the
  // timeline to run on past it.
  timeline: [
    { type: 'rotate_subtree', id: 'rot', object: 'g', rotation: 'right' },
    { type: 'wait', duration: 6_000 },
  ],
};

const layout = computeLayout(spec);

/** State at `t`, through the real compile → evaluate path. */
function stateAt(t: number, over?: Partial<DataFlowSpec>) {
  const full = { ...spec, ...over };
  const { timeline } = compile(full);
  return {
    state: computeTreeStateAtT(
      full,
      computeLayout(full),
      evaluate(timeline, t),
      t
    ),
    timeline,
  };
}

describe('computeTreeStateAtT — at rest', () => {
  it('draws every parent→child edge of the spec topology', () => {
    const { state } = stateAt(0, { timeline: [] });

    expect(state.edges.map((e) => [e.from, e.to])).toEqual(
      expect.arrayContaining([
        ['g', 'p'],
        ['g', 'u'],
        ['p', 'n'],
      ])
    );
    expect(state.edges).toHaveLength(3);
  });

  it('keeps the static layout — the very object — and reports no reflow', () => {
    const state = computeTreeStateAtT({ ...spec, timeline: [] }, layout, [], 0);

    expect(state.reflowing).toBe(false);
    // Identity, not equality: at rest there is nothing to interpolate, so the
    // frame must not pay for a copy of the layout.
    expect(state.layout).toBe(layout);
  });

  it('draws every edge in full when nothing was revealed', () => {
    const { state } = stateAt(0, { timeline: [] });

    for (const edge of state.edges) expect(edge.progress).toBe(1);
  });

  it('yields nothing at all for a spec with no tree block', () => {
    const state = computeTreeStateAtT(
      { ...spec, tree: undefined },
      layout,
      [],
      0
    );

    expect(state).toEqual({ layout, edges: [], reflowing: false });
  });
});

describe('computeTreeStateAtT — a rotation in flight', () => {
  /** Mid-rotation instant, read off the compiled clip rather than guessed. */
  const midpoint = (): number => {
    const { timeline } = compile(spec);
    const clip = timeline.clips.find((c) => c.kind === 'reflow')!;
    return (clip.animStartMs + clip.endMs) / 2;
  };

  it('interpolates the node placements between the two layouts', () => {
    const t = midpoint();
    const { state } = stateAt(t);

    expect(state.reflowing).toBe(true);
    // `p` rises toward the root and `g` sinks: mid-rotation both sit strictly
    // between where they started and where they land.
    const after = computeLayout({
      ...spec,
      tree: {
        root: 'p',
        children: { p: { left: 'n', right: 'g' }, g: { right: 'u' } },
      },
    });
    expect(state.layout.p.cy).toBeGreaterThan(after.p.cy);
    expect(state.layout.p.cy).toBeLessThan(layout.p.cy);
    expect(state.layout.g.cy).toBeGreaterThan(layout.g.cy);
    expect(state.layout.g.cy).toBeLessThan(after.g.cy);
  });

  it('draws the POST-rotation edges as soon as the nodes start moving', () => {
    const { state } = stateAt(midpoint());

    // `g→p` is gone the moment the rotation opens; `p→g` has replaced it.
    expect(state.edges.map((e) => `${e.from}→${e.to}`).sort()).toEqual([
      'g→u',
      'p→g',
      'p→n',
    ]);
  });

  it('holds the post-rotation layout once the rotation has settled', () => {
    const { timeline } = compile(spec);
    const clip = timeline.clips.find((c) => c.kind === 'reflow')!;
    const { state } = stateAt(clip.endMs + 4_000);

    // The clip stays active (keepEnd), so the reached layout persists rather
    // than snapping back to the static one.
    expect(state.reflowing).toBe(true);
    expect(state.layout.p.cy).toBeCloseTo(clip.toLayout.p.cy);
    expect(state.layout.g.cy).toBeCloseTo(clip.toLayout.g.cy);
  });
});

describe('computeTreeStateAtT — an edge drawn in after its child', () => {
  const reveal: Partial<DataFlowSpec> = {
    nodes: [
      ...spec.nodes.slice(0, 3),
      { id: 'n', type: 'simple_node', text: 'n', visible: false },
    ],
    timeline: [
      { type: 'set_visible', id: 'rev', object: 'n', visible: true },
      { type: 'wait', duration: 6_000 },
    ],
  };

  /** End of the reveal — the instant its edge starts growing. */
  const revealEnd = (): number => {
    const { timeline } = compile({ ...spec, ...reveal });
    return timeline.clips.find((c) => c.kind === 'set_visible')!.endMs;
  };

  it('leaves the edge undrawn while its child is still appearing', () => {
    const { state } = stateAt(revealEnd(), reveal);

    expect(state.edges.find((e) => e.to === 'n')!.progress).toBe(0);
  });

  it('grows it from the parent once the child has landed', () => {
    const end = revealEnd();
    const { state } = stateAt(end + 225, reveal);
    const drawing = state.edges.find((e) => e.to === 'n')!;

    expect(drawing.progress).toBeGreaterThan(0);
    expect(drawing.progress).toBeLessThan(1);
    // Its siblings were never revealed, so they stay fully drawn throughout.
    for (const edge of state.edges.filter((e) => e.to !== 'n'))
      expect(edge.progress).toBe(1);
  });

  it('completes the edge, and holds it, once the draw-in is over', () => {
    const { state } = stateAt(revealEnd() + 4_000, reveal);

    expect(state.edges.find((e) => e.to === 'n')!.progress).toBe(1);
  });

  it('re-draws the edge in full when the child is hidden again', () => {
    const hidden: Partial<DataFlowSpec> = {
      ...reveal,
      timeline: [
        { type: 'set_visible', id: 'rev', object: 'n', visible: true },
        { type: 'set_visible', id: 'hide', object: 'n', visible: false },
        { type: 'wait', duration: 6_000 },
      ],
    };
    const { timeline } = compile({ ...spec, ...hidden });
    const hide = timeline.clips.filter((c) => c.kind === 'set_visible')[1];
    const { state } = stateAt(hide.endMs + 10, hidden);

    // The node is gone, so nothing anchors the edge and there is no reveal left
    // to stagger it against: the draw-in resets rather than replaying from the
    // stale instant the node last appeared at.
    expect(state.edges.find((e) => e.to === 'n')!.progress).toBe(1);
  });
});
