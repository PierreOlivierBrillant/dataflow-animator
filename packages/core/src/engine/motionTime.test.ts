import { describe, expect, it } from 'vitest';
import {
  appearHold,
  arriveHold,
  derivedMoveDuration,
  moveDistance,
  REFERENCE_ASPECT,
} from './motionTime';
import { compile } from './compiler';
import type { DataFlowSpec } from '../types';
import type { MoveClip } from './timeline';
import { computeLayout, type LayoutMap } from './layout';

const layout: LayoutMap = {
  left: { cx: 0.1, cy: 0.5 },
  middle: { cx: 0.5, cy: 0.5 },
  right: { cx: 0.9, cy: 0.5 },
  bottom: { cx: 0.5, cy: 0.9 },
};

describe('moveDistance', () => {
  it('measures in a frame that does not depend on the player size', () => {
    // Two hops of the same ratio span measure the same, always — that is the
    // whole point of a fixed reference frame.
    expect(moveDistance(layout, 'left', 'middle')).toBeCloseTo(
      moveDistance(layout, 'middle', 'right')!
    );
  });

  it('is symmetric', () => {
    expect(moveDistance(layout, 'left', 'right')).toBeCloseTo(
      moveDistance(layout, 'right', 'left')!
    );
  });

  it('accounts for the frame aspect, so a vertical span is not a horizontal one', () => {
    // 0.4 of the width and 0.4 of the height are different numbers of pixels on
    // a 16:9 frame — measuring in raw ratios would make them equal and wrong.
    const horizontal = moveDistance(layout, 'middle', 'right')!;
    const vertical = moveDistance(layout, 'middle', 'bottom')!;
    expect(horizontal).toBeGreaterThan(vertical);
    expect(horizontal / vertical).toBeCloseTo(16 / 9, 5);
  });

  it('returns undefined for an unknown node', () => {
    expect(moveDistance(layout, 'left', 'nowhere')).toBeUndefined();
    expect(moveDistance(layout, 'nowhere', 'left')).toBeUndefined();
  });
});

describe('derivedMoveDuration', () => {
  it('grows with the distance', () => {
    expect(derivedMoveDuration(600, 1)!).toBeGreaterThan(
      derivedMoveDuration(300, 1)!
    );
  });

  it('holds one speed between the bounds — twice the distance, twice the time', () => {
    const near = derivedMoveDuration(250, 1)!;
    const far = derivedMoveDuration(500, 1)!;
    expect(far / near).toBeCloseTo(2, 1);
  });

  it('keeps a short hop from being a blink and a long one from dragging', () => {
    expect(derivedMoveDuration(1, 1)).toBe(380);
    expect(derivedMoveDuration(100000, 1)).toBe(1400);
  });

  it('scales by pace after the bounds', () => {
    expect(derivedMoveDuration(100000, 2)).toBe(2800);
    expect(derivedMoveDuration(1, 2)).toBe(760);
  });

  it('has nothing to say about a zero-length move', () => {
    expect(derivedMoveDuration(0, 1)).toBeUndefined();
    expect(derivedMoveDuration(-5, 1)).toBeUndefined();
  });
});

describe('appearHold / arriveHold', () => {
  it('are fractions of the movement they frame', () => {
    expect(appearHold(1000)).toBeGreaterThan(appearHold(500));
    expect(arriveHold(1000)).toBeGreaterThan(arriveHold(500));
  });

  it('give the arrival more room than the departure', () => {
    // Arriving is the part that carries the information.
    expect(arriveHold(1000)).toBeGreaterThan(appearHold(1000));
  });

  it('stay within bounds at both extremes', () => {
    expect(appearHold(10)).toBe(90);
    expect(arriveHold(10)).toBe(90);
    expect(appearHold(100000)).toBe(300);
    expect(arriveHold(100000)).toBe(300);
  });
});

/**
 * The invariant the whole chantier exists for. It is asserted on COMPILED
 * durations rather than on pixels on purpose: the visual goldens photograph
 * each step's settled state, so they are blind to a timing regression by
 * construction — nothing else would catch this coming undone.
 */
describe('compile — one speed across a scene', () => {
  const spec: DataFlowSpec = {
    direction: 'left-to-right',
    nodes: [
      { id: 'a', type: 'server', lane: 1 },
      { id: 'b', type: 'server', lane: 2 },
      { id: 'c', type: 'server', lane: 3 },
    ],
    packets: [{ id: 'p', kind: 'http_packet' }],
    timeline: [
      // One short hop, then one spanning the whole scene.
      { type: 'move', id: 'short', object: 'p', from: 'a', to: 'b' },
      { type: 'move', id: 'long', object: 'p', from: 'a', to: 'c' },
    ],
  };

  it('takes longer over the longer trip', () => {
    const { timeline } = compile(spec);
    const ms = (id: string) => {
      const clip = timeline.clips.find((c) => c.id === id) as MoveClip;
      return clip.endMs - clip.animStartMs;
    };
    expect(ms('long')).toBeGreaterThan(ms('short'));
  });

  it('travels both at the same speed, within a few percent', () => {
    const { timeline } = compile(spec);
    // The REAL placements the compiler measured against, not assumed ones.
    const placed = computeLayout(spec, { aspect: REFERENCE_ASPECT });
    const speed = (id: string, from: string, to: string) => {
      const clip = timeline.clips.find((c) => c.id === id) as MoveClip;
      return moveDistance(placed, from, to)! / (clip.endMs - clip.animStartMs);
    };
    // A constant duration would put this ratio at 2; a constant speed at 1.
    expect(speed('long', 'a', 'c') / speed('short', 'a', 'b')).toBeCloseTo(
      1,
      1
    );
  });

  it('still lets an explicit duration override the derived one', () => {
    const pinned: DataFlowSpec = {
      ...spec,
      timeline: [
        {
          type: 'move',
          id: 'short',
          object: 'p',
          from: 'a',
          to: 'b',
          duration: 2000,
        },
      ],
    };
    const clip = compile(pinned).timeline.clips.find(
      (c) => c.id === 'short'
    ) as MoveClip;
    expect(clip.endMs - clip.animStartMs).toBe(2000);
  });
});
