import { describe, it, expect } from 'vitest';
import {
  computePlacements,
  computeContentLimits,
  PLACEMENT_PAD,
  shrinksToFit,
} from './placements';
import type { GeometryMap } from './geometry';

describe('computePlacements', () => {
  it('empty geometry → returns the layout as is', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 } };
    const result = computePlacements(layout, {}, 800, 600);
    expect(result).toEqual(layout);
  });

  it('width=0 → returns the layout as is', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 } };
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 200, height: 100 },
    };
    const result = computePlacements(layout, geo, 0, 600);
    expect(result).toEqual(layout);
  });

  it('node at the edge (cx=0) with width=200 in canvas 800 → cx shifted up', () => {
    const layout = { a: { cx: 0, cy: 0.5 } };
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 200, height: 100 },
    };
    const result = computePlacements(layout, geo, 800, 600);
    const expected = (200 / 2 + PLACEMENT_PAD) / 800;
    expect(result['a'].cx).toBeCloseTo(expected);
  });

  it('node in the center → unchanged', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 } };
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 200, height: 100 },
    };
    const result = computePlacements(layout, geo, 800, 600);
    expect(result['a'].cx).toBeCloseTo(0.5);
    expect(result['a'].cy).toBeCloseTo(0.5);
  });

  it('node wider than the canvas (2*hwr >= 1) → cx unchanged', () => {
    const layout = { a: { cx: 0.1, cy: 0.5 } };
    // width=200, pad=6 → hwr=(100+6)/200=0.53 → 2*hwr=1.06 >= 1
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 200, height: 50 },
    };
    const result = computePlacements(layout, geo, 200, 600);
    expect(result['a'].cx).toBeCloseTo(0.1);
  });

  it('node with label pushed near the bottom edge → cy shifted up to not clip the label', () => {
    const layout = { a: { cx: 0.5, cy: 0.99 } };
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 40, height: 40, labelH: 18 },
    };
    const result = computePlacements(layout, geo, 800, 400);
    // botR = (20 + (6+18) + 6) / 400 = 50/400 = 0.125 → cy capped at 0.875.
    expect(result['a'].cy).toBeCloseTo(0.875, 5);
  });

  it('label included in the bottom bound but not in the top bound (asymmetry)', () => {
    // Same node pushed UP: only halfH+pad counts (label is under the visual).
    const layout = { a: { cx: 0.5, cy: 0 } };
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 40, height: 40, labelH: 18 },
    };
    const result = computePlacements(layout, geo, 800, 400);
    // topR = (20 + 6) / 400 = 0.065 (the label does NOT expand the top bound).
    expect(result['a'].cy).toBeCloseTo(0.065, 5);
  });

  describe('side label (circuit top/bottom-wired component)', () => {
    const geo: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 40, height: 40, labelW: 80, labelH: 18 },
    };

    it('right label near the right edge → cx shifted left to fit the text', () => {
      const layout = { a: { cx: 1, cy: 0.5 } };
      const result = computePlacements(
        layout,
        geo,
        800,
        400,
        undefined,
        new Map([['a', 'right']])
      );
      // rightR = (20 + (6 + 80) + 6) / 800 = 112/800 = 0.14 → cx capped at 0.86.
      expect(result['a'].cx).toBeCloseTo(0.86, 5);
    });

    it('left label near the left edge → cx shifted right to fit the text', () => {
      const layout = { a: { cx: 0, cy: 0.5 } };
      const result = computePlacements(
        layout,
        geo,
        800,
        400,
        undefined,
        new Map([['a', 'left']])
      );
      // leftR = (20 + (6 + 80) + 6) / 800 = 0.14 → cx floored at 0.14.
      expect(result['a'].cx).toBeCloseTo(0.14, 5);
    });

    it('right label does NOT reserve bottom room → cy free near the bottom edge', () => {
      const layout = { a: { cx: 0.5, cy: 0.98 } };
      const result = computePlacements(
        layout,
        geo,
        800,
        400,
        undefined,
        new Map([['a', 'right']])
      );
      // vR = (max(20, 9) + 6) / 400 = 26/400 = 0.065 → cy capped at 0.935
      // (no LABEL_GAP+labelH bottom band, unlike a below label).
      expect(result['a'].cy).toBeCloseTo(0.935, 5);
    });
  });
});

