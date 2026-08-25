/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import {
  applyNodeElement,
  buildNodeElement,
  renderNodeVisual,
} from './nodeElement';
import { escapeHtml } from '../highlight/highlight';
import type { Node } from '../types';

/** Unwraps to the element: most assertions here do not care about the code-fit
 *  handle that comes with a `code` content panel. */
const buildHandle = (node: Node, options = {}) =>
  buildNodeElement(node, {
    placement: { cx: 0.25, cy: 0.5 },
    highlight: escapeHtml,
    ...options,
  });

const build = (node: Node, options = {}) => buildHandle(node, options).el;

describe('buildNodeElement — root', () => {
  it('carries the id and the placement as percentages', () => {
    const el = build({ id: 'a', type: 'server' });

    expect(el.getAttribute('data-node-id')).toBe('a');
    expect(el.style.left).toBe('25%');
    expect(el.style.top).toBe('50%');
  });

  it('omits opacity at full visibility and sets it while fading', () => {
    expect(build({ id: 'a', type: 'server' }).style.opacity).toBe('');
    expect(
      build({ id: 'a', type: 'server' }, { opacity: 0.4 }).style.opacity
    ).toBe('0.4');
  });

  it('assembles the modifier classes', () => {
    expect(build({ id: 'a', type: 'server' }).getAttribute('class')).toBe(
      'rdfa-node'
    );
    expect(
      build({ id: 'a', type: 'simple_node', body: 'x' }).getAttribute('class')
    ).toBe('rdfa-node rdfa-node--panel');
    expect(build({ id: 'a', type: 'circle' }).getAttribute('class')).toBe(
      'rdfa-node rdfa-node--shape'
    );
    expect(build({ id: 'a', type: 'signal' }).getAttribute('class')).toBe(
      'rdfa-node rdfa-node--signal'
    );
    expect(
      build({ id: 'a', type: 'server', background_color: '#f00' }).getAttribute(
        'class'
      )
    ).toBe('rdfa-node rdfa-node--tinted');
    expect(
      build({ id: 'a', type: 'server' }, { highlighted: true }).getAttribute(
        'class'
      )
    ).toBe('rdfa-node rdfa-node--highlight');
  });

  it('never tints a signal pad', () => {
    const el = build({ id: 'a', type: 'signal', background_color: '#f00' });

    expect(el.getAttribute('class')).not.toContain('tinted');
  });

  it('applies a colour override on top of the static colour', () => {
    const el = build(
      { id: 'a', type: 'server', background_color: '#f00' },
      { colorOverride: { background_color: '#0f0' } }
    );

    expect(el.style.getPropertyValue('--rdfa-fill')).toBe('#0f0');
  });

  it('publishes the tint custom properties', () => {
    const el = build({ id: 'a', type: 'server', background_color: '#abc' });

    expect(el.style.getPropertyValue('--rdfa-fill')).toBe('#abc');
    expect(el.style.getPropertyValue('--rdfa-stroke')).not.toBe('');
  });
});

describe('buildNodeElement — visual', () => {
  it('wraps the body in .rdfa-node-visual', () => {
    const el = build({ id: 'a', type: 'server' });

    expect(el.querySelector('.rdfa-node-visual')).not.toBeNull();
  });

  it('rotates the VISUAL, never the node itself', () => {
    const el = build({ id: 'a', type: 'resistor' }, { rotation: 90 });

    expect(el.style.transform).toBe('');
    expect(
      el.querySelector<HTMLElement>('.rdfa-node-visual')?.style.transform
    ).toBe('rotate(90deg)');
  });

  it('leaves a zero rotation off entirely', () => {
    const el = build({ id: 'a', type: 'resistor' }, { rotation: 0 });

    expect(
      el.querySelector<HTMLElement>('.rdfa-node-visual')?.style.transform
    ).toBe('');
  });

  it('wraps the visual in a link when the node has a url', () => {
    const el = build({ id: 'a', type: 'server', url: 'https://example.com' });
    const link = el.querySelector('a.rdfa-node-link');

    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    // The visual stays reachable for measurement.
    expect(el.querySelector('.rdfa-node-visual')?.parentElement).toBe(link);
  });
});

