/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountStage, type StageOptions } from './mount';
import type { Density } from '../engine/scale';
import { compile } from '../engine/compiler';
import type { DataFlowSpec } from '../types';
import { normalizeStageHtml } from './normalizeHtml';

/**
 * Orchestration-level assertions only: layer order, teardown, and the
 * convergence budget. What each layer LOOKS like is covered by the per-module
 * suites, and whether it matches React is settled by the A/B pixel gate, which
 * is a far stronger check than anything assertable in jsdom (which lays nothing
 * out — every rect here is 0×0).
 */

const spec: DataFlowSpec = {
  nodes: [
    { id: 'a', type: 'server', text: 'A', lane: 1 },
    { id: 'b', type: 'database', text: 'B', lane: 2 },
  ],
  packets: [],
  timeline: [],
  connections: [{ from: 'a', to: 'b' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function mount(over?: Partial<DataFlowSpec>, t = 0, options?: StageOptions) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const handle = mountStage(container, { ...spec, ...over }, t, options);
  return { container, handle };
}

/** A `code` panel is the only thing that reaches the highlighter. */
const codeSpec: Partial<DataFlowSpec> = {
  nodes: [
    {
      id: 'a',
      type: 'simple_node',
      text: 'A',
      lane: 1,
      content: { type: 'code', value: 'SELECT 1', language: 'sql' },
    },
  ],
  connections: [],
};

describe('mountStage — structure', () => {
  it('roots the render in .rdfa-stage', () => {
    const { container } = mount();

    expect(container.querySelector('.rdfa-stage')).not.toBeNull();
  });

  it('emits one .rdfa-node per visible node, keyed by data-node-id', () => {
    const { container } = mount();
    const ids = [...container.querySelectorAll('[data-node-id]')].map((el) =>
      el.getAttribute('data-node-id')
    );

    expect(ids).toEqual(['a', 'b']);
  });

  it('lays the arrow SVG and the overlay out in React`s document order', () => {
    const { container } = mount();
    const stage = container.querySelector('.rdfa-stage');
    const classes = [...(stage?.children ?? [])].map((el) =>
      el.getAttribute('class')
    );

    // Zones (none here) → arrows → nodes → zone labels → overlay. The two
    // overlay layers must exist even while empty: z-index ties between zones
    // and nodes break on source order.
    expect(classes[0]).toBe('rdfa-arrow-svg');
    expect(classes[classes.length - 1]).toBe('rdfa-overlay');
  });

  it('publishes the stage scale variables', () => {
    const { container } = mount();
    const stage = container.querySelector<HTMLElement>('.rdfa-stage');

    expect(stage?.style.getPropertyValue('--rdfa-scale')).not.toBe('');
    expect(stage?.style.getPropertyValue('--rdfa-maxw')).toMatch(/px$/);
  });

  it('hides the stage until it has been measured', () => {
    // jsdom reports a 0×0 rect, which is exactly the pre-measurement case.
    const { container } = mount();

    expect(
      container.querySelector<HTMLElement>('.rdfa-stage')?.style.visibility
    ).toBe('hidden');
  });

  it('drops a node hidden by `visible: false` from the DOM entirely', () => {
    const { container } = mount({
      nodes: [
        { id: 'a', type: 'server', text: 'A', lane: 1 },
        { id: 'b', type: 'database', text: 'B', lane: 2, visible: false },
      ],
    });

    expect(container.querySelector('[data-node-id="b"]')).toBeNull();
    expect(container.querySelector('[data-node-id="a"]')).not.toBeNull();
  });

  it('renders labels and pictograms inside the node', () => {
    const { container } = mount();
    const node = container.querySelector('[data-node-id="a"]');

    expect(node?.querySelector('.rdfa-node-visual')).not.toBeNull();
    expect(node?.querySelector('.rdfa-node-icon svg')).not.toBeNull();
    expect(node?.querySelector('.rdfa-node-label')?.textContent).toBe('A');
  });
});

describe('mountStage — dynamic clips', () => {
  // Two sequential steps: the move owns [0, ~1000), the arrow the step after.
  // Probing inside each step proves a clip is drawn while live and NOT drawn
  // outside its window — the scrubbability the React overlay gets from
  // `evaluate` alone.
  const dynamic: Partial<DataFlowSpec> = {
    packets: [
      {
        id: 'p',
        kind: 'http_packet',
        packet_content: { header: 'GET /' },
      },
    ],
    timeline: [
      {
        type: 'move',
        id: 'm1',
        object: 'p',
        from: 'a',
        to: 'b',
        duration: 1000,
      },
      { type: 'arrow', id: 'a1', from: 'a', to: 'b', duration: 600 },
    ],
  };

  it('renders a live move clip as a packet in the overlay', () => {
    const { container } = mount(dynamic, 500);
    const packet = container.querySelector(
      '.rdfa-overlay .rdfa-packet.rdfa-packet-http_packet'
    );

    expect(packet).not.toBeNull();
    expect(packet?.querySelector('.rdfa-packet-header')?.textContent).toBe(
      'GET /'
    );
  });

  it('draws a live arrow clip in the SVG, after the baseline connections', () => {
    // Probe the middle of the arrow clip's own window (read off the compiled
    // timeline — steps carry holds, so a guessed instant would be brittle).
    // The move's step is over by then: one <g> for the connection, one for the
    // arrow clip, and no packet left in the overlay.
    const { timeline } = compile({ ...spec, ...dynamic });
    const arrow = timeline.clips.find((c) => c.kind === 'arrow')!;
    const { container } = mount(dynamic, (arrow.animStartMs + arrow.endMs) / 2);

    expect(container.querySelectorAll('.rdfa-arrow-svg > g')).toHaveLength(2);
    expect(container.querySelector('.rdfa-overlay .rdfa-packet')).toBeNull();
  });

  it('ignores a move clip whose packet id is unknown', () => {
    const { container } = mount(
      {
        ...dynamic,
        timeline: [
          {
            type: 'move',
            id: 'm1',
            object: 'ghost',
            from: 'a',
            to: 'b',
            duration: 1000,
          },
        ],
      },
      500
    );

    expect(container.querySelector('.rdfa-overlay .rdfa-packet')).toBeNull();
  });

  it('renders a live flow clip as charge dots riding the route', () => {
    const { container } = mount(
      {
        timeline: [
          {
            type: 'flow',
            id: 'f1',
            route: ['a', 'b'],
            duration: 1000,
            color: '#ff0000',
          },
        ],
      },
      500
    );
    const dots = container.querySelectorAll<SVGCircleElement>(
      '.rdfa-arrow-svg .rdfa-flow-charge'
    );

    // ~one charge per segment, floored at two (the compiler's default count).
    expect(dots).toHaveLength(2);
    expect(dots[0].style.getPropertyValue('--rdfa-flow')).toBe('#ff0000');
  });
});

describe('mountStage — tree edges', () => {
  /**
   * A `tree` draws no `connections`: its parent→child links are auto-drawn from
   * the topology. Nothing else on the stage emits them, so this is the whole
   * proof that a binary-tree demo has links at all.
   */
  const treeSpec: Partial<DataFlowSpec> = {
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
    connections: [],
    timeline: [],
  };

  it('draws one edge per parent→child pair', () => {
    const { container } = mount(treeSpec);

    expect(container.querySelectorAll('.rdfa-arrow-svg > g')).toHaveLength(3);
  });

  it('styles an edge from the `tree` block, keyed by child id', () => {
    const { container } = mount({
      ...treeSpec,
      tree: {
        ...treeSpec.tree!,
        edge_style: { color: 'gray' },
        edges: { p: { color: 'crimson', text: 'L' } },
      },
    });
    const labelled = [
      ...container.querySelectorAll('.rdfa-arrow-svg > g'),
    ].find((g) => g.textContent === 'L');

    expect(labelled).toBeDefined();
    expect(
      (labelled as SVGGElement).style.getPropertyValue('--rdfa-arrow')
    ).toBe('crimson');
  });

  it('re-links the nodes the way a rotation left them', () => {
    // Edge styling is keyed by CHILD id, so a label names the edge ABOVE that
    // node — which is exactly what a rotation swaps: `p` rises to the root
    // (losing its incoming edge) and `g` sinks under it (gaining one).
    const rotating: Partial<DataFlowSpec> = {
      ...treeSpec,
      tree: {
        ...treeSpec.tree!,
        edges: { p: { text: 'above-p' }, g: { text: 'above-g' } },
      },
      timeline: [
        { type: 'wait', duration: 1_000 },
        { type: 'rotate_subtree', id: 'rot', object: 'g', rotation: 'right' },
        { type: 'wait', duration: 2_000 },
      ],
    };
    const { timeline } = compile({ ...spec, ...rotating });
    const clip = timeline.clips.find((c) => c.kind === 'reflow')!;
    const { container, handle } = mount(rotating, 0);
    const labels = () =>
      [...container.querySelectorAll('.rdfa-arrow-svg > g')].map(
        (g) => g.textContent
      );

    // Before the rotation opens, the spec's own topology is what is drawn.
    expect(labels()).toContain('above-p');
    expect(labels()).not.toContain('above-g');

    handle.update(clip.endMs + 1_000);

    expect(container.querySelectorAll('.rdfa-arrow-svg > g')).toHaveLength(3);
    expect(labels()).toContain('above-g');
    expect(labels()).not.toContain('above-p');
  });

  it('emits no tree edge for a stage that is not a tree', () => {
    const { container } = mount();

    // The baseline `a → b` connection, and nothing auto-drawn beside it.
    expect(container.querySelectorAll('.rdfa-arrow-svg > g')).toHaveLength(1);
  });
});

describe('mountStage — convergence', () => {
  it('stops on the equality bailout rather than on the budget', () => {
    // Nothing moves between passes in jsdom, so the second measurement equals
    // the first and the loop must bail out at once.
    const { handle } = mount();

    expect(handle.converged).toBe(true);
    expect(handle.passes).toBeLessThanOrEqual(4);
  });

  it('never exceeds React`s measurement budget for a non-circuit diagram', () => {
    const { handle } = mount();

    expect(handle.passes).toBeLessThanOrEqual(4);
  });
});

describe('mountStage — teardown', () => {
  it('destroy() detaches the render', () => {
    const { container, handle } = mount();

    expect(container.children).toHaveLength(1);
    handle.destroy();
    expect(container.children).toHaveLength(0);
  });

  it('destroy() disconnects the ResizeObserver', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect;
      }
    );

    mount().handle.destroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('mounts where ResizeObserver does not exist', () => {
    vi.stubGlobal('ResizeObserver', undefined);

    expect(() => {
      const { handle } = mount();
      handle.destroy();
    }).not.toThrow();
  });
});

describe('mountStage — set_content and comments', () => {
  const contentSpec = {
    timeline: [
      {
        type: 'set_content' as const,
        object: 'a',
        content: { type: 'text' as const, value: 'panel' },
        duration: 2000,
      },
    ],
  };

  const commentSpec = (object?: string) => ({
    timeline: [
      { type: 'comment' as const, text: 'hello', object, duration: 2000 },
    ],
  });

  it('builds the panel INSIDE its node, not in the overlay', () => {
    const { container } = mount(contentSpec, 500);

    const node = container.querySelector('[data-node-id="a"]');
    // This is the whole point of step 2.4: a panel makes its node GROW, so it
    // has to be inside the measured box rather than on an absolute layer.
    expect(node?.querySelector('.rdfa-content')).not.toBeNull();
    expect(container.querySelector('.rdfa-overlay .rdfa-content')).toBeNull();
    expect(node?.classList.contains('rdfa-node--content')).toBe(true);
  });

  it('renders a node`s own content with no clip driving it', () => {
    const { container } = mount({
      nodes: [
        {
          id: 'a',
          type: 'server',
          content: { type: 'code', value: 'x', language: 'sql' },
        },
        { id: 'b', type: 'database' },
      ],
    });

    expect(
      container.querySelector('[data-node-id="a"] .rdfa-terminal')
    ).not.toBeNull();
  });

  it('puts an omniscient comment bubble in the overlay', () => {
    const { container } = mount(commentSpec(), 500);

    const bubble = container.querySelector('.rdfa-overlay .rdfa-comment');
    expect(bubble).not.toBeNull();
    // No anchor → the omniscient variant, which has no tail.
    expect(bubble?.classList.contains('rdfa-comment--omniscient')).toBe(true);
    expect(bubble?.querySelector('.rdfa-comment-tail')).toBeNull();
  });

  it('anchors a bubble to its node and gives it a tail', () => {
    const { container } = mount(commentSpec('a'), 500);

    const bubble = container.querySelector('.rdfa-comment');
    expect(bubble?.classList.contains('rdfa-comment--omniscient')).toBe(false);
    expect(bubble?.querySelector('.rdfa-comment-tail')).not.toBeNull();
  });

  it('drops a bubble whose anchor names an unknown node', () => {
    const { container } = mount(commentSpec('nope'), 500);

    // Silently promoting it to an omniscient bubble would invent a layer the
    // React Stage does not draw.
    expect(container.querySelector('.rdfa-comment')).toBeNull();
  });
});

describe('mountStage — update(t), the retained read path', () => {
  const movingSpec: Partial<DataFlowSpec> = {
    packets: [{ id: 'p', kind: 'http_packet' }],
    timeline: [
      {
        type: 'move',
        id: 'm1',
        object: 'p',
        from: 'a',
        to: 'b',
        duration: 1000,
      },
    ],
  };

  it('mutates the existing node elements rather than rebuilding them', () => {
    const { container, handle } = mount(movingSpec, 0);
    const before = [...container.querySelectorAll('[data-node-id]')];

    handle.update(500);
    const after = [...container.querySelectorAll('[data-node-id]')];

    // Element IDENTITY is the assertion: a rebuild would replace these.
    expect(after).toEqual(before);
  });

  it('keeps a packet element alive across the frames of its clip', () => {
    const { container, handle } = mount(movingSpec, 200);
    const first = container.querySelector('.rdfa-packet');
    expect(first).not.toBeNull();

    handle.update(600);

    expect(container.querySelector('.rdfa-packet')).toBe(first);
  });

  it('creates a packet when its clip opens and drops it when it closes', () => {
    const { container, handle } = mount(movingSpec, 0);

    handle.update(500);
    expect(container.querySelectorAll('.rdfa-packet')).toHaveLength(1);

    handle.update(5000);
    expect(container.querySelectorAll('.rdfa-packet')).toHaveLength(0);
  });

  it('adds and removes nodes as set_visible reveals and hides them', () => {
    const hidden: Partial<DataFlowSpec> = {
      nodes: [
        { id: 'a', type: 'server', text: 'A', lane: 1 },
        { id: 'b', type: 'database', text: 'B', lane: 2, visible: false },
      ],
      timeline: [
        {
          type: 'set_visible',
          id: 'v1',
          object: 'b',
          visible: true,
          duration: 500,
        },
      ],
    };
    const { container, handle } = mount(hidden, 0);
    const present = () =>
      [...container.querySelectorAll('[data-node-id]')].map((el) =>
        el.getAttribute('data-node-id')
      );

    expect(present()).toEqual(['a']);
    handle.update(500);
    expect(present()).toEqual(['a', 'b']);
  });

  // A ResizeObserver holds its targets STRONGLY: whatever is still in this set
  // is still alive, detached or not.
  it('stops retaining the element a set_visible hide removed', () => {
    const live = new Set<Element>();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(el: Element) {
          live.add(el);
        }
        unobserve(el: Element) {
          live.delete(el);
        }
        disconnect() {
          live.clear();
        }
      }
    );
    const cycling: Partial<DataFlowSpec> = {
      timeline: [
        {
          type: 'set_visible',
          id: 'hide',
          object: 'b',
          visible: false,
          duration: 500,
        },
        {
          type: 'set_visible',
          id: 'show',
          object: 'b',
          visible: true,
          duration: 500,
        },
      ],
    };
    // Read the windows off the compiled timeline: steps carry holds, so guessed
    // instants would be brittle.
    const { timeline } = compile({ ...spec, ...cycling });
    const [hide, show] = timeline.clips.filter((c) => c.kind === 'set_visible');
    const { container, handle } = mount(cycling, 0);
    const nodeB = () => container.querySelector('[data-node-id="b"]');
    const first = nodeB()!;
    expect(live.has(first)).toBe(true);

    handle.update(hide.endMs);
    expect(nodeB()).toBeNull();
    handle.update(show.endMs);

    const second = nodeB()!;
    // The reconciliation builds a NEW element rather than recycling the old
    // one, so the old one is only reachable through the observer.
    expect(second).not.toBe(first);
    expect(live.has(first)).toBe(false);
    expect(live.has(second)).toBe(true);
  });

  it('walking to t lands on the same markup as mounting there directly', () => {
    // The jsdom counterpart of the mount-vs-update gate: no layout here, so it
    // proves the STRUCTURE converges, while the browser gate proves the
    // measured geometry does too.
    const walked = mount(movingSpec, 0);
    walked.handle.update(300);
    walked.handle.update(700);
    const fresh = mount(movingSpec, 700);

    expect(normalizeStageHtml(walked.container.firstElementChild!)).toBe(
      normalizeStageHtml(fresh.container.firstElementChild!)
    );
  });
});