describe('computeContentLimits', () => {
  // half = 28*scale, gapMargin = max(22*scale, 40) ; gap = half + gapMargin.
  // Horizontal neighbor at distance dx bounds halfW to dx - gap, hence maxW = 2*halfW.
  it('close horizontal neighbor → panel width bounded', () => {
    const layout = { a: { cx: 0.4, cy: 0.5 }, b: { cx: 0.6, cy: 0.5 } };
    const r = computeContentLimits(layout, 1000, 600, 1, 900, 500);
    // a→b : dx=200, half=28, gapMargin=max(22,40)=40, gap=68 → halfW=132 → maxW=264.
    expect(r.a.maxW).toBe(264);
    // no vertical neighbor → height bounded by the edges.
    expect(r.a.maxH).toBe(500); // min(500, 588)
  });

  it('neighbors on 4 sides (cross) → width AND height bounded', () => {
    const layout = {
      c: { cx: 0.5, cy: 0.5 },
      e: { cx: 0.7, cy: 0.5 },
      w: { cx: 0.3, cy: 0.5 },
      n: { cx: 0.5, cy: 0.3 },
      s: { cx: 0.5, cy: 0.7 },
    };
    const r = computeContentLimits(layout, 1000, 600, 1, 900, 500);
    // e/w : dx=200 → halfW=132 → maxW=264 ; n/s : dy=120, gap=68 → halfH=52 → maxH=104.
    expect(r.c.maxW).toBe(264);
    expect(r.c.maxH).toBe(104);
  });

  it('reduced scale (thumbnail) → absolute floor of the gap is active', () => {
    const layout = { a: { cx: 0.4, cy: 0.5 }, b: { cx: 0.6, cy: 0.5 } };
    const r = computeContentLimits(layout, 1000, 600, 0.5, 900, 500);
    // half=14, gapMargin=max(11, 40)=40, gap=54 → halfW=200-54=146 → maxW=292.
    expect(r.a.maxW).toBe(292);
  });

  it('isolated node → bounds = global ceilings', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 } };
    const r = computeContentLimits(layout, 1000, 600, 1, 900, 500);
    expect(r.a.maxW).toBe(900);
    expect(r.a.maxH).toBe(500);
  });

  it('floor: never goes below MIN_CONTENT_BOX (48)', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 }, b: { cx: 0.52, cy: 0.5 } };
    const r = computeContentLimits(layout, 1000, 600, 1, 900, 500);
    // dx=20 → halfW=20-50=-30 → 2*halfW<0 → floored to 48.
    expect(r.a.maxW).toBe(48);
  });

  it('width=0 → global ceilings for all', () => {
    const layout = { a: { cx: 0.5, cy: 0.5 } };
    const r = computeContentLimits(layout, 0, 600, 1, 900, 500);
    expect(r.a).toEqual({ maxW: 900, maxH: 500 });
  });

  describe('slide', () => {
    // a near the left edge, b in the middle: a's panel used to get twice its
    // distance to the edge, while the room toward b went unused.
    const layout = { a: { cx: 0.1, cy: 0.5 }, b: { cx: 0.5, cy: 0.5 } };

    it('bounds each side on its own and adds them up', () => {
      const r = computeContentLimits(layout, 1000, 600, 1, 900, 500, {
        slide: true,
      });
      // left: 100 - 6 = 94 ; right: dx=400 - gap 68 = 332.
      expect(r.a.slide?.room).toEqual({
        left: 94,
        right: 332,
        up: 294,
        down: 294,
      });
      expect(r.a.slide?.maxW).toBe(426);
      // The centred limits are still there, for a panel that does not slide.
      expect(r.a.maxW).toBe(188);
    });

    it('has no sliding limits without it', () => {
      const r = computeContentLimits(layout, 1000, 600, 1, 900, 500);
      expect(r.a.maxW).toBe(188);
      expect(r.a.slide).toBeUndefined();
    });

    it('meets a neighbour that shows a panel too halfway', () => {
      const r = computeContentLimits(layout, 1000, 600, 1, 900, 500, {
        slide: true,
        panelNodes: new Set(['b']),
      });
      // (400 - margin 40) / 2 = 180, short of the 332 up to b's icon.
      expect(r.a.slide?.room.right).toBe(180);
      // The centred limit ignores it, as before.
      expect(r.a.maxW).toBe(188);
    });

    it('never counts the room on a side the neighbour margin overruns', () => {
      // b is 20px away: its margin covers a's centre, so a's panel may only
      // extend leftward (94px) — not leftward minus the overrun.
      const tight = { a: { cx: 0.1, cy: 0.5 }, b: { cx: 0.12, cy: 0.5 } };
      const r = computeContentLimits(tight, 1000, 600, 1, 900, 500, {
        slide: true,
      });
      expect(r.a.slide?.maxW).toBe(94);
    });
  });
});