describe('buildNodeElement — body dispatch', () => {
  it('draws a pictogram for a plain type', () => {
    expect(
      build({ id: 'a', type: 'database' }).querySelector('.rdfa-node-icon svg')
    ).not.toBeNull();
  });

  it('passes the live contact state to a stateful pictogram', () => {
    const open = build({ id: 'a', type: 'switch' }, { closed: 0 });
    const shut = build({ id: 'a', type: 'switch' }, { closed: 1 });

    expect(open.innerHTML).not.toBe(shut.innerHTML);
  });

  it('falls back to the static `closed` when no toggle is running', () => {
    const a = build({ id: 'a', type: 'switch', closed: true });
    const b = build({ id: 'a', type: 'switch' }, { closed: 1 });

    expect(a.querySelector('.rdfa-node-icon')?.innerHTML).toBe(
      b.querySelector('.rdfa-node-icon')?.innerHTML
    );
  });

  it('draws a shape with its background svg and optional text', () => {
    const el = build({ id: 'a', type: 'diamond', body: 'Yes?' });

    expect(el.querySelector('.rdfa-shape--diamond')).not.toBeNull();
    expect(el.querySelector('svg.rdfa-shape-bg polygon')).not.toBeNull();
    expect(el.querySelector('.rdfa-shape-text')?.textContent).toBe('Yes?');
  });

  it('omits the shape text when there is no body', () => {
    expect(
      build({ id: 'a', type: 'square' }).querySelector('.rdfa-shape-text')
    ).toBeNull();
  });

  it('renders a simple_node as body only', () => {
    const el = build({ id: 'a', type: 'simple_node', body: 'hello' });

    expect(el.querySelector('.rdfa-node-panel-header')).toBeNull();
    expect(el.querySelector('.rdfa-node-panel-body')?.textContent).toBe(
      'hello'
    );
  });

  it('renders a complex_node header and marks the panel', () => {
    const el = build({
      id: 'a',
      type: 'complex_node',
      header: 'GET /x',
      body: 'ok',
    });

    expect(el.querySelector('.rdfa-node-panel--complex')).not.toBeNull();
    expect(el.querySelector('.rdfa-node-panel-header')?.textContent).toBe(
      'GET /x'
    );
  });

  it('routes a panel through the highlighter when a language is set', () => {
    const { el } = buildNodeElement(
      { id: 'a', type: 'simple_node', body: 'a<b', language: 'sql' },
      {
        placement: { cx: 0, cy: 0 },
        highlight: (text) => `<em>${escapeHtml(text)}</em>`,
      }
    );
    const body = el.querySelector('.rdfa-node-panel-body');

    expect(body?.classList.contains('rdfa-code')).toBe(true);
    expect(body?.querySelector('em')?.textContent).toBe('a<b');
  });

  it('shows a signal pad value inside the pad, with no corner badge', () => {
    const el = build({ id: 'a', type: 'signal', icon: '1' });

    expect(el.querySelector('.rdfa-signal-value')).not.toBeNull();
    expect(el.querySelector('.rdfa-node-badge')).toBeNull();
  });

  it('leaves a valueless signal pad empty', () => {
    const el = build({ id: 'a', type: 'signal' });

    expect(el.querySelector('.rdfa-signal')?.children).toHaveLength(0);
  });
});

describe('buildNodeElement — corner badge', () => {
  it('renders the tech badge', () => {
    const el = build({ id: 'a', type: 'server', icon: 'docker' });

    expect(
      el.querySelector('.rdfa-node-badge .rdfa-node-subicon svg')
    ).not.toBeNull();
    expect(el.querySelector('.rdfa-spinner')).toBeNull();
  });

  it('shares one container between the badge and the spinner', () => {
    const el = build(
      { id: 'a', type: 'server', icon: 'node' },
      { loading: true }
    );
    const badge = el.querySelector('.rdfa-node-badge');

    expect(badge?.querySelector('.rdfa-node-subicon')).not.toBeNull();
    expect(badge?.querySelector('.rdfa-spinner')).not.toBeNull();
  });

  it('renders the spinner alone while loading without a badge', () => {
    const el = build({ id: 'a', type: 'server' }, { loading: true });

    expect(el.querySelector('.rdfa-node-badge .rdfa-spinner')).not.toBeNull();
    expect(el.querySelector('.rdfa-node-subicon')).toBeNull();
  });

  it('emits no badge at all when there is nothing to show', () => {
    expect(
      build({ id: 'a', type: 'server' }).querySelector('.rdfa-node-badge')
    ).toBeNull();
  });

  it('lets set_icon override the static badge, and `` clear it', () => {
    const swapped = build(
      { id: 'a', type: 'server', icon: 'node' },
      { iconOverride: 'docker' }
    );
    const cleared = build(
      { id: 'a', type: 'server', icon: 'node' },
      { iconOverride: '' }
    );

    expect(swapped.querySelector('title')?.textContent).toBe('docker');
    expect(cleared.querySelector('.rdfa-node-badge')).toBeNull();
  });
});

