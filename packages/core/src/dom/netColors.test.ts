import { describe, expect, it } from 'vitest';
import { netColorMap } from './netColors';
import { NET_PALETTE } from './stageConstants';
import type { DataFlowSpec } from '../types';

const spec = (over: Partial<DataFlowSpec>): DataFlowSpec => ({
  nodes: [],
  packets: [],
  timeline: [],
  ...over,
});

describe('netColorMap', () => {
  it('is empty outside a circuit', () => {
    const s = spec({
      direction: 'left-to-right',
      nodes: [{ id: 'a', type: 'signal' }],
      connections: [{ from: 'a', to: 'b' }],
    });

    expect(netColorMap(s).size).toBe(0);
  });

  it('tints one net per logic driver, in first-appearance order', () => {
    const s = spec({
      direction: 'circuit',
      nodes: [
        { id: 'a', type: 'signal' },
        { id: 'b', type: 'signal' },
        { id: 'g', type: 'and_gate' },
      ],
      connections: [
        { from: 'a', to: 'g:a' },
        { from: 'b', to: 'g:b' },
        { from: 'g', to: 'out' },
      ],
    });
    const map = netColorMap(s);

    expect(map.get('a')).toBe(NET_PALETTE[0]);
    expect(map.get('b')).toBe(NET_PALETTE[1]);
    expect(map.get('g')).toBe(NET_PALETTE[2]);
  });

  it('shares one colour across every wire leaving the same driver', () => {
    const s = spec({
      direction: 'circuit',
      nodes: [
        { id: 'a', type: 'signal' },
        { id: 'g', type: 'or_gate' },
      ],
      connections: [
        { from: 'a', to: 'g:a' },
        { from: 'a', to: 'g:b' },
        { from: 'g', to: 'z' },
      ],
    });
    const map = netColorMap(s);

    // Two wires, one driver, one colour — and `g` is still the NEXT index,
    // not the third: a repeated driver must not consume a palette slot.
    expect(map.get('a')).toBe(NET_PALETTE[0]);
    expect(map.get('g')).toBe(NET_PALETTE[1]);
  });

  it('leaves non-logic sources neutral', () => {
    const s = spec({
      direction: 'circuit',
      nodes: [
        { id: 'bat', type: 'battery' },
        { id: 'j', type: 'junction' },
      ],
      connections: [
        { from: 'bat', to: 'j' },
        { from: 'j', to: 'bat' },
      ],
    });

    expect(netColorMap(s).size).toBe(0);
  });

  it('ignores a wire whose source is not a declared node', () => {
    const s = spec({
      direction: 'circuit',
      nodes: [],
      connections: [{ from: 'ghost', to: 'x' }],
    });

    expect(netColorMap(s).size).toBe(0);
  });

  it('handles no connections at all', () => {
    expect(netColorMap(spec({ direction: 'circuit' })).size).toBe(0);
  });

  it('wraps around the palette', () => {
    const n = NET_PALETTE.length;
    const s = spec({
      direction: 'circuit',
      nodes: Array.from({ length: n + 1 }, (_, i) => ({
        id: `s${i}`,
        type: 'signal' as const,
      })),
      connections: Array.from({ length: n + 1 }, (_, i) => ({
        from: `s${i}`,
        to: 'g',
      })),
    });
    const map = netColorMap(s);

    expect(map.get(`s${n}`)).toBe(NET_PALETTE[0]);
  });
});

describe('netColorMap — drivers beyond the gates', () => {
  it('tints the net a flip-flop output drives', () => {
    const s = spec({
      direction: 'circuit',
      nodes: [{ id: 'ff', type: 'd_flip_flop' }],
      connections: [{ from: 'ff:q', to: 'out' }],
    });

    expect(netColorMap(s).get('ff')).toBe(NET_PALETTE[0]);
  });

  it('leaves a transmission gate and a MOSFET neutral', () => {
    // `transmission_gate` ends in `_gate` but PASSES a net rather than driving
    // one; a CMOS pull-up/pull-down pair SHARES its output node, so tinting per
    // source node would paint one net in two colours.
    const s = spec({
      direction: 'circuit',
      nodes: [
        { id: 'tg', type: 'transmission_gate' },
        { id: 'm1', type: 'mosfet_n' },
      ],
      connections: [
        { from: 'tg:b', to: 'out' },
        { from: 'm1:d', to: 'out' },
      ],
    });

    expect(netColorMap(s).size).toBe(0);
  });
});
