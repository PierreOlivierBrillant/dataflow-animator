import { describe, expect, it } from 'vitest';
import type { Action, DataFlowSpec } from '../types';
import { compile, STEP_GAP } from './compiler';
import { appearHold, arriveHold } from './motionTime';
import { FADE_MS } from './timeline';
import { evaluate } from './timeline';

const nodes: DataFlowSpec['nodes'] = [
  { id: 'a', type: 'client' },
  { id: 'b', type: 'server' },
];
const packets: DataFlowSpec['packets'] = [{ id: 'p', kind: 'http_packet' }];

function specOf(timeline: DataFlowSpec['timeline']): DataFlowSpec {
  return { nodes, packets, timeline };
}

describe('compile — scheduling', () => {
  it('chains root actions sequentially', () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'move',
          id: 'm1',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 500,
        },
        {
          type: 'move',
          id: 'm2',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
      ])
    );
    const m1 = timeline.clips.find((c) => c.id === 'm1')!;
    const m2 = timeline.clips.find((c) => c.id === 'm2')!;
    // The holds are fractions of the trip they frame, so each move has its own.
    const in1 = appearHold(500);
    const out1 = arriveHold(500);
    const in2 = appearHold(300);
    const out2 = arriveHold(300);
    // m1: appears at 0, animates after its origin hold, arrives 500 ms later.
    expect(m1.startMs).toBe(0);
    expect(m1.animStartMs).toBe(in1);
    expect(m1.endMs).toBe(in1 + 500);
    // End of step 0 = arrival + arrival hold.
    const step0End = in1 + 500 + out1;
    // m2 starts after step 0 + inter-step gap.
    expect(m2.startMs).toBe(step0End + STEP_GAP);
    expect(m2.endMs).toBe(step0End + STEP_GAP + in2 + 300);
    expect(timeline.durationMs).toBe(step0End + STEP_GAP + in2 + 300 + out2);
    expect(timeline.steps).toHaveLength(2);
  });

  it("places a parallel's children at the same timestamp", () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'parallel',
          actions: [
            {
              type: 'move',
              id: 'x',
              object: 'p',
              from: 'a',
              to: 'b',
              duration: 400,
            },
            {
              type: 'arrow',
              id: 'y',
              from: 'a',
              to: 'b',
              duration: 600,
            },
          ],
        },
      ])
    );
    const x = timeline.clips.find((c) => c.id === 'x')!;
    const y = timeline.clips.find((c) => c.id === 'y')!;
    expect(x.startMs).toBe(0);
    expect(y.startMs).toBe(0);
    // Duration = max(move footprint = hold+400+hold, arrow = 600).
    expect(timeline.durationMs).toBe(
      Math.max(appearHold(400) + 400 + arriveHold(400), 600)
    );
    expect(timeline.steps).toHaveLength(1);
  });

  it(`wait_for on root action doesn't move backwards before step (clamped to stepStart)`, () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A', from: 'a', to: 'b', duration: 1000 },
        {
          type: 'move',
          id: 'B',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 200,
        },
        {
          type: 'comment',
          id: 'C',
          object: 'a',
          text: 'x',
          duration: 100,
          wait_for: 'A',
        },
      ])
    );
    const c = timeline.clips.find((cl) => cl.id === 'C')!;
    const step2 = timeline.steps[2];
    // A.endMs=1000 < step2.startMs → wait_for clamped: C starts at step2.startMs.
    expect(c.startMs).toBe(step2.startMs);
    // A comment's `duration` is its FULLY-PRESENT time: the fade-in comes first.
    expect(c.endMs).toBe(step2.startMs + FADE_MS + 100);
  });
});

