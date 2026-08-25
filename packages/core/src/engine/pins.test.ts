import { describe, expect, it } from 'vitest';
import {
  COMPONENT_PINS,
  commutativeInputPins,
  hasPins,
  hasUniformBody,
  isLogicDriver,
  parseRef,
  refNode,
  resolvePin,
} from './pins';
import type { Node, NodeType } from '../types';

/** Minimal node of a given type — the terminal tables are keyed by type for
 *  every symbol except `block`, which brings its own (see blockGeometry.test). */
const of = (type: NodeType, extra: Partial<Node> = {}): Node => ({
  id: type,
  type,
  ...extra,
});

describe('parseRef', () => {
  it('splits a "node:pin" reference on the first colon', () => {
    expect(parseRef('R1:a')).toEqual({ node: 'R1', pin: 'a' });
    expect(parseRef('Q1:base')).toEqual({ node: 'Q1', pin: 'base' });
  });

  it('returns no pin for a bare node id', () => {
    expect(parseRef('battery')).toEqual({ node: 'battery' });
  });

  it('treats a trailing empty pin as no pin', () => {
    expect(parseRef('node:')).toEqual({ node: 'node' });
  });

  it('splits on the FIRST colon only (pin may contain more)', () => {
    expect(parseRef('n:a:b')).toEqual({ node: 'n', pin: 'a:b' });
  });
});

describe('refNode', () => {
  it('drops the pin part', () => {
    expect(refNode('R1:a')).toBe('R1');
    expect(refNode('R1')).toBe('R1');
    expect(refNode('n:')).toBe('n');
  });
});

describe('resolvePin', () => {
  it('resolves a known terminal of a component type', () => {
    expect(resolvePin(of('resistor'), 'a')).toEqual({
      x: 0,
      y: 0.5,
      nx: -1,
      ny: 0,
    });
    expect(resolvePin(of('resistor'), 'b')).toEqual({
      x: 1,
      y: 0.5,
      nx: 1,
      ny: 0,
    });
  });

  it('resolves the polarity aliases of a source', () => {
    expect(resolvePin(of('battery'), '+')).toEqual(
      resolvePin(of('battery'), 'b')
    );
    expect(resolvePin(of('battery'), '-')).toEqual(
      resolvePin(of('battery'), 'a')
    );
  });

  it('resolves the three transistor terminals distinctly', () => {
    const base = resolvePin(of('transistor_npn'), 'base');
    const collector = resolvePin(of('transistor_npn'), 'collector');
    const emitter = resolvePin(of('transistor_npn'), 'emitter');
    expect(base).toBeDefined();
    expect(collector).toBeDefined();
    expect(emitter).toBeDefined();
    expect(collector).not.toEqual(emitter);
  });

  it('resolves logic-gate terminals: a/b inputs on the left, y output on the right', () => {
    const a = resolvePin(of('and_gate'), 'a')!;
    const b = resolvePin(of('and_gate'), 'b')!;
    const y = resolvePin(of('and_gate'), 'y')!;
    expect(a.nx).toBeLessThan(0); // input, faces left
    expect(b.nx).toBeLessThan(0);
    expect(y.nx).toBeGreaterThan(0); // output, faces right
    expect(a.y).toBeLessThan(b.y); // a above b
    expect(resolvePin(of('and_gate'), 'out')).toEqual(y); // alias
    // NOT gate has a single input.
    expect(resolvePin(of('not_gate'), 'a')!.nx).toBeLessThan(0);
    expect(resolvePin(of('not_gate'), 'y')!.nx).toBeGreaterThan(0);
  });

  it('returns undefined for no pin, unknown pin, or a type without terminals', () => {
    expect(resolvePin(of('resistor'), undefined)).toBeUndefined();
    expect(resolvePin(of('resistor'), 'zzz')).toBeUndefined();
    expect(resolvePin(of('server'), 'a')).toBeUndefined();
  });
});

describe('COMPONENT_PINS catalog', () => {
  it('every terminal carries a position and an outward normal', () => {
    for (const [, pins] of Object.entries(COMPONENT_PINS)) {
      for (const [, def] of Object.entries(pins!)) {
        expect(def.x).toBeGreaterThanOrEqual(0);
        expect(def.x).toBeLessThanOrEqual(1);
        expect(def.y).toBeGreaterThanOrEqual(0);
        expect(def.y).toBeLessThanOrEqual(1);
        expect(Math.hypot(def.nx, def.ny)).toBeGreaterThan(0);
      }
    }
  });
});

describe('three-input logic gates', () => {
  it('spreads a/b/c down the left face with the output on the right', () => {
    for (const type of [
      'and3_gate',
      'or3_gate',
      'nand3_gate',
      'nor3_gate',
      'xor3_gate',
    ] as const) {
      const a = resolvePin(of(type), 'a')!;
      const b = resolvePin(of(type), 'b')!;
      const c = resolvePin(of(type), 'c')!;
      const y = resolvePin(of(type), 'y')!;

      expect([a.nx, b.nx, c.nx].every((nx) => nx < 0)).toBe(true);
      expect(a.y).toBeLessThan(b.y);
      expect(b.y).toBeLessThan(c.y);
      // The middle input is at mid-height, so a straight wire needs no bend.
      expect(b.y).toBe(0.5);
      expect(y.nx).toBeGreaterThan(0);
      expect(resolvePin(of(type), 'out')).toEqual(y);
    }
  });
});