describe('mountStage — teardown', () => {
  it('detaches the tree and disconnects the observer', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      }
    );
    const { container, handle } = mount();

    handle.destroy();

    expect(container.querySelector('.rdfa-stage')).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });

  // Retained mode plus a live observer is exactly the combination that leaks:
  // repeated cycles must not accumulate anything in the document.
  it('leaves nothing behind over repeated mount/destroy cycles', () => {
    for (let i = 0; i < 20; i++) {
      const { container, handle } = mount(undefined, 250);
      handle.update(500);
      handle.destroy();
      container.remove();
    }

    expect(document.body.querySelectorAll('.rdfa-stage')).toHaveLength(0);
    expect(document.body.children).toHaveLength(0);
  });
});

/**
 * These three options were declared before they were wired: the stage hardcoded
 * `'comfortable'` and `highlightCode`, and had no debug layer at all. A caller
 * setting them got silence. What follows asserts they are genuinely CONSUMED,
 * not just accepted.
 */
describe('mountStage — options', () => {
  it('feeds density into the stage model', () => {
    const scaleFor = (density: Density): string | undefined => {
      const { container } = mount(undefined, 0, { density });
      const stage = container.querySelector<HTMLElement>('.rdfa-stage');
      return stage?.style.getPropertyValue('--rdfa-scale');
    };

    const compact = scaleFor('compact');
    const comfortable = scaleFor('comfortable');
    const spacious = scaleFor('spacious');

    expect(new Set([compact, comfortable, spacious]).size).toBe(3);
  });

  it('defaults density to comfortable, as an options-free call always did', () => {
    const { container: withOptions } = mount(undefined, 0, {
      density: 'comfortable',
    });
    const { container: without } = mount();

    expect(
      without.querySelector<HTMLElement>('.rdfa-stage')?.style.cssText
    ).toBe(
      withOptions.querySelector<HTMLElement>('.rdfa-stage')?.style.cssText
    );
  });

  it('keeps density after a remeasure, not only on the first pass', () => {
    const { container, handle } = mount(undefined, 0, { density: 'spacious' });
    const stage = container.querySelector<HTMLElement>('.rdfa-stage');
    const before = stage?.style.getPropertyValue('--rdfa-scale');

    handle.update(250);

    expect(stage?.style.getPropertyValue('--rdfa-scale')).toBe(before);
  });

  // The regression this closes: `highlight` reached the JSON dialog but never
  // the stage, so a consumer's highlighter silently stopped colouring panels.
  it('passes the highlighter through to panel content', () => {
    const highlight = vi.fn(() => '<em>marked</em>');

    const { container } = mount(codeSpec, 0, { highlight });

    expect(highlight).toHaveBeenCalledWith('SELECT 1', 'sql');
    expect(container.querySelector('.rdfa-code')?.innerHTML).toContain(
      '<em>marked</em>'
    );
  });

  it('renders no debug overlay unless asked', () => {
    const { container } = mount();

    expect(container.querySelector('.rdfa-debug')).toBeNull();
  });

  it('renders the debug overlay as the last child of the stage', () => {
    const { container } = mount(undefined, 0, { debug: true });
    const stage = container.querySelector('.rdfa-stage');

    expect(stage?.lastElementChild?.getAttribute('class')).toBe('rdfa-debug');
  });

  // A reorder is what a node entering or leaving triggers; the overlay must not
  // be shuffled into the middle of the layer stack by it.
  it('keeps the debug overlay last across an update that reorders', () => {
    const { container, handle } = mount(undefined, 0, { debug: true });

    handle.update(500);

    const stage = container.querySelector('.rdfa-stage');
    expect(stage?.lastElementChild?.getAttribute('class')).toBe('rdfa-debug');
  });

  it('moves the debug overlay with t', () => {
    const { container, handle } = mount(undefined, 0, { debug: true });
    const first = container.querySelector('.rdfa-debug')?.textContent;

    handle.update(500);

    expect(container.querySelector('.rdfa-debug')?.textContent).not.toBe(first);
  });
});
