/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { nodeIconTypes, renderNodeIcon } from './nodeIcons';
import { NODE_ICON_SHAPES } from './nodeIconShapes';
import { COMPONENT_PINS } from '../../engine/pins';
import type { NodeType } from '../../types';

describe('renderNodeIcon — wrapper', () => {
  it('emits the shared svg wrapper with DOM attribute names', () => {
    const svg = renderNodeIcon('server');

    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe(
      'var(--rdfa-fill, var(--rdfa-node-bg, #fff))'
    );
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('1.6');
    expect(svg.getAttribute('stroke-linecap')).toBe('round');
    expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    expect(svg.getAttribute('role')).toBe('presentation');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the transcribed geometry', () => {
    const svg = renderNodeIcon('desktop');

    expect(svg.outerHTML).toContain(
      '<rect x="2.5" y="4" width="19" height="12" rx="1.5"></rect>'
    );
    expect(svg.outerHTML).toContain('<path d="M9 20h6M12 16v4"></path>');
  });

  it('keeps the fill="none" opt-out on bare strokes', () => {
    // A coil has no interior: filling it would web the humps shut.
    const paths = [...renderNodeIcon('inductor').querySelectorAll('path')];

    expect(paths.every((p) => p.getAttribute('fill') === 'none')).toBe(true);
  });

  it('keeps fill="currentColor" on a solid dot', () => {
    const dot = renderNodeIcon('junction').querySelector('circle');

    expect(dot?.getAttribute('fill')).toBe('currentColor');
  });

  it('falls back to a plain rounded square for an unknown type', () => {
    const svg = renderNodeIcon('not_a_real_type' as NodeType);

    expect(svg.innerHTML).toBe(
      '<rect x="4" y="4" width="16" height="16" rx="2"></rect>'
    );
  });

  it('draws every registered type without throwing', () => {
    for (const type of nodeIconTypes()) {
      const svg = renderNodeIcon(type as NodeType);
      expect(svg.children.length, `${type} drew nothing`).toBeGreaterThan(0);
    }
  });
});

describe('renderNodeIcon — stateful contacts', () => {
  /** The lever is the last shape of the switch pictogram. */
  const leverOf = (closed: number): string | null =>
    renderNodeIcon('switch', { closed }).lastElementChild?.getAttribute('d') ??
    null;

  it('swings the switch lever down as it closes', () => {
    // Open: the lever ends high (y = 5). Closed: it lands on the contact
    // (y = 12), lerped between the two.
    expect(leverOf(0)).toBe('M6 12L17.20 5.00');
    expect(leverOf(1)).toBe('M6 12L18.00 12.00');
    expect(leverOf(0.5)).toBe('M6 12L17.60 8.50');
  });

  it('defaults the switch to open', () => {
    expect(renderNodeIcon('switch').lastElementChild?.getAttribute('d')).toBe(
      'M6 12L17.20 5.00'
    );
  });

  it('drops the push-button plunger as it closes', () => {
    const barOf = (closed?: number): string | null =>
      renderNodeIcon('push_button', closed == null ? undefined : { closed })
        .querySelectorAll('path')[1]
        .getAttribute('d');

    expect(barOf(0)).toBe('M6 8.00h12');
    expect(barOf(1)).toBe('M6 11.40h12');
    expect(barOf()).toBe('M6 8.00h12');
  });

  it('ignores `closed` for every other type', () => {
    const a = renderNodeIcon('server', { closed: 0 }).outerHTML;
    const b = renderNodeIcon('server', { closed: 1 }).outerHTML;

    expect(a).toBe(b);
  });
});

describe('registry', () => {
  it('reports exactly the transcribed types', () => {
    expect(nodeIconTypes().sort()).toEqual(
      Object.keys(NODE_ICON_SHAPES).sort()
    );
  });

  it('gives every pictogram at least one shape', () => {
    for (const [type, shapes] of Object.entries(NODE_ICON_SHAPES)) {
      expect(shapes?.length, `${type} is empty`).toBeGreaterThan(0);
    }
  });
});

describe('functional-block designators', () => {
  it('renders the label as text content, not as an attribute', () => {
    const text = renderNodeIcon('half_adder').querySelector('text');

    expect(text?.textContent).toBe('HA');
  });

  it('opts the glyph out of the inherited stroke', () => {
    // The wrapper strokes every child with a 1.6-wide currentColor; on a glyph
    // that paints a fat outline over its own counters and "HA" becomes a blob.
    for (const type of ['d_flip_flop', 'mux_2to1', 'full_adder'] as const) {
      const text = renderNodeIcon(type).querySelector('text')!;

      expect(text.getAttribute('stroke'), type).toBe('none');
      expect(text.getAttribute('fill'), type).toBe('currentColor');
    }
  });
});

describe('symbols with named terminals', () => {
  it('draws a dedicated pictogram for every type declaring pins', () => {
    // A type added to COMPONENT_PINS but not to the shape table falls back to a
    // plain square, whose blank edges give the wire nothing to land on.
    const fallback = '<rect x="4" y="4" width="16" height="16" rx="2"></rect>';
    for (const type of Object.keys(COMPONENT_PINS) as NodeType[]) {
      expect(renderNodeIcon(type).innerHTML, `${type} has no symbol`).not.toBe(
        fallback
      );
    }
  });
});