describe('shrinksToFit', () => {
  it('is true for what scales down, false for what wraps', () => {
    expect(shrinksToFit({ type: 'code', value: 'x' })).toBe(true);
    expect(shrinksToFit({ type: 'image', value: 'a.png' })).toBe(true);
    expect(
      shrinksToFit({ type: 'html', value: '<p/>', screen_width: 800 })
    ).toBe(true);
    expect(shrinksToFit({ type: 'html', value: '<p/>' })).toBe(false);
    expect(shrinksToFit({ type: 'text', value: 'x' })).toBe(false);
    expect(shrinksToFit({ value: 'x' })).toBe(false);
  });
});

describe('computePlacements — rooms', () => {
  const geo: GeometryMap = {
    a: { id: 'a', x: 0, y: 0, width: 400, height: 100 },
  };
  const layout = { a: { cx: 0.1, cy: 0.5 } };
  const room = { left: 94, right: 332, up: 294, down: 294 };

  it('slides a panel wider than its centred share toward the free side', () => {
    const r = computePlacements(layout, geo, 1000, 600, undefined, undefined, {
      a: room,
    });
    // Its left edge stops at the room's (100 - 94 = 6): centre at 6 + 200.
    expect(r.a.cx * 1000).toBeCloseTo(206);
    expect(r.a.cy).toBeCloseTo(0.5);
  });

  it('leaves a panel that fits centred where it is', () => {
    const small: GeometryMap = {
      a: { id: 'a', x: 0, y: 0, width: 150, height: 100 },
    };
    const r = computePlacements(
      layout,
      small,
      1000,
      600,
      undefined,
      undefined,
      {
        a: room,
      }
    );
    expect(r.a.cx).toBeCloseTo(0.1);
  });

  it('slides away from a neighbour, not only from an edge', () => {
    const mid = { a: { cx: 0.5, cy: 0.5 } };
    const r = computePlacements(mid, geo, 1000, 600, undefined, undefined, {
      a: { left: 400, right: 100, up: 294, down: 294 },
    });
    // Right edge stops 100px right of 500: centre at 600 - 200.
    expect(r.a.cx * 1000).toBeCloseTo(400);
  });

  it('only moves the nodes it is given a room for', () => {
    const r = computePlacements(layout, geo, 1000, 600);
    // The edge clamp alone: half-width 200 + pad 6.
    expect(r.a.cx * 1000).toBeCloseTo(206);
    const centred = computePlacements(
      { a: { cx: 0.5, cy: 0.5 } },
      geo,
      1000,
      600
    );
    expect(centred.a.cx).toBeCloseTo(0.5);
  });
});