describe('compile — lifecycle', () => {
  it(`move disappears at the end, arrow persists until the next step`, () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A', from: 'a', to: 'b', duration: 300 },
        {
          type: 'move',
          id: 'B',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    const b = timeline.clips.find((c) => c.id === 'B')!;
    // move: default keep_until_next=false -> visible until the end of arrival hold.
    expect(b.visibleUntilMs).toBe(
      b.endMs + arriveHold(b.endMs - b.animStartMs)
    );
    // arrow: persists until the START of the next step (across the gap).
    expect(a.visibleUntilMs).toBe(timeline.steps[1].startMs);
  });

  it(`keep_until maintains until the start of the targeted action`, () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'arrow',
          id: 'A',
          from: 'a',
          to: 'b',
          duration: 300,
          keep_until: 'C',
        },
        {
          type: 'move',
          id: 'B',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
        {
          type: 'comment',
          id: 'C',
          object: 'a',
          text: 'x',
          duration: 100,
        },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    const c = timeline.clips.find((cl) => cl.id === 'C')!;
    expect(a.visibleUntilMs).toBe(c.startMs);
  });

  it(`keep_until_end maintains until the end of the timeline`, () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'arrow',
          id: 'A',
          from: 'a',
          to: 'b',
          duration: 300,
          keep_until_end: true,
        },
        {
          type: 'move',
          id: 'B',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    expect(a.visibleUntilMs).toBe(timeline.durationMs);
  });

  it('keep_until_end sets keepEnd on the clip', () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'set_content',
          id: 'SC',
          object: 'a',
          content: { type: 'text', value: 'v2' },
          keep_until_end: true,
        },
        {
          type: 'move',
          id: 'M',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
      ])
    );
    const sc = timeline.clips.find((c) => c.id === 'SC')!;
    expect(sc.keepEnd).toBe(true);
    // A clip without keep_until_end must not have keepEnd as true.
    const m = timeline.clips.find((c) => c.id === 'M')!;
    expect(m.keepEnd).toBeFalsy();
  });
});

describe('compile — stops', () => {
  it('a move produces two stops (appear + arrive), an arrow only one', () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A', from: 'a', to: 'b', duration: 300 },
        {
          type: 'move',
          id: 'B',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 300,
        },
      ])
    );
    const b = timeline.clips.find((c) => c.id === 'B')!;
    // Expected stops: end of the arrow (arrow.endMs), appearance of the move
    // (animStartMs) and arrival of the move (endMs).
    expect(timeline.stops).toContain(b.animStartMs);
    expect(timeline.stops).toContain(b.endMs);
    expect(timeline.stops.length).toBe(3);
    // Sorted.
    expect([...timeline.stops].sort((x, y) => x - y)).toEqual(timeline.stops);
  });

  it('a parallel is atomic: one stop at its end, children never stepped into', () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A', from: 'a', to: 'b', duration: 300 },
        {
          type: 'parallel',
          actions: [
            {
              type: 'move',
              id: 'x',
              object: 'p',
              from: 'a',
              to: 'b',
              duration: 900,
            },
            { type: 'arrow', id: 'y', from: 'a', to: 'b', duration: 600 },
          ],
        },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    const x = timeline.clips.find((c) => c.id === 'x')!;
    const y = timeline.clips.find((c) => c.id === 'y')!;
    // The root arrow keeps its own stop; the whole parallel contributes exactly
    // ONE stop (its end = last child to finish). The children's intermediate
    // instants (move appearance/arrival, arrow end) are NOT navigation stops.
    const groupEnd = Math.max(x.endMs, y.endMs);
    expect(timeline.stops).toEqual([a.endMs, groupEnd]);
    expect(timeline.stops).not.toContain(x.animStartMs);
    expect(timeline.stops).not.toContain(y.endMs);
  });
});

