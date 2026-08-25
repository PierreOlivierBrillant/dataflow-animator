import { describe, expect, it } from 'vitest';
import { blockGeometry } from './blockGeometry';
import { resolvePin } from './pins';
import type { BlockPin, Node } from '../types';

const block = (pins: BlockPin[], body?: string): Node => ({
  id: 'b',
  type: 'block',
  ...(body ? { body } : {}),
  pins,
});

describe('blockGeometry — faces', () => {
  it('defaults a pin with no side to the left face', () => {
    const g = blockGeometry(block([{ name: 'a' }]));

    expect(g.pins.a.x).toBe(0);
    expect(g.pins.a.nx).toBeLessThan(0);
  });

  it('points every normal outward', () => {
    const g = blockGeometry(
      block([
        { name: 'l', side: 'left' },
        { name: 'r', side: 'right' },
        { name: 't', side: 'top' },
        { name: 'b', side: 'bottom' },
      ])
    );

    expect(g.pins.l).toMatchObject({ x: 0, nx: -1, ny: 0 });
    expect(g.pins.r).toMatchObject({ x: 1, nx: 1, ny: 0 });
    expect(g.pins.t).toMatchObject({ y: 0, nx: 0, ny: -1 });
    expect(g.pins.b).toMatchObject({ y: 1, nx: 0, ny: 1 });
  });

  it('spreads a face evenly and keeps declaration order', () => {
    const g = blockGeometry(
      block([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }])
    );
    const ys = ['a', 'b', 'c', 'd'].map((n) => g.pins[n].y);

    expect(ys).toEqual([...ys].sort((x, y) => x - y));
    // Even spacing: the three gaps are identical.
    const gaps = [ys[1] - ys[0], ys[2] - ys[1], ys[3] - ys[2]];
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10);
  });

  it('centres a lone output BETWEEN the inputs facing it', () => {
    // The 4:1 multiplexer case, and the reason both faces are measured against
    // the same inner band: a shared row grid would push `y` onto `i1`'s row.
    const g = blockGeometry(
      block([
        { name: 'i0' },
        { name: 'i1' },
        { name: 'i2' },
        { name: 'i3' },
        { name: 'y', side: 'right' },
      ])
    );

    expect(g.pins.y.y).toBeGreaterThan(g.pins.i1.y);
    expect(g.pins.y.y).toBeLessThan(g.pins.i2.y);
    expect(g.pins.y.y).toBeCloseTo((g.pins.i1.y + g.pins.i2.y) / 2, 10);
  });
});

describe('blockGeometry — sizing', () => {
  it('grows taller with the busiest vertical face, not with the total', () => {
    const one = blockGeometry(block([{ name: 'a' }]));
    const four = blockGeometry(
      block([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }])
    );
    // Four on the left and four on the right is the same height as four alone:
    // they share the rows.
    const paired = blockGeometry(
      block([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
        { name: 'd' },
        { name: 'w', side: 'right' },
        { name: 'x', side: 'right' },
        { name: 'y', side: 'right' },
        { name: 'z', side: 'right' },
      ])
    );

    expect(four.h).toBeGreaterThan(one.h);
    expect(paired.h).toBe(four.h);
  });

  it('grows wider with the longest label and with the body', () => {
    const short = blockGeometry(block([{ name: 'a' }]));
    const long = blockGeometry(block([{ name: 'a', label: 'CLK_ENABLE' }]));
    const titled = blockGeometry(block([{ name: 'a' }], 'REGISTER 8'));

    expect(long.w).toBeGreaterThan(short.w);
    expect(titled.w).toBeGreaterThan(short.w);
  });

  it('keeps a terminal out of the perpendicular face label band', () => {
    const g = blockGeometry(
      block([{ name: 'a' }, { name: 'b' }, { name: 'sel', side: 'bottom' }])
    );

    expect(g.pad.bottom).toBeGreaterThan(0);
    // The lowest left terminal stays above the band the bottom label claims.
    expect(g.pins.b.y * g.h).toBeLessThan(g.h - g.pad.bottom);
    // …and the bottom terminal stays right of the left label column.
    expect(g.pins.sel.x * g.w).toBeGreaterThan(g.pad.left);
  });

  it('never collapses below a minimum box', () => {
    const g = blockGeometry(block([]));

    expect(g.w).toBeGreaterThanOrEqual(56);
    expect(g.h).toBeGreaterThanOrEqual(44);
    expect(g.rows).toEqual([]);
  });
});

describe('blockGeometry — the renderer and the router read ONE result', () => {
  it('publishes each row at the fraction its terminal sits on', () => {
    // The labels are drawn from `rows[].at` and the wires land on `pins[].x/y`.
    // If these two ever diverge, a block prints a name where no wire arrives —
    // which is exactly what a single source of truth is here to prevent.
    const node = block([
      { name: 'i0' },
      { name: 'i1' },
      { name: 'y', side: 'right' },
      { name: 'sel', side: 'bottom' },
    ]);
    const g = blockGeometry(node);

    for (const row of g.rows) {
      const def = g.pins[row.pin.name];
      const along = row.side === 'top' || row.side === 'bottom' ? def.x : def.y;
      expect(along, row.pin.name).toBe(row.at);
    }
  });

  it('is what resolvePin answers for a block', () => {
    const node = block([{ name: 'i0' }, { name: 'y', side: 'right' }]);

    expect(resolvePin(node, 'y')).toEqual(blockGeometry(node).pins.y);
    expect(resolvePin(node, 'nope')).toBeUndefined();
  });

  it('memoises per node object, so a wired block computes its box once', () => {
    const node = block([{ name: 'a' }]);

    expect(blockGeometry(node)).toBe(blockGeometry(node));
  });
});