describe('fixed-pin functional blocks', () => {
  it('gives every bistable a q / qn pair on the right, qn below q', () => {
    for (const type of [
      'd_flip_flop',
      'jk_flip_flop',
      't_flip_flop',
      'sr_latch',
    ] as const) {
      const q = resolvePin(of(type), 'q')!;
      const qn = resolvePin(of(type), 'qn')!;

      expect(q.nx).toBeGreaterThan(0);
      expect(qn.nx).toBeGreaterThan(0);
      expect(q.y).toBeLessThan(qn.y);
      expect(resolvePin(of(type), 'q_bar')).toEqual(qn);
    }
  });

  it('brings a (de)multiplexer select line in from BELOW', () => {
    for (const type of ['mux_2to1', 'demux_1to2'] as const) {
      const sel = resolvePin(of(type), 'sel')!;

      expect(sel.ny).toBeGreaterThan(0); // outward normal points down
      expect(sel.y).toBe(1);
      expect(resolvePin(of(type), 's')).toEqual(sel);
    }
  });

  it('adds cin to the full adder that the half adder does not have', () => {
    expect(resolvePin(of('half_adder'), 'cin')).toBeUndefined();
    expect(resolvePin(of('full_adder'), 'cin')!.nx).toBeLessThan(0);
    // Sum above carry on both, so one reads as the other minus a terminal.
    expect(resolvePin(of('half_adder'), 's')!.y).toBeLessThan(
      resolvePin(of('half_adder'), 'cout')!.y
    );
    expect(resolvePin(of('full_adder'), 's')!.y).toBeLessThan(
      resolvePin(of('full_adder'), 'cout')!.y
    );
  });
});

describe('commutativeInputPins', () => {
  it('names pins the component actually declares', () => {
    // A typo here disables the router's swap SILENTLY: it looks up a pin that
    // is never found and the group is dropped, with no error anywhere.
    for (const type of Object.keys(COMPONENT_PINS) as NodeType[]) {
      const pair = commutativeInputPins(type);
      if (!pair) continue;
      expect(resolvePin(of(type), pair[0])).toBeDefined();
      expect(resolvePin(of(type), pair[1])).toBeDefined();
      expect(pair[0]).not.toBe(pair[1]);
    }
  });

  it('offers the OUTER two inputs of a three-input gate', () => {
    expect(commutativeInputPins('and3_gate')).toEqual(['a', 'c']);
  });

  it('leaves order-sensitive terminals alone', () => {
    expect(commutativeInputPins('opamp')).toBeUndefined();
    expect(commutativeInputPins('transistor_npn')).toBeUndefined();
    // J and K are NOT interchangeable: swapping them inverts the flip-flop.
    expect(commutativeInputPins('jk_flip_flop')).toBeUndefined();
  });
});

describe('isLogicDriver', () => {
  it('covers every gate and every block that produces a bit', () => {
    for (const type of [
      'signal',
      'and_gate',
      'buffer_gate',
      'nand3_gate',
      'd_flip_flop',
      'sr_latch',
      'mux_2to1',
      'full_adder',
    ] as const)
      expect(isLogicDriver(type)).toBe(true);
  });

  it('excludes what merely PASSES or shares a net', () => {
    // `transmission_gate` ends in `_gate` and is not a driver — the exact case
    // the old `endsWith('_gate')` rule got wrong.
    expect(isLogicDriver('transmission_gate')).toBe(false);
    // In a CMOS gate the pull-up and pull-down networks share one output node,
    // so colouring by source node would paint one net in several colours.
    expect(isLogicDriver('mosfet_n')).toBe(false);
    expect(isLogicDriver('mosfet_p')).toBe(false);
    expect(isLogicDriver('battery')).toBe(false);
    expect(isLogicDriver('junction')).toBe(false);
  });
});

describe('hasPins', () => {
  it('is a property of the NODE, not only of its type', () => {
    // Two `block` nodes legitimately disagree: one declares terminals, the other
    // does not — which is why the predicate cannot be keyed by type alone.
    expect(hasPins(of('block', { pins: [{ name: 'a' }] }))).toBe(true);
    expect(hasPins(of('block'))).toBe(false);
    expect(hasPins(of('block', { pins: [] }))).toBe(false);
  });

  it('still answers from the library table for every other type', () => {
    expect(hasPins(of('resistor'))).toBe(true);
    expect(hasPins(of('and_gate'))).toBe(true);
    expect(hasPins(of('signal'))).toBe(false);
    expect(hasPins(of('server'))).toBe(false);
  });
});

describe('hasUniformBody', () => {
  it('excludes the one type that sizes itself', () => {
    // The layout straightens leads by comparing terminal offsets as fractions of
    // each body — only sound while every symbol renders at one size. A block
    // does not, so its fraction must never enter that comparison.
    expect(hasUniformBody(of('block', { pins: [{ name: 'a' }] }))).toBe(false);
    expect(hasUniformBody(of('nand_gate'))).toBe(true);
    expect(hasUniformBody(of('signal'))).toBe(true);
  });
});