describe('compile — wait_for on root action: clamped to step start', () => {
  it('clamps the startMs to stepStart when wait_for references a previous action', () => {
    // 3 steps; step 2 has wait_for to action A from step 0.
    // step0: highlight A dur=100 → endMs=100, occupiedEnd=100, cursor→350
    // step1: arrow B dur=100 → endMs=450, cursor→700
    // step2: comment C wait_for='A' → ref.endMs=100 < stepStart=700 → clamped to 700
    const { timeline } = compile(
      specOf([
        { type: 'highlight', id: 'A', object: 'a', duration: 100 },
        { type: 'arrow', id: 'B', from: 'a', to: 'b', duration: 100 },
        {
          type: 'comment',
          id: 'C',
          object: 'a',
          text: 'x',
          duration: 100,
          wait_for: 'A',
        },
      ])
    );
    const c = timeline.clips.find((cl) => cl.id === 'C')!;
    const step2 = timeline.steps[2];
    expect(c.startMs).toBe(step2.startMs);
    // The comment fades in first, then stays for its `duration`.
    expect(c.endMs).toBe(step2.startMs + FADE_MS + 100);
    // The step has a positive duration (endMs > startMs).
    expect(step2.endMs).toBeGreaterThan(step2.startMs);
  });

  it('invariant: clip.startMs ≥ step.startMs for all root actions', () => {
    const { timeline } = compile(
      specOf([
        { type: 'highlight', id: 'A', object: 'a', duration: 100 },
        { type: 'arrow', id: 'B', from: 'a', to: 'b', duration: 100 },
        {
          type: 'comment',
          id: 'C',
          object: 'a',
          text: 'x',
          duration: 100,
          wait_for: 'A',
        },
        {
          type: 'loading',
          id: 'D',
          object: 'a',
          duration: 200,
          wait_for: 'B',
        },
      ])
    );
    for (const clip of timeline.clips) {
      const step = timeline.steps[clip.stepIndex];
      expect(clip.startMs).toBeGreaterThanOrEqual(step.startMs);
    }
  });

  it("does not clamp a parallel's children (behavior preserved)", () => {
    // A (step 0, endMs=100); step 1 = parallel where one child has wait_for='A'.
    // The child remains at A.endMs=100 < parallel.startMs=350 (no clamping for children).
    const { timeline } = compile(
      specOf([
        { type: 'highlight', id: 'A', object: 'a', duration: 100 },
        {
          type: 'parallel',
          actions: [
            {
              type: 'comment',
              id: 'C',
              object: 'a',
              text: 'x',
              duration: 100,
              wait_for: 'A',
            },
            { type: 'arrow', id: 'B', from: 'a', to: 'b', duration: 200 },
          ],
        },
      ])
    );
    const c = timeline.clips.find((cl) => cl.id === 'C')!;
    const step1 = timeline.steps[1];
    // Parallel child: startMs = A.endMs = 100, prior to the start of the parallel.
    expect(c.startMs).toBe(100);
    expect(c.startMs).toBeLessThan(step1.startMs);
  });
});

describe('compile — delay_ms', () => {
  it('shifts the startMs in a parallel (stagger)', () => {
    // anim1 : 0 → 4000, anim2 : 2000 → 4000
    const { timeline } = compile(
      specOf([
        {
          type: 'parallel',
          actions: [
            { type: 'arrow', id: 'A1', from: 'a', to: 'b', duration: 4000 },
            {
              type: 'arrow',
              id: 'A2',
              from: 'a',
              to: 'b',
              duration: 2000,
              delay_ms: 2000,
            },
          ],
        },
      ])
    );
    const a1 = timeline.clips.find((c) => c.id === 'A1')!;
    const a2 = timeline.clips.find((c) => c.id === 'A2')!;
    expect(a1.startMs).toBe(0);
    expect(a1.endMs).toBe(4000);
    expect(a2.startMs).toBe(2000);
    expect(a2.endMs).toBe(4000);
  });

  it('shifts a root action in its step', () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'arrow',
          id: 'A',
          from: 'a',
          to: 'b',
          duration: 500,
          delay_ms: 300,
        },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    expect(a.startMs).toBe(300);
    expect(a.endMs).toBe(800);
  });

  it('composes with wait_for: delay_ms is added after resolution', () => {
    // Inside a parallel, children have no minStartMs,
    // so wait_for + delay_ms applies cleanly without step clamping.
    const { timeline } = compile(
      specOf([
        {
          type: 'parallel',
          actions: [
            { type: 'arrow', id: 'X', from: 'a', to: 'b', duration: 500 },
            {
              type: 'arrow',
              id: 'Y',
              from: 'a',
              to: 'b',
              duration: 200,
              wait_for: 'X',
              delay_ms: 100,
            },
          ],
        },
      ])
    );
    const x = timeline.clips.find((c) => c.id === 'X')!;
    const y = timeline.clips.find((c) => c.id === 'Y')!;
    // Y starts at X.endMs (500) + delay_ms (100) = 600.
    expect(y.startMs).toBe(x.endMs + 100);
    expect(y.endMs).toBe(x.endMs + 300);
  });

  it('delay_ms on a whole parallel delays the entire group', () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'parallel',
          delay_ms: 400,
          actions: [
            { type: 'arrow', id: 'P1', from: 'a', to: 'b', duration: 300 },
            { type: 'arrow', id: 'P2', from: 'a', to: 'b', duration: 500 },
          ],
        },
      ])
    );
    const p1 = timeline.clips.find((c) => c.id === 'P1')!;
    const p2 = timeline.clips.find((c) => c.id === 'P2')!;
    expect(p1.startMs).toBe(400);
    expect(p2.startMs).toBe(400);
  });
});

