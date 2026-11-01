import { describe, expect, it } from 'vitest';
import {
  anchorOf,
  anchoredBox,
  confine,
  NODE_GAP,
  overlapArea,
  planAnchored,
  planBubbles,
  planFree,
  STAGE_PAD,
  unionBox,
  type Box,
} from './overlayPlacement';
import type { NodeGeom } from './geometry';

const stage = { w: 800, h: 500 };
const bubble = { w: 200, h: 60 };
const node = (over: Partial<NodeGeom> = {}): NodeGeom => ({
  id: 'n',
  x: 400,
  y: 250,
  width: 60,
  height: 60,
  ...over,
});

describe('geometry helpers', () => {
  it('measures the area two boxes share, and nothing for boxes apart', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(overlapArea(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
    expect(overlapArea(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it('unions boxes, and has nothing to union for none', () => {
    expect(
      unionBox([
        { x: 0, y: 10, w: 10, h: 10 },
        { x: 30, y: 0, w: 5, h: 5 },
      ])
    ).toEqual({ x: 0, y: 0, w: 35, h: 20 });
    expect(unionBox([])).toBeUndefined();
  });

  it('confines a centre so the box stays the stage pad inside', () => {
    expect(confine(10, 100, 800)).toBe(STAGE_PAD + 50);
    expect(confine(400, 100, 800)).toBe(400);
    expect(confine(10, 0, 800)).toBe(10);
  });

  it('anchors below the LABEL, not the visual', () => {
    const anchor = anchorOf(node({ labelH: 20, labelW: 80 }));
    // visual bottom 280, + 6 gap + 20 label.
    expect(anchor).toEqual({ x: 400, top: 220, bottom: 306 });
  });
});

describe('planAnchored', () => {
  const anchor = anchorOf(node());
  const self = [{ x: 370, y: 220, w: 60, h: 60 }];

  it('sits right above its node when nothing is there', () => {
    const plan = planAnchored(anchor, bubble, stage, self);
    expect(plan).toEqual({ side: 'above', offset: 0 });
    expect(anchoredBox(anchor, plan, bubble, stage).y).toBe(
      220 - NODE_GAP - 60
    );
  });

  it('goes below when there is no room above', () => {
    const high = anchorOf(node({ y: 40 }));
    const plan = planAnchored(high, bubble, stage, [
      { x: 370, y: 10, w: 60, h: 60 },
    ]);
    expect(plan.side).toBe('below');
  });

  it('goes below rather than over a packet flying across above', () => {
    // A packet card straddling the node's top edge, as one leaving it does.
    const packet: Box = { x: 300, y: 150, w: 400, h: 100 };
    const plan = planAnchored(anchor, bubble, stage, [...self, packet]);
    expect(plan).toEqual({ side: 'below', offset: 0 });
  });

  it('moves clear of obstacles on both sides by the smallest needed step', () => {
    // Above AND below the node are taken; the room is further up.
    const obstacles: Box[] = [
      ...self,
      { x: 300, y: 140, w: 400, h: 70 },
      { x: 300, y: 290, w: 400, h: 200 },
    ];
    const plan = planAnchored(anchor, bubble, stage, obstacles);
    expect(plan.side).toBe('above');
    const box = anchoredBox(anchor, plan, bubble, stage);
    expect(box.y + box.h).toBeLessThanOrEqual(140);
    for (const o of obstacles) expect(overlapArea(box, o)).toBe(0);
  });
});

describe('planFree', () => {
  const content: Box = { x: 100, y: 200, w: 600, h: 100 };

  it('centres the bubble in the free band above the diagram', () => {
    const plan = planFree(content, bubble, stage, []);
    expect(plan).toEqual({ left: 300, top: (200 - 60) / 2 });
  });

  it('falls back to the stage edge when the band is too short', () => {
    const plan = planFree({ ...content, y: 50 }, bubble, stage, []);
    expect(plan.top).toBe(STAGE_PAD);
  });

  it('slides aside, then to the band below, to keep clear of a bubble', () => {
    const taken: Box = { x: 250, y: 60, w: 300, h: 80 };
    const aside = planFree(content, bubble, stage, [taken]);
    expect(aside.left).toBe(STAGE_PAD);

    const wide: Box = { x: 0, y: 60, w: 800, h: 80 };
    const below = planFree(content, bubble, stage, [wide]);
    expect(below.top).toBe((300 + 500 - 60) / 2);
  });

  it('stays top-centre with nothing to frame', () => {
    expect(planFree(undefined, bubble, stage, [])).toEqual({
      left: 300,
      top: STAGE_PAD,
    });
  });
});

describe('planBubbles', () => {
  const geometry = {
    a: node({ id: 'a', x: 200 }),
    b: node({ id: 'b', x: 600 }),
  };
  const sizeOf = () => bubble;
  const base = { geometry, stage, sizeOf, fixed: [], timed: [], zones: [] };

  it('ignores a packet that is never on screen with the bubble', () => {
    const plans = planBubbles({
      ...base,
      bubbles: [{ id: 'c', anchorId: 'a', startMs: 0, untilMs: 1000 }],
      timed: [
        {
          box: { x: 100, y: 150, w: 300, h: 80 },
          startMs: 1000,
          untilMs: 2000,
        },
      ],
    });
    expect(plans.get('c')).toMatchObject({ anchored: { side: 'above' } });
  });

  it('avoids a packet for the whole of the bubble lifetime it overlaps', () => {
    const plans = planBubbles({
      ...base,
      bubbles: [{ id: 'c', anchorId: 'a', startMs: 0, untilMs: 1000 }],
      timed: [
        { box: { x: 100, y: 150, w: 300, h: 80 }, startMs: 900, untilMs: 2000 },
      ],
    });
    expect(plans.get('c')).toMatchObject({ anchored: { side: 'below' } });
  });

  it('keeps an earlier bubble in place and moves the later one', () => {
    const plans = planBubbles({
      ...base,
      bubbles: [
        { id: 'first', anchorId: 'a', startMs: 0, untilMs: 3000 },
        { id: 'free', startMs: 1000, untilMs: 3000 },
      ],
    });
    const first = plans.get('first')!.box;
    const free = plans.get('free')!.box;
    expect(plans.get('first')).toMatchObject({ anchored: { side: 'above' } });
    expect(overlapArea(first, free)).toBe(0);
  });

  it('gives no plan to a bubble whose node or size is unknown', () => {
    const plans = planBubbles({
      ...base,
      sizeOf: (id) => (id === 'unsized' ? undefined : bubble),
      bubbles: [
        { id: 'ghost', anchorId: 'missing', startMs: 0, untilMs: 1 },
        { id: 'unsized', startMs: 0, untilMs: 1 },
      ],
    });
    expect(plans.size).toBe(0);
  });
});
