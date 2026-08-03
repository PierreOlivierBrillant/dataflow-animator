/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGeometryTracker,
  INITIAL_METRICS,
  sameGeometry,
  sameMetrics,
  type StageMetrics,
} from './geometryTracker';
import type { GeometryMap, NodeGeom } from '../engine/geometry';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** jsdom lays nothing out, so every rect this suite relies on is stubbed. */
function stubRect(el: Element, r: Rect): void {
  el.getBoundingClientRect = () =>
    ({
      left: r.left,
      top: r.top,
      right: r.left + r.width,
      bottom: r.top + r.height,
      width: r.width,
      height: r.height,
      x: r.left,
      y: r.top,
    }) as DOMRect;
}

function stubScale(value: string): void {
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => (name === '--rdfa-scale' ? value : ''),
  }));
}

interface NodeOptions {
  id: string;
  visual?: Rect;
  label?: Rect;
  tinted?: boolean;
  icon?: boolean;
}

/** Builds a stage whose rect is 0,0 → 400×250 unless overridden. */
function buildStage(nodes: NodeOptions[], stageRect?: Rect): HTMLElement {
  const stage = document.createElement('div');
  stubRect(stage, stageRect ?? { left: 0, top: 0, width: 400, height: 250 });

  for (const n of nodes) {
    const el = document.createElement('div');
    el.setAttribute('data-node-id', n.id);
    if (n.tinted) el.classList.add('rdfa-node--tinted');
    // The node element itself is never what gets measured when a visual exists.
    stubRect(el, { left: -999, top: -999, width: 1, height: 1 });

    const visual = document.createElement('span');
    visual.className = 'rdfa-node-visual';
    stubRect(visual, n.visual ?? { left: 0, top: 0, width: 40, height: 40 });
    if (n.icon) {
      const icon = document.createElement('span');
      icon.className = 'rdfa-node-icon';
      visual.appendChild(icon);
    }
    el.appendChild(visual);

    if (n.label) {
      const label = document.createElement('span');
      label.className = 'rdfa-node-label';
      stubRect(label, n.label);
      el.appendChild(label);
    }
    stage.appendChild(el);
  }
  document.body.appendChild(stage);
  return stage;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('measure', () => {
  it('reports node CENTRES relative to the stage', () => {
    stubScale('1');
    const stage = buildStage(
      [{ id: 'a', visual: { left: 100, top: 50, width: 40, height: 30 } }],
      { left: 20, top: 10, width: 400, height: 250 }
    );

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    // (100 - 20) + 40/2 = 100 ; (50 - 10) + 30/2 = 55
    expect(geometry.a).toMatchObject({
      id: 'a',
      x: 100,
      y: 55,
      width: 40,
      height: 30,
    });
  });

  it('publishes the stage size and aspect', () => {
    stubScale('1');
    const stage = buildStage([], { left: 0, top: 0, width: 400, height: 250 });

    const m = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect(m.width).toBe(400);
    expect(m.height).toBe(250);
    expect(m.aspect).toBe(1.6);
  });

  it('carries the previous size forward when the stage is degenerate', () => {
    stubScale('1');
    const stage = buildStage([{ id: 'a' }], {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    });
    const previous: StageMetrics = {
      geometry: {},
      aspect: 2,
      width: 800,
      height: 400,
    };

    const m = createGeometryTracker(stage).measure(previous);

    expect({ aspect: m.aspect, width: m.width, height: m.height }).toEqual({
      aspect: 2,
      width: 800,
      height: 400,
    });
    // Nodes are still measured even though the stage published no size.
    expect(m.geometry.a).toBeDefined();
  });

  it('stamps the stage scale on every node', () => {
    stubScale('1.25');
    const stage = buildStage([{ id: 'a' }, { id: 'b' }]);

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect(geometry.a.scale).toBe(1.25);
    expect(geometry.b.scale).toBe(1.25);
  });

  it('falls back to scale 1 when --rdfa-scale is absent or unparsable', () => {
    stubScale('');
    const stage = buildStage([{ id: 'a' }]);

    expect(
      createGeometryTracker(stage).measure(INITIAL_METRICS).geometry.a.scale
    ).toBe(1);
  });

  it('measures the visual, not the label', () => {
    stubScale('1');
    const stage = buildStage([
      {
        id: 'a',
        visual: { left: 0, top: 0, width: 40, height: 40 },
        label: { left: 0, top: 46, width: 90, height: 14 },
      },
    ]);

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect(geometry.a.height).toBe(40);
    expect(geometry.a.labelH).toBe(14);
    expect(geometry.a.labelW).toBe(90);
  });

  it('leaves label fields ABSENT — not zero — when there is no label', () => {
    stubScale('1');
    const stage = buildStage([{ id: 'a' }]);

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect('labelH' in geometry.a).toBe(false);
    expect('labelW' in geometry.a).toBe(false);
  });

  it('falls back to the node element when it has no visual', () => {
    stubScale('1');
    const stage = document.createElement('div');
    stubRect(stage, { left: 0, top: 0, width: 400, height: 250 });
    const el = document.createElement('div');
    el.setAttribute('data-node-id', 'bare');
    stubRect(el, { left: 10, top: 20, width: 30, height: 40 });
    stage.appendChild(el);

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect(geometry.bare).toMatchObject({ x: 25, y: 40 });
  });

  it('skips an element whose data-node-id is empty', () => {
    stubScale('1');
    const stage = document.createElement('div');
    stubRect(stage, { left: 0, top: 0, width: 400, height: 250 });
    const el = document.createElement('div');
    el.setAttribute('data-node-id', '');
    stubRect(el, { left: 0, top: 0, width: 10, height: 10 });
    stage.appendChild(el);

    expect(
      Object.keys(
        createGeometryTracker(stage).measure(INITIAL_METRICS).geometry
      )
    ).toEqual([]);
  });
});

describe('measure — pastille outset', () => {
  it('reconstructs the pill overhang for a tinted pictogram', () => {
    stubScale('2');
    const stage = buildStage([{ id: 'a', tinted: true, icon: true }]);

    // PASTILLE_INSET (5) × scale (2).
    expect(
      createGeometryTracker(stage).measure(INITIAL_METRICS).geometry.a
        .borderOutset
    ).toBe(10);
  });

  it('requires BOTH the tinted class and an icon', () => {
    stubScale('1');
    const stage = buildStage([
      { id: 'tintedOnly', tinted: true, icon: false },
      { id: 'iconOnly', tinted: false, icon: true },
      { id: 'neither' },
    ]);

    const { geometry } = createGeometryTracker(stage).measure(INITIAL_METRICS);

    expect(geometry.tintedOnly.borderOutset).toBeUndefined();
    expect(geometry.iconOnly.borderOutset).toBeUndefined();
    expect(geometry.neither.borderOutset).toBeUndefined();
  });
});

describe('sameGeometry', () => {
  const base: NodeGeom = { id: 'a', x: 1, y: 2, width: 3, height: 4, scale: 1 };
  const map = (over: Partial<NodeGeom> = {}): GeometryMap => ({
    a: { ...base, ...over },
  });

  it('accepts identical maps', () => {
    expect(sameGeometry(map(), map())).toBe(true);
  });

  it('rejects a differing key count', () => {
    expect(sameGeometry(map(), { ...map(), b: base })).toBe(false);
  });

  it('rejects a renamed key', () => {
    expect(sameGeometry(map(), { b: base })).toBe(false);
  });

  it.each([
    ['x', { x: 9 }],
    ['y', { y: 9 }],
    ['width', { width: 9 }],
    ['height', { height: 9 }],
    ['labelH', { labelH: 9 }],
    ['labelW', { labelW: 9 }],
    ['borderOutset', { borderOutset: 9 }],
    ['scale', { scale: 9 }],
  ])('rejects a change to %s', (_field, over) => {
    expect(sameGeometry(map(), map(over))).toBe(false);
  });

  it('treats an absent optional field as different from a present one', () => {
    // `undefined !== 0` — a node that gains a pastille must re-publish.
    expect(sameGeometry(map(), map({ borderOutset: 0 }))).toBe(false);
  });

  it('accepts two empty maps', () => {
    expect(sameGeometry({}, {})).toBe(true);
  });
});

describe('sameMetrics', () => {
  const m = (over: Partial<StageMetrics> = {}): StageMetrics => ({
    geometry: {},
    aspect: 1.6,
    width: 400,
    height: 250,
    ...over,
  });

  it('accepts identical metrics', () => {
    expect(sameMetrics(m(), m())).toBe(true);
  });

  it.each([
    ['aspect', { aspect: 2 }],
    ['width', { width: 401 }],
    ['height', { height: 251 }],
  ])(
    'rejects a change to %s even when the geometry is identical',
    (_f, over) => {
      expect(sameMetrics(m(), m(over))).toBe(false);
    }
  );

  it('rejects a change confined to the geometry', () => {
    const geometry: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 1, height: 1 },
    };
    expect(sameMetrics(m(), m({ geometry }))).toBe(false);
  });
});