describe('buildNodeElement — label', () => {
  it('renders the text', () => {
    expect(
      build({ id: 'a', type: 'server', text: 'API' }).querySelector(
        '.rdfa-node-label'
      )?.textContent
    ).toBe('API');
  });

  it('joins text and value with a middle dot', () => {
    const el = build({
      id: 'a',
      type: 'resistor',
      text: 'R1',
      value: '10',
      unit: 'kΩ',
    });

    expect(el.querySelector('.rdfa-node-label')?.textContent).toBe(
      'R1 · 10 kΩ'
    );
  });

  it('renders a value with no text, and no dot', () => {
    const el = build({ id: 'a', type: 'resistor', value: '10', unit: 'kΩ' });

    expect(el.querySelector('.rdfa-node-label')?.textContent).toBe('10 kΩ');
  });

  it('omits the label entirely when there is nothing to say', () => {
    expect(
      build({ id: 'a', type: 'server' }).querySelector('.rdfa-node-label')
    ).toBeNull();
    expect(
      build({ id: 'a', type: 'server', value: '' }).querySelector(
        '.rdfa-node-label'
      )
    ).toBeNull();
  });

  it('adds the side modifier for a circuit component wired top/bottom', () => {
    const el = build(
      { id: 'a', type: 'resistor', text: 'R1' },
      {
        labelSide: 'left',
      }
    );

    expect(el.querySelector('.rdfa-node-label')?.getAttribute('class')).toBe(
      'rdfa-node-label rdfa-node-label--left'
    );
  });

  it('renders rich text in the label', () => {
    const el = build({ id: 'a', type: 'server', text: 'V $x$' });

    expect(el.querySelector('.rdfa-node-label .rdfa-tex')).not.toBeNull();
  });
});

describe('buildNodeElement — content panel', () => {
  const content = { type: 'text' as const, value: 'hi' };

  it('replaces the visual with the panel and drops the pictogram and badge', () => {
    const el = build(
      { id: 'a', type: 'server', icon: 'react' },
      { content, loading: true }
    );

    expect(el.querySelector('.rdfa-content')).not.toBeNull();
    expect(el.querySelector('.rdfa-node-icon')).toBeNull();
    // The panel replaced the visual outright, so there is nothing to badge.
    expect(el.querySelector('.rdfa-node-badge')).toBeNull();
  });

  it('SUPPRESSES every kind modifier while content is shown', () => {
    const el = build(
      { id: 'a', type: 'simple_node', body: 'b', background_color: '#f00' },
      { content, highlighted: true }
    );

    // `--content` wins; `--panel` and `--tinted` would style a visual that is
    // no longer drawn. `--highlight` is orthogonal and survives.
    expect(el.className).toBe(
      'rdfa-node rdfa-node--content rdfa-node--highlight'
    );
  });

  it('keeps the kind modifiers when the node has no content', () => {
    const el = build({
      id: 'a',
      type: 'simple_node',
      body: 'b',
      background_color: '#f00',
    });

    expect(el.className).toBe('rdfa-node rdfa-node--panel rdfa-node--tinted');
  });

  it('carries the crossfade opacity and the top-down reveal on the visual', () => {
    const el = build(
      { id: 'a', type: 'server' },
      { content, contentOpacity: 0.4, reveal: 0.4 }
    );
    const visual = el.querySelector<HTMLElement>('.rdfa-node-visual');

    expect(visual?.style.opacity).toBe('0.4');
    // clip-path, not height: the box the ResizeObserver measures stays whole.
    expect(visual?.style.clipPath).toBe('inset(0 0 60.00% 0)');
  });

  it('omits the clip-path once the reveal is complete', () => {
    const el = build({ id: 'a', type: 'server' }, { content, reveal: 1 });

    expect(
      el.querySelector<HTMLElement>('.rdfa-node-visual')?.style.clipPath
    ).toBe('');
  });

  it('writes the per-node ceilings only when content is shown', () => {
    const withContent = build(
      { id: 'a', type: 'server' },
      { content, contentLimit: { maxW: 200, maxH: 120 } }
    );
    const without = build(
      { id: 'a', type: 'server' },
      { contentLimit: { maxW: 200, maxH: 120 } }
    );

    expect(withContent.style.getPropertyValue('--rdfa-content-maxw')).toBe(
      '200px'
    );
    expect(withContent.style.getPropertyValue('--rdfa-content-maxh')).toBe(
      '120px'
    );
    expect(without.style.getPropertyValue('--rdfa-content-maxw')).toBe('');
  });

  it('exposes a code-fit handle for a code panel only', () => {
    const opts = { placement: { cx: 0, cy: 0 }, highlight: escapeHtml };
    const code = buildNodeElement(
      { id: 'a', type: 'server' },
      { ...opts, content: { type: 'code', value: 'x', language: 'sql' } }
    );
    const text = buildNodeElement(
      { id: 'a', type: 'server' },
      { ...opts, content }
    );

    expect(code.codeFit).toBeDefined();
    expect(text.codeFit).toBeUndefined();
  });
});

