import { describe, expect, it } from 'vitest';
import { buildStageModel } from './stageModel';
import { INITIAL_METRICS, type StageMetrics } from './geometryTracker';
import { computeLayout } from '../engine/layout';
import type { DataFlowSpec } from '../types';
import type { GeometryMap } from '../engine/geometry';

const flowSpec: DataFlowSpec = {
  nodes: [
    { id: 'a', type: 'server', text: 'A' },
    { id: 'b', type: 'database', text: 'B' },
  ],
  packets: [],
  timeline: [],
  connections: [{ from: 'a', to: 'b' }],
};

const circuitSpec: DataFlowSpec = {
  direction: 'circuit',
  nodes: [
    { id: 'bat', type: 'battery' },
    { id: 'r1', type: 'resistor' },
    { id: 'r2', type: 'resistor' },
  ],
  packets: [],
  timeline: [],
  connections: [
    { from: 'bat:b', to: 'r1:a' },
    { from: 'r1:b', to: 'r2:a' },
  ],
};

const metrics = (over: Partial<StageMetrics> = {}): StageMetrics => ({
  geometry: {},
  aspect: 1.6,
  width: 800,
  height: 500,
  ...over,
});

const model = (spec: DataFlowSpec, m: StageMetrics = metrics()) =>
  buildStageModel({
    spec,
    layout: computeLayout(spec, { aspect: m.aspect }),
    metrics: m,
    density: 'comfortable',
  });

describe('framing', () => {
  it('does not letterbox a flow diagram — it fills the container', () => {
    const s = model(flowSpec);

    expect(s.frameAspect).toBe(0);
    expect(s.frame).toEqual({ w: 800, h: 500, offX: 0, offY: 0 });
    // The router then reasons in the CONTAINER's aspect.
    expect(s.routeAspect).toBe(1.6);
  });

  it('letterboxes a circuit into a fixed-aspect frame', () => {
    const s = model(circuitSpec);

    expect(s.frameAspect).toBeGreaterThan(0);
    expect(s.frame.w).toBeLessThanOrEqual(800);
    expect(s.frame.h).toBeLessThanOrEqual(500);
    // And the router uses the FRAME's aspect, so routing is size-independent.
    expect(s.routeAspect).toBe(s.frameAspect);
  });
});

describe('scale', () => {
  it('scales strictly proportionally to the stage height', () => {
    const small = model(flowSpec, metrics({ width: 400, height: 250 }));
    const large = model(flowSpec, metrics({ width: 800, height: 500 }));

    // A small player is a homogeneous reduction of a large one.
    expect(large.scale / small.scale).toBeCloseTo(2, 6);
    // The stylesheet multiplies `--rdfa-maxw` by `--rdfa-scale`, which already
    // carries k: what scales with the player is that product, never maxW alone
    // — otherwise labels, packets and bubbles would grow as k².
    expect(large.maxW).toBe(small.maxW);
    expect((large.maxW * large.scale) / (small.maxW * small.scale)).toBeCloseTo(
      2,
      6
    );
  });

  it('ties the content scale to the icon scale', () => {
    const s = model(flowSpec);

    expect(s.contentScale).toBe(s.scale);
  });

  it('falls back to k = 1 for an unmeasured stage', () => {
    expect(model(flowSpec, INITIAL_METRICS).k).toBe(1);
  });

  it('reasons in a design space of fixed height', () => {
    // designW is the frame width expressed at DESIGN_H (495), so the design
    // aspect matches the frame's whatever the container measures.
    const s = model(flowSpec, metrics({ width: 990, height: 495 }));

    expect(s.k).toBe(1);
    // At k = 1 the published scale IS the design scale.
    expect(s.scale).toBe(
      model(flowSpec, metrics({ width: 990, height: 495 })).scale
    );
  });
});

describe('stage variables', () => {
  it('emits unitless numbers for the scales and px for the maxima', () => {
    const s = model(flowSpec);

    expect(s.stageVars['--rdfa-scale']).toBe(String(s.scale));
    expect(s.stageVars['--rdfa-scale']).not.toMatch(/px/);
    expect(s.stageVars['--rdfa-maxw']).toBe(`${s.maxW}px`);
    expect(s.stageVars['--rdfa-content-maxh']).toMatch(/px$/);
  });

  it('hides the stage until it is measured', () => {
    expect(model(flowSpec, INITIAL_METRICS).stageVars.visibility).toBe(
      'hidden'
    );
    expect(model(flowSpec).stageVars.visibility).toBe('visible');
  });
});