describe('observe / disconnect', () => {
  function stubResizeObserver() {
    const observed: Element[] = [];
    const unobserved: Element[] = [];
    const disconnect = vi.fn();
    let trigger: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          trigger = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        unobserve(el: Element) {
          unobserved.push(el);
        }
        disconnect = disconnect;
      }
    );
    return { observed, unobserved, disconnect, fire: () => trigger?.() };
  }

  /** Appends a bare node element to a stage built by `buildStage`. */
  function addNode(stage: HTMLElement, id: string): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('data-node-id', id);
    stubRect(el, { left: 0, top: 0, width: 10, height: 10 });
    stage.appendChild(el);
    return el;
  }

  it('observes the stage AND every node', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const stage = buildStage([{ id: 'a' }, { id: 'b' }]);

    createGeometryTracker(stage).observe(() => {});

    expect(ro.observed).toHaveLength(3);
    expect(ro.observed[0]).toBe(stage);
  });

  it('forwards resize notifications', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const onChange = vi.fn();
    createGeometryTracker(buildStage([{ id: 'a' }])).observe(onChange);

    ro.fire();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disconnects', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const tracker = createGeometryTracker(buildStage([{ id: 'a' }]));

    tracker.observe(() => {});
    tracker.disconnect();

    expect(ro.disconnect).toHaveBeenCalledTimes(1);
  });

  it('observes nothing twice over and unobserves nothing on a first call', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const tracker = createGeometryTracker(buildStage([{ id: 'a' }]));

    tracker.observe(() => {});

    expect(ro.unobserved).toEqual([]);
    expect(tracker.observed.size).toBe(2);
  });

  it('unobserves a node that left the DOM', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const stage = buildStage([{ id: 'a' }, { id: 'b' }]);
    const tracker = createGeometryTracker(stage);
    tracker.observe(() => {});
    const gone = stage.querySelector<HTMLElement>('[data-node-id="b"]')!;

    gone.remove();
    tracker.observe(() => {});

    expect(ro.unobserved).toEqual([gone]);
    expect(tracker.observed.has(gone)).toBe(false);
    expect(tracker.observed.size).toBe(2);
  });

  it('retains nothing from a hide→show cycle, which builds a NEW element', () => {
    // The leak this closes: the reconciliation never recycles a removed
    // element, so without the sweep the observer would pile up one detached
    // node per cycle until `disconnect()`.
    stubScale('1');
    stubResizeObserver();
    const stage = buildStage([{ id: 'a' }]);
    const tracker = createGeometryTracker(stage);
    tracker.observe(() => {});
    const first = stage.querySelector<HTMLElement>('[data-node-id="a"]')!;

    first.remove();
    tracker.observe(() => {});
    const second = addNode(stage, 'a');
    tracker.observe(() => {});

    expect(tracker.observed.has(first)).toBe(false);
    expect([...tracker.observed]).toEqual([stage, second]);
  });

  it('forgets its targets on disconnect', () => {
    stubScale('1');
    const ro = stubResizeObserver();
    const stage = buildStage([{ id: 'a' }]);
    const tracker = createGeometryTracker(stage);
    tracker.observe(() => {});

    tracker.disconnect();

    expect(tracker.observed.size).toBe(0);
    // A fresh observer holds nothing, so there is nothing to unobserve either.
    tracker.observe(() => {});
    expect(ro.unobserved).toEqual([]);
    expect(tracker.observed.size).toBe(2);
  });

  it('is a no-op where ResizeObserver does not exist', () => {
    stubScale('1');
    vi.stubGlobal('ResizeObserver', undefined);
    const tracker = createGeometryTracker(buildStage([{ id: 'a' }]));

    expect(() => {
      tracker.observe(() => {});
      tracker.disconnect();
    }).not.toThrow();
  });
});