describe('applyNodeElement — the single writer', () => {
  const node: Node = { id: 'a', type: 'server' };
  const opts = (over = {}) => ({
    placement: { cx: 0.25, cy: 0.5 },
    highlight: escapeHtml,
    ...over,
  });

  it('rewrites left/top without disturbing the other declarations', () => {
    const handle = buildHandle(node, { opacity: 0.5 });
    applyNodeElement(
      handle,
      node,
      opts({ placement: { cx: 0.75, cy: 0.1 }, opacity: 0.5 })
    );

    expect(handle.el.style.left).toBe('75%');
    expect(handle.el.style.top).toBe('10%');
    expect(handle.el.style.opacity).toBe('0.5');
  });

  it('rewrites the panel ceilings each pass, as the player rescales', () => {
    const content = { type: 'text' as const, value: 'hi' };
    const handle = buildHandle(node, {
      content,
      contentLimit: { maxW: 10, maxH: 10 },
    });
    applyNodeElement(
      handle,
      node,
      opts({ content, contentLimit: { maxW: 64, maxH: 48 } })
    );

    expect(handle.el.style.getPropertyValue('--rdfa-content-maxw')).toBe(
      '64px'
    );
    expect(handle.el.style.getPropertyValue('--rdfa-content-maxh')).toBe(
      '48px'
    );
  });

  // The property retained mode is most likely to get wrong: React drops a
  // declaration it stops producing, so this one has to as well.
  it('removes a declaration that stops applying', () => {
    const content = { type: 'text' as const, value: 'hi' };
    const handle = buildHandle(node, {
      content,
      contentLimit: { maxW: 64, maxH: 48 },
      opacity: 0.5,
      rotation: 30,
    });
    expect(handle.el.style.getPropertyValue('--rdfa-content-maxw')).toBe(
      '64px'
    );
    expect(handle.visual.style.transform).toBe('rotate(30deg)');

    applyNodeElement(handle, node, opts());

    expect(handle.el.style.getPropertyValue('--rdfa-content-maxw')).toBe('');
    expect(handle.el.style.opacity).toBe('');
    expect(handle.visual.style.transform).toBe('');
    // Emptied entirely, the husk goes too — see `pruneEmptyStyle`.
    expect(handle.visual.hasAttribute('style')).toBe(false);
  });

  it('swaps the visual body when the content changes, and only then', () => {
    const content = { type: 'text' as const, value: 'hi' };
    const handle = buildHandle(node, { content });
    const panel = handle.visual.firstElementChild;

    applyNodeElement(handle, node, opts({ content }));
    expect(handle.visual.firstElementChild).toBe(panel);

    applyNodeElement(
      handle,
      node,
      opts({ content: { type: 'text' as const, value: 'other' } })
    );
    expect(handle.visual.firstElementChild).not.toBe(panel);
  });
});

/**
 * `renderNodeVisual` is the public face of the dispatch `applyNodeElement` uses
 * internally — the port of `NodeView`, which the React package re-exports for
 * isolated node previews (the API reference's type gallery).
 */