describe('placements', () => {
  it('places every laid-out node', () => {
    const s = model(flowSpec);

    expect(Object.keys(s.placements).sort()).toEqual(['a', 'b']);
    for (const p of Object.values(s.placements)) {
      expect(p.cx).toBeGreaterThanOrEqual(0);
      expect(p.cx).toBeLessThanOrEqual(1);
    }
  });

  it('compresses a circuit`s placements into the centred frame', () => {
    const wide = model(circuitSpec, metrics({ width: 1600, height: 500 }));
    const xs = Object.values(wide.placements).map((p) => p.cx);

    // The frame is narrower than the container, so nothing reaches the edges.
    expect(Math.min(...xs)).toBeGreaterThan(0.05);
    expect(Math.max(...xs)).toBeLessThan(0.95);
  });

  it('follows the placement layout when one is supplied (tree reflow)', () => {
    const layout = computeLayout(flowSpec, { aspect: 1.6 });
    const moved = { a: { cx: 0.1, cy: 0.1 }, b: { cx: 0.9, cy: 0.9 } };
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      placementLayout: moved,
      metrics: metrics(),
      density: 'comfortable',
    });

    expect(s.placements.a.cx).toBeCloseTo(0.1, 1);
    expect(s.placements.b.cx).toBeCloseTo(0.9, 1);
  });
});

describe('pin nudge', () => {
  it('leaves the layout untouched when nothing is nudged', () => {
    const s = model(flowSpec);

    expect(s.nudgeKey).toBe('');
  });

  it('shifts a nudged node by a fraction of the measured height', () => {
    const layout = { a: { cx: 0.5, cy: 0.5, pinNudge: 0.25 } };
    const geometry: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 40, height: 100 },
    };
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics({ geometry }),
      density: 'comfortable',
    });

    // 0.5 + (0.25 * 100) / 500
    expect(s.nudgedLayout.a.cy).toBeCloseTo(0.55, 6);
    expect(s.nudgeKey).toContain('a:');
  });

  it('ignores a nudge whose reference node is not measured yet', () => {
    const layout = { a: { cx: 0.5, cy: 0.5, pinNudge: 0.25 } };
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics(),
      density: 'comfortable',
    });

    expect(s.nudgedLayout.a.cy).toBe(0.5);
  });

  it('resolves the nudge against the REFERENCED node`s height', () => {
    const layout = {
      a: { cx: 0.5, cy: 0.5, pinNudge: 0.25, pinNudgeRef: 'b' },
    };
    const geometry: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 40, height: 100 },
      b: { id: 'b', x: 0, y: 0, width: 40, height: 200 },
    };
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics({ geometry }),
      density: 'comfortable',
    });

    // Uses b's 200, not a's 100: 0.5 + (0.25 * 200) / 500
    expect(s.nudgedLayout.a.cy).toBeCloseTo(0.6, 6);
  });
});

describe('buildStageModel — content limits', () => {
  it('caps every node and expresses the cap in render units', () => {
    const layout = computeLayout(flowSpec, { aspect: 1.6 });
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics(),
      density: 'comfortable',
    });

    expect(Object.keys(s.contentLimits).sort()).toEqual(['a', 'b']);
    for (const id of ['a', 'b']) {
      expect(s.contentLimits[id].maxW).toBeGreaterThan(0);
      expect(s.contentLimits[id].maxW).toBeLessThanOrEqual(s.contentMaxW);
      expect(s.contentLimits[id].maxH).toBeLessThanOrEqual(s.contentMaxH);
    }
  });

  it('scales with the player, like every other length here', () => {
    const layout = computeLayout(flowSpec, { aspect: 1.6 });
    const big = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics({ width: 800, height: 500 }),
      density: 'comfortable',
    });
    const small = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: metrics({ width: 400, height: 250 }),
      density: 'comfortable',
    });

    // Half the player, half the k — a strictly homogeneous reduction.
    expect(small.contentLimits.a.maxW).toBeLessThan(big.contentLimits.a.maxW);
  });

  it('still produces real limits on an unmeasured stage', () => {
    const layout = computeLayout(flowSpec, { aspect: 1.6 });
    const s = buildStageModel({
      spec: flowSpec,
      layout,
      metrics: INITIAL_METRICS,
      density: 'comfortable',
    });

    // The design space has a FIXED size (700×500 at k=1), so a 0×0 stage never
    // reaches `computeContentLimits`' degenerate branch: neighbours still
    // constrain the box, and the first pass renders a panel of the right shape
    // instead of an unbounded one that would have to shrink afterwards.
    expect(s.contentLimits.a.maxH).toBeLessThan(s.contentMaxH);
    expect(s.contentLimits.a.maxH).toBeGreaterThan(0);
  });
});
