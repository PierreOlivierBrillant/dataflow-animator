import { describe, expect, it } from 'vitest';
import { nodeTint } from './nodeColors';
import type { Node } from '../types';

const node = (extra: Partial<Node>): Node => ({
  id: 'n',
  type: 'square',
  ...extra,
});

// nodeTint returns a CSSProperties object; custom properties are read by key.
const vars = (n: Node) => nodeTint(n) as Record<string, string | undefined>;

describe('nodeTint — node tint variables', () => {
  it('no color: no variable set', () => {
    expect(nodeTint(node({}))).toEqual({});
  });

  it('background_color alone: sets --rdfa-fill and derives a complementary border', () => {
    const v = vars(node({ background_color: '#3b82f6' }));
    expect(v['--rdfa-fill']).toBe('#3b82f6');
    // Auto border = darkened background via color-mix (pure CSS, handles names + hex).
    expect(v['--rdfa-stroke']).toBe('color-mix(in srgb, #3b82f6, #000 32%)');
  });

  it('predefined color (name): accepted as-is in the color-mix', () => {
    const v = vars(node({ background_color: 'steelblue' }));
    expect(v['--rdfa-fill']).toBe('steelblue');
    expect(v['--rdfa-stroke']).toBe('color-mix(in srgb, steelblue, #000 32%)');
  });

  it('border_color alone: sets --rdfa-stroke, no --rdfa-fill', () => {
    const v = vars(node({ border_color: 'tomato' }));
    expect(v['--rdfa-fill']).toBeUndefined();
    expect(v['--rdfa-stroke']).toBe('tomato');
  });

  it('both provided: explicit border_color wins (no derivation)', () => {
    const v = vars(node({ background_color: '#fff', border_color: '#000' }));
    expect(v['--rdfa-fill']).toBe('#fff');
    expect(v['--rdfa-stroke']).toBe('#000');
  });

  it('explicit text_color: sets --rdfa-ink as-is', () => {
    const v = vars(node({ text_color: 'rebeccapurple' }));
    expect(v['--rdfa-ink']).toBe('rebeccapurple');
    // text_color alone does not create a background or border.
    expect(v['--rdfa-fill']).toBeUndefined();
    expect(v['--rdfa-stroke']).toBeUndefined();
  });

  it('text_color absent + background: --rdfa-ink auto-contrasts (oklch)', () => {
    const v = vars(node({ background_color: '#1e3a8a' }));
    expect(v['--rdfa-ink']).toContain('oklch(from var(--rdfa-fill)');
  });

  it('explicit text_color wins over auto-contrast even with a background', () => {
    const v = vars(
      node({ background_color: '#1e3a8a', text_color: '#fde68a' })
    );
    expect(v['--rdfa-ink']).toBe('#fde68a');
  });

  it('no color: no --rdfa-ink (theme text)', () => {
    expect(vars(node({}))['--rdfa-ink']).toBeUndefined();
  });
});
