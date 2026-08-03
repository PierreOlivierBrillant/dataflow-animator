import { describe, expect, it } from 'vitest';
import { isPlainText, parseMath, parseRichText } from './parse';

describe('parseRichText — $…$ segmentation', () => {
  it('without $, the string stays a single literal', () => {
    expect(parseRichText('R1 · 10 kΩ')).toEqual([
      { kind: 'literal', value: 'R1 · 10 kΩ' },
    ]);
  });

  it('isolates the math segment and keeps the surrounding prose', () => {
    const segs = parseRichText('Retenue $B_{in}$ à 1');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: 'literal', value: 'Retenue ' });
    expect(segs[1].kind).toBe('math');
    expect(segs[2]).toEqual({ kind: 'literal', value: ' à 1' });
  });

  it('an unpaired $ stays literal (no half-open math)', () => {
    expect(parseRichText('coût: 5$')).toEqual([
      { kind: 'literal', value: 'coût: 5$' },
    ]);
  });

  it('\\$ produces a literal dollar sign without opening math', () => {
    expect(parseRichText('\\$5 et \\$7')).toEqual([
      { kind: 'literal', value: '$5 et $7' },
    ]);
  });

  it('an escaped $ INSIDE the segment does not close it', () => {
    const segs = parseRichText('$a \\$ b$ fin');
    expect(segs[0].kind).toBe('math');
    expect(segs[1]).toEqual({ kind: 'literal', value: ' fin' });
  });

  it('$$ (display math, unsupported) stays literal instead of being swallowed', () => {
    expect(parseRichText('a $$ b')).toEqual([
      { kind: 'literal', value: 'a $$ b' },
    ]);
  });

  it('an underscore outside math does NOT become a subscript (backwards compatibility)', () => {
    expect(isPlainText('snake_case')).toBe(true);
    expect(parseRichText('snake_case')).toEqual([
      { kind: 'literal', value: 'snake_case' },
    ]);
  });
});

describe('parseMath — LaTeX subset', () => {
  it('braced subscript', () => {
    expect(parseMath('B_{in}')).toEqual([
      { kind: 'var', value: 'B' },
      { kind: 'sub', children: [{ kind: 'var', value: 'in' }] },
    ]);
  });

  it('single-character subscript: x_1 == x_{1}', () => {
    expect(parseMath('x_1')).toEqual(parseMath('x_{1}'));
  });

  it('superscript', () => {
    expect(parseMath('x^2')).toEqual([
      { kind: 'var', value: 'x' },
      { kind: 'sup', children: [{ kind: 'text', value: '2' }] },
    ]);
  });

  it('splits variables (italic) and non-variables (upright) within the same run', () => {
    expect(parseMath('2x')).toEqual([
      { kind: 'text', value: '2' },
      { kind: 'var', value: 'x' },
    ]);
  });

  it('\\overline — the logical complement', () => {
    expect(parseMath('\\overline{A}')).toEqual([
      { kind: 'over', children: [{ kind: 'var', value: 'A' }] },
    ]);
  });

  it('lowercase Greek = variable (italic), uppercase and units = upright', () => {
    expect(parseMath('\\mu')).toEqual([{ kind: 'var', value: 'μ' }]);
    expect(parseMath('\\Omega')).toEqual([{ kind: 'text', value: 'Ω' }]);
  });

  it('operators and arrows', () => {
    expect(parseMath('\\cdot\\to\\leq')).toEqual([
      { kind: 'text', value: '·' },
      { kind: 'text', value: '→' },
      { kind: 'text', value: '≤' },
    ]);
  });

  it('\\text renders its argument upright, spaces included', () => {
    expect(parseMath('\\text{in out}')).toEqual([
      { kind: 'text', value: 'in out' },
    ]);
  });

  it('spacing commands', () => {
    expect(parseMath('\\,')).toEqual([{ kind: 'space', em: 0.167 }]);
    expect(parseMath('\\quad')).toEqual([{ kind: 'space', em: 1 }]);
  });

  it('group: several atoms under the same subscript', () => {
    expect(parseMath('A_{n+1}')).toEqual([
      { kind: 'var', value: 'A' },
      {
        kind: 'sub',
        children: [
          { kind: 'var', value: 'n' },
          // '+1' is one upright run: only the variable/non-variable frontier
          // splits a run, so the AST stays as small as the styling requires.
          { kind: 'text', value: '+1' },
        ],
      },
    ]);
  });

  it('an unknown command is ignored rather than rendered literally', () => {
    expect(parseMath('A\\frobnicate B')).toEqual([
      { kind: 'var', value: 'A' },
      { kind: 'text', value: ' ' },
      { kind: 'var', value: 'B' },
    ]);
  });

  it('does not loop on malformed input', () => {
    // Each of these once risked leaving the cursor un-advanced.
    for (const src of ['_', '^', '{', '}', '\\', 'a_{', '\\overline', '_{}']) {
      expect(() => parseMath(src)).not.toThrow();
    }
  });
});