describe('renderNodeVisual', () => {
  it('renders a panel for a panel-kind node', () => {
    const el = renderNodeVisual({
      id: 'a',
      type: 'complex_node',
      header: 'H',
      body: 'B',
    });

    expect(el.getAttribute('class')).toContain('rdfa-node-panel');
    expect(el.textContent).toContain('H');
  });

  it('renders a shape wrapper carrying its SVG background', () => {
    const el = renderNodeVisual({ id: 'a', type: 'diamond' });

    expect(el.querySelector('svg.rdfa-shape-bg')).not.toBeNull();
  });

  it('renders a pictogram wrapper for a plain node type', () => {
    const el = renderNodeVisual({ id: 'a', type: 'server' });

    expect(el.getAttribute('class')).toBe('rdfa-node-icon');
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('renders an empty signal pad when the node has no value', () => {
    const el = renderNodeVisual({ id: 'a', type: 'signal' });

    expect(el.getAttribute('class')).toBe('rdfa-signal');
    expect(el.querySelector('.rdfa-signal-value')).toBeNull();
  });

  it('puts signalValue in the pad, overriding node.icon', () => {
    const el = renderNodeVisual(
      { id: 'a', type: 'signal', icon: '0' },
      { signalValue: '1' }
    );

    expect(el.querySelector('.rdfa-signal-value')).not.toBeNull();
  });

  it('falls back to node.icon in a signal pad', () => {
    const el = renderNodeVisual({ id: 'a', type: 'signal', icon: '1' });

    expect(el.querySelector('.rdfa-signal-value')).not.toBeNull();
  });

  it('lets closed override node.closed on a stateful contact', () => {
    const open = renderNodeVisual(
      { id: 'a', type: 'switch', closed: true },
      { closed: 0 }
    );
    const shut = renderNodeVisual({ id: 'a', type: 'switch', closed: true });

    expect(open.innerHTML).not.toBe(shut.innerHTML);
  });

  it('escapes panel code by default rather than highlighting it', () => {
    const el = renderNodeVisual({
      id: 'a',
      type: 'simple_node',
      body: '<script>',
      language: 'js',
    });

    expect(el.innerHTML).toContain('&lt;script&gt;');
  });

  it('uses a supplied highlighter for panel code', () => {
    const highlight = vi.fn(() => '<em>hl</em>');

    const el = renderNodeVisual(
      { id: 'a', type: 'simple_node', body: 'x', language: 'js' },
      { highlight }
    );

    expect(highlight).toHaveBeenCalledWith('x', 'js');
    expect(el.innerHTML).toContain('<em>hl</em>');
  });
});

describe('applyNodeElement — animated image content', () => {
  const content = {
    type: 'image' as const,
    value: 'still.png',
    frames: ['f0.png', 'f1.png', 'f2.png'],
  };
  const node: Node = { id: 'n', type: 'server' };

  it('shows the frame the caller asked for, on the create path', () => {
    const el = build(node, { content, contentFrame: 2 });
    expect(el.querySelector('img')?.getAttribute('src')).toBe('f2.png');
  });

  it('advances the frame without rebuilding the panel', () => {
    // The point of the retained renderer: the content object is identical
    // frame to frame, so `sameBodyKey` short-circuits and the <img> survives.
    const handle = buildHandle(node, { content, contentFrame: 0 });
    const img = handle.el.querySelector('img');
    applyNodeElement(handle, node, {
      placement: { cx: 0.25, cy: 0.5 },
      highlight: escapeHtml,
      content,
      contentFrame: 1,
    });
    expect(handle.el.querySelector('img')).toBe(img);
    expect(img?.getAttribute('src')).toBe('f1.png');
  });

  it('leaves a still image alone', () => {
    const still = { type: 'image' as const, value: 'still.png' };
    const handle = buildHandle(node, { content: still, contentFrame: 2 });
    expect(handle.frames).toBeUndefined();
    expect(handle.el.querySelector('img')?.getAttribute('src')).toBe(
      'still.png'
    );
  });

  it('drops the frame target when the content stops being a sequence', () => {
    const handle = buildHandle(node, { content, contentFrame: 1 });
    expect(handle.frames).toBeDefined();
    applyNodeElement(handle, node, {
      placement: { cx: 0.25, cy: 0.5 },
      highlight: escapeHtml,
      content: { type: 'text', value: 'plain' },
    });
    expect(handle.frames).toBeUndefined();
  });
});

describe('applyNodeElement — html content', () => {
  it('replaces the visual with the sanitised panel', () => {
    const el = build(
      { id: 'n', type: 'server' },
      { content: { type: 'html', value: '<p>a<script>x()</script></p>' } }
    );
    expect(el.className).toContain('rdfa-node--content');
    expect(el.querySelector('.rdfa-content-html')?.innerHTML).toBe('<p>a</p>');
  });
});