describe('compile — robustness', () => {
  it('ignores an incomplete action and emits a warning', () => {
    const { timeline, warnings } = compile(
      // Deliberately incomplete data (missing to) -> ignored + warning.
      specOf([{ type: 'move', object: 'p', from: 'a' } as unknown as Action])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('compile — set_visible', () => {
  it('produces a set_visible clip with keepEnd=true and visibleUntilMs=durationMs', () => {
    const { timeline } = compile(
      specOf([
        { type: 'set_visible', id: 'SV', object: 'a', visible: true },
        { type: 'arrow', id: 'AR', from: 'a', to: 'b', duration: 300 },
      ])
    );
    const sv = timeline.clips.find((c) => c.id === 'SV')!;
    expect(sv.kind).toBe('set_visible');
    expect(sv.keepEnd).toBe(true);
    expect(sv.visibleUntilMs).toBe(timeline.durationMs);
  });

  it('a set_visible with visible=false properly has the visible=false field', () => {
    const { timeline } = compile(
      specOf([{ type: 'set_visible', id: 'SV', object: 'a', visible: false }])
    );
    const sv = timeline.clips.find((c) => c.id === 'SV')!;
    expect((sv as import('./timeline').SetVisibleClip).visible).toBe(false);
  });

  it('emits a warning if object is missing', () => {
    const { timeline, warnings } = compile(
      specOf([{ type: 'set_visible', visible: true } as unknown as Action])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('set_visible'))).toBe(true);
  });

  it('two successive set_visible for the same node are both in the clips', () => {
    const { timeline } = compile(
      specOf([
        { type: 'set_visible', id: 'HIDE', object: 'a', visible: false },
        { type: 'set_visible', id: 'SHOW', object: 'a', visible: true },
      ])
    );
    expect(timeline.clips.filter((c) => c.kind === 'set_visible')).toHaveLength(
      2
    );
    // Both persist to the end.
    for (const c of timeline.clips.filter((c) => c.kind === 'set_visible')) {
      expect(c.visibleUntilMs).toBe(timeline.durationMs);
    }
  });
});

describe('compile — set_icon', () => {
  type SetIconClip = import('./timeline').SetIconClip;

  it('produces a set_icon clip carrying the value, keepEnd=true, persisting to the end', () => {
    const { timeline } = compile(
      specOf([
        { type: 'set_icon', id: 'SI', object: 'a', icon: '7' },
        { type: 'arrow', id: 'AR', from: 'a', to: 'b', duration: 300 },
      ])
    );
    const si = timeline.clips.find((c) => c.id === 'SI')! as SetIconClip;
    expect(si.kind).toBe('set_icon');
    expect(si.icon).toBe('7');
    expect(si.keepEnd).toBe(true);
    expect(si.visibleUntilMs).toBe(timeline.durationMs);
  });

  it('accepts an empty string (clears the badge)', () => {
    const { timeline, warnings } = compile(
      specOf([{ type: 'set_icon', id: 'SI', object: 'a', icon: '' }])
    );
    const si = timeline.clips.find((c) => c.id === 'SI')! as SetIconClip;
    expect(si.icon).toBe('');
    expect(warnings).toEqual([]);
  });

  it('emits a warning if object or icon is missing', () => {
    const { timeline, warnings } = compile(
      specOf([{ type: 'set_icon', icon: '7' } as unknown as Action])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('set_icon'))).toBe(true);
  });

  it('two successive set_icon on the same node both persist (chaining)', () => {
    const { timeline } = compile(
      specOf([
        { type: 'set_icon', id: 'I1', object: 'a', icon: '∞' },
        { type: 'set_icon', id: 'I2', object: 'a', icon: '5' },
      ])
    );
    const icons = timeline.clips.filter((c) => c.kind === 'set_icon');
    expect(icons).toHaveLength(2);
    for (const c of icons) expect(c.visibleUntilMs).toBe(timeline.durationMs);
  });
});

describe('compile — rotate', () => {
  type RotateClip = import('./timeline').RotateClip;

  it('produces a rotate clip persisting to the end, fromDeg=0 by default', () => {
    const { timeline } = compile(
      specOf([
        { type: 'rotate', id: 'ROT', object: 'a', to: 90 },
        { type: 'arrow', id: 'AR', from: 'a', to: 'b', duration: 300 },
      ])
    );
    const rot = timeline.clips.find((c) => c.id === 'ROT')! as RotateClip;
    expect(rot.kind).toBe('rotate');
    expect(rot.keepEnd).toBe(true);
    expect(rot.visibleUntilMs).toBe(timeline.durationMs);
    expect(rot.fromDeg).toBe(0);
    expect(rot.toDeg).toBe(90);
  });

  it('seeds fromDeg from the node static rotation', () => {
    const { timeline } = compile({
      nodes: [
        { id: 'a', type: 'client', rotation: 30 },
        { id: 'b', type: 'server' },
      ],
      packets,
      timeline: [{ type: 'rotate', id: 'ROT', object: 'a', to: 120 }],
    });
    const rot = timeline.clips.find((c) => c.id === 'ROT')! as RotateClip;
    expect(rot.fromDeg).toBe(30);
    expect(rot.toDeg).toBe(120);
  });

  it('chains: the second rotate starts from the first target', () => {
    const { timeline } = compile(
      specOf([
        { type: 'rotate', id: 'R1', object: 'a', to: 90 },
        { type: 'rotate', id: 'R2', object: 'a', to: 180 },
      ])
    );
    const r1 = timeline.clips.find((c) => c.id === 'R1')! as RotateClip;
    const r2 = timeline.clips.find((c) => c.id === 'R2')! as RotateClip;
    expect(r1.toDeg).toBe(90);
    expect(r2.fromDeg).toBe(90);
    expect(r2.toDeg).toBe(180);
  });

  it('emits a warning if object is missing or neither `to` nor `spin` is a number', () => {
    const { timeline, warnings } = compile(
      specOf([
        { type: 'rotate', to: 90 } as unknown as Action,
        { type: 'rotate', object: 'a' } as unknown as Action,
      ])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.filter((w) => w.includes('rotate'))).toHaveLength(2);
  });

  describe('spin', () => {
    it('spins for `duration` ms: linear flag, swept angle = speed × time', () => {
      const { timeline } = compile(
        specOf([
          { type: 'rotate', id: 'S', object: 'a', spin: 360, duration: 1000 },
        ])
      );
      const s = timeline.clips.find((c) => c.id === 'S')! as RotateClip;
      expect(s.spin).toBe(true);
      expect(s.keepEnd).toBe(true);
      expect(s.fromDeg).toBe(0);
      // 360 deg/s during 1000 ms = one full turn.
      expect(s.toDeg).toBe(360);
      expect(s.endMs).toBe(s.animStartMs + 1000);
      // The node never disappears: it holds the final angle until the end.
      expect(s.visibleUntilMs).toBe(timeline.durationMs);
    });

    it('negative speed spins counter-clockwise', () => {
      const { timeline } = compile(
        specOf([
          { type: 'rotate', id: 'S', object: 'a', spin: -180, duration: 2000 },
        ])
      );
      const s = timeline.clips.find((c) => c.id === 'S')! as RotateClip;
      expect(s.toDeg).toBe(-360);
    });

    it('keep_until_end: spins until the end of the timeline', () => {
      const { timeline } = compile(
        specOf([
          {
            type: 'rotate',
            id: 'S',
            object: 'a',
            spin: 90,
            keep_until_end: true,
          },
          { type: 'arrow', id: 'A', from: 'a', to: 'b', duration: 1000 },
        ])
      );
      const s = timeline.clips.find((c) => c.id === 'S')! as RotateClip;
      expect(s.endMs).toBe(timeline.durationMs);
      expect(s.visibleUntilMs).toBe(timeline.durationMs);
      // Angle swept over the whole timeline (fromDeg 0, animStart 0).
      expect(s.toDeg).toBeCloseTo((90 * timeline.durationMs) / 1000);
    });

    it('keep_until: spins until the referenced action starts', () => {
      const { timeline } = compile(
        specOf([
          {
            type: 'rotate',
            id: 'S',
            object: 'a',
            spin: 720,
            keep_until: 'LATER',
          },
          { type: 'arrow', id: 'EARLY', from: 'a', to: 'b', duration: 500 },
          {
            type: 'comment',
            id: 'LATER',
            object: 'a',
            text: 'x',
            duration: 300,
          },
        ])
      );
      const s = timeline.clips.find((c) => c.id === 'S')! as RotateClip;
      const laterStart = timeline.steps[2].startMs;
      expect(s.endMs).toBe(laterStart);
      expect(s.toDeg).toBeCloseTo((720 * laterStart) / 1000);
      expect(s.visibleUntilMs).toBe(timeline.durationMs);
    });

    it('spin wins over to when both are set (with a warning)', () => {
      const { timeline, warnings } = compile(
        specOf([
          {
            type: 'rotate',
            id: 'S',
            object: 'a',
            to: 90,
            spin: 360,
            duration: 1000,
          },
        ])
      );
      const s = timeline.clips.find((c) => c.id === 'S')! as RotateClip;
      expect(s.spin).toBe(true);
      expect(s.toDeg).toBe(360);
      expect(warnings.some((w) => w.includes('mutually exclusive'))).toBe(true);
    });
  });
});

describe('compile — set_color', () => {
  type SetColorClip = import('./timeline').SetColorClip;

  it('produces a set_color clip with keepEnd=true and visibleUntilMs=durationMs', () => {
    const { timeline } = compile(
      specOf([
        {
          type: 'set_color',
          id: 'SC',
          object: 'a',
          background_color: '#1a1a1a',
          text_color: 'white',
        },
        { type: 'arrow', id: 'AR', from: 'a', to: 'b', duration: 300 },
      ])
    );
    const sc = timeline.clips.find((c) => c.id === 'SC')! as SetColorClip;
    expect(sc.kind).toBe('set_color');
    expect(sc.keepEnd).toBe(true);
    expect(sc.visibleUntilMs).toBe(timeline.durationMs);
    expect(sc.backgroundColor).toBe('#1a1a1a');
    expect(sc.textColor).toBe('white');
    // Only the provided channels are carried; the rest stay undefined.
    expect(sc.borderColor).toBeUndefined();
  });

  it('accepts `color` alone (connection recolor) and carries it on the clip', () => {
    const { timeline, warnings } = compile(
      specOf([
        { type: 'set_color', id: 'SC', object: 'link', color: 'crimson' },
      ])
    );
    const sc = timeline.clips.find((c) => c.id === 'SC')! as SetColorClip;
    expect(sc.kind).toBe('set_color');
    expect(sc.color).toBe('crimson');
    // The three node channels stay undefined; `color` is the connection channel.
    expect(sc.backgroundColor).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it('emits a warning if object is missing', () => {
    const { timeline, warnings } = compile(
      specOf([
        { type: 'set_color', background_color: 'red' } as unknown as Action,
      ])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('set_color'))).toBe(true);
  });

  it('emits a warning if no color channel is provided', () => {
    const { timeline, warnings } = compile(
      specOf([{ type: 'set_color', object: 'a' } as unknown as Action])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('set_color'))).toBe(true);
  });

  it('two successive set_color on the same node both persist to the end', () => {
    const { timeline } = compile(
      specOf([
        { type: 'set_color', id: 'RED', object: 'a', background_color: 'red' },
        {
          type: 'set_color',
          id: 'BLK',
          object: 'a',
          background_color: 'black',
        },
      ])
    );
    const clips = timeline.clips.filter((c) => c.kind === 'set_color');
    expect(clips).toHaveLength(2);
    for (const c of clips) expect(c.visibleUntilMs).toBe(timeline.durationMs);
  });
});

describe('compile — rotate_subtree', () => {
  type ReflowClip = import('./timeline').ReflowClip;
  //        g
  //       / \
  //      p   u
  //     /
  //    n
  const treeNodes: DataFlowSpec['nodes'] = [
    { id: 'g', type: 'circle' },
    { id: 'p', type: 'circle' },
    { id: 'u', type: 'circle' },
    { id: 'n', type: 'circle' },
  ];
  const treeSpec = (timeline: DataFlowSpec['timeline']): DataFlowSpec => ({
    direction: 'tree',
    tree: {
      root: 'g',
      children: { g: { left: 'p', right: 'u' }, p: { left: 'n' } },
    },
    nodes: treeNodes,
    packets: [],
    timeline,
  });

  it('emits a reflow clip (keepEnd) with differing from/to layouts and edges', () => {
    const { timeline, warnings } = compile(
      treeSpec([
        { type: 'rotate_subtree', id: 'R', object: 'g', rotation: 'left' },
      ])
    );
    expect(warnings).toEqual([]);
    const r = timeline.clips.find((c) => c.id === 'R')! as ReflowClip;
    expect(r.kind).toBe('reflow');
    expect(r.keepEnd).toBe(true);
    expect(r.visibleUntilMs).toBe(timeline.durationMs);
    // Left rotation around g lifts u to the root: u rises, g sinks.
    expect(r.toLayout.u.cy).toBeLessThan(r.fromLayout.u.cy);
    expect(r.toLayout.g.cy).toBeGreaterThan(r.fromLayout.g.cy);
    // In-order order is preserved → horizontal slots unchanged.
    expect(r.toLayout.g.cx).toBeCloseTo(r.fromLayout.g.cx);
    // New topology edges include u→g (u is now g's parent).
    expect(r.edges).toEqual(expect.arrayContaining([['u', 'g']]));
  });

  it('warns when not in tree mode', () => {
    const { timeline, warnings } = compile({
      nodes: treeNodes,
      packets: [],
      timeline: [{ type: 'rotate_subtree', object: 'g', rotation: 'left' }],
    });
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('rotate_subtree'))).toBe(true);
  });

  it('warns when the pivot lacks the required child', () => {
    // n is a leaf: no right child to rotate left.
    const { timeline, warnings } = compile(
      treeSpec([{ type: 'rotate_subtree', object: 'n', rotation: 'left' }])
    );
    expect(timeline.clips).toHaveLength(0);
    expect(warnings.some((w) => w.includes('no right child'))).toBe(true);
  });

  it('chains: a second rotation starts from the topology left by the first', () => {
    // R1 (rotate g right) makes p the root with right child g; R2 (rotate p
    // left) is then valid — the kind of two-step chain AVL double rotations use.
    const { timeline, warnings } = compile(
      treeSpec([
        { type: 'rotate_subtree', id: 'R1', object: 'g', rotation: 'right' },
        { type: 'rotate_subtree', id: 'R2', object: 'p', rotation: 'left' },
      ])
    );
    expect(warnings).toEqual([]);
    const r1 = timeline.clips.find((c) => c.id === 'R1')! as ReflowClip;
    const r2 = timeline.clips.find((c) => c.id === 'R2')! as ReflowClip;
    // R2 picks up exactly where R1 left off.
    expect(r2.fromLayout).toEqual(r1.toLayout);
  });
});

describe('compile — wait', () => {
  it('does not emit any clip but creates a step that shifts the following ones', () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A1', from: 'a', to: 'b', duration: 300 },
        { type: 'wait', id: 'W', duration: 1000 },
        { type: 'arrow', id: 'A2', from: 'a', to: 'b', duration: 300 },
      ])
    );
    // The wait produces no clip: only the two arrows are present...
    expect(timeline.clips).toHaveLength(2);
    // ...but it does occupy a full step of its own.
    expect(timeline.steps).toHaveLength(3);

    const waitStart = 300 + STEP_GAP;
    expect(timeline.steps[1].startMs).toBe(waitStart);
    expect(timeline.steps[1].endMs).toBe(waitStart + 1000);

    // The next step starts after the wait (+ inter-step gap).
    const a2 = timeline.clips.find((c) => c.id === 'A2')!;
    expect(a2.startMs).toBe(waitStart + 1000 + STEP_GAP);
  });

  it('maintains the placed content (keep_until_next) DURING the idle time', () => {
    const { timeline } = compile(
      specOf([
        { type: 'arrow', id: 'A1', from: 'a', to: 'b', duration: 300 },
        { type: 'wait', duration: 1000 },
        { type: 'arrow', id: 'A2', from: 'a', to: 'b', duration: 300 },
      ])
    );
    const a1 = timeline.clips.find((c) => c.id === 'A1')!;
    const a2 = timeline.clips.find((c) => c.id === 'A2')!;
    // A1 remains visible until the START of the next content step (A2),
    // therefore across the wait, not just until the start of the wait.
    expect(a1.visibleUntilMs).toBe(a2.startMs);

    // Right in the middle of the wait, A1 is still rendered (frozen, progress 1).
    const midWait = timeline.steps[1].startMs + 500;
    const active = evaluate(timeline, midWait);
    const shown = active.find((c) => c.clip.id === 'A1');
    expect(shown).toBeDefined();
    expect(shown!.animating).toBe(false);
  });

  it('uses default duration (1000 ms) when `duration` is missing', () => {
    const { timeline } = compile(specOf([{ type: 'wait' }]));
    expect(timeline.clips).toHaveLength(0);
    expect(timeline.steps).toHaveLength(1);
    expect(timeline.durationMs).toBe(1000);
  });

  it('resolves wait_for to the end of an identified wait', () => {
    const { timeline } = compile(
      specOf([
        { type: 'wait', id: 'W', duration: 800 },
        { type: 'arrow', id: 'A', from: 'a', to: 'b', wait_for: 'W' },
      ])
    );
    const a = timeline.clips.find((c) => c.id === 'A')!;
    // A is a root step: its floor is the start of its step, which already
    // follows the wait — wait_for merely confirms this sequencing.
    expect(a.startMs).toBe(800 + STEP_GAP);
  });
});

describe('compile — omniscient comment', () => {
  it('compiles a comment without object as a clip without nextToId', () => {
    const { timeline, warnings } = compile(
      specOf([{ type: 'comment', id: 'C', text: 'Bonjour' }])
    );
    const clip = timeline.clips.find((c) => c.id === 'C')!;
    expect(clip).toBeDefined();
    expect(clip.kind).toBe('comment');
    // @ts-expect-error nextToId is optional — checking that it is absent
    expect(clip.nextToId).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it('emits a warning when text is absent', () => {
    const action = { type: 'comment', id: 'C', object: 'a' } as Action;
    const { timeline, warnings } = compile(specOf([action]));
    expect(timeline.clips).toHaveLength(0);
    expect(warnings[0]).toMatch(/text requis/);
  });

  it('compiles a comment with object as a clip with nextToId', () => {
    const { timeline } = compile(
      specOf([{ type: 'comment', id: 'C', object: 'a', text: 'ok' }])
    );
    const clip = timeline.clips.find((c) => c.id === 'C')! as {
      nextToId?: string;
    };
    expect(clip.nextToId).toBe('a');
  });
});
