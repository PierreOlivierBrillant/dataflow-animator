/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  applyCodeFontScale,
  applyContentFrame,
  applyContentScreen,
  buildContentPanel,
  measureCodeFit,
  type CodeFitTarget,
} from './contentElement';
import type { Highlighter } from '../types';

/** A marker highlighter, so a test can tell the highlighted path was taken. */
const highlight: Highlighter = (code, language) =>
  `<mark data-lang="${language}">${code}</mark>`;

describe('buildContentPanel — mode dispatch', () => {
  it('wraps code in a terminal and routes it through the highlighter', () => {
    const { el, codeFit } = buildContentPanel(
      { type: 'code', value: 'SELECT 1', language: 'sql' },
      highlight
    );

    expect(el.className).toBe('rdfa-content rdfa-terminal');
    expect(el.querySelector('.rdfa-content-body')?.className).toBe(
      'rdfa-content-body rdfa-code'
    );
    const mark = el.querySelector('pre > code > mark');
    expect(mark?.getAttribute('data-lang')).toBe('sql');
    expect(mark?.textContent).toBe('SELECT 1');
    expect(codeFit?.pre).toBe(el.querySelector('pre'));
  });

  it('defaults an unspecified code language to plaintext', () => {
    const { el } = buildContentPanel({ type: 'code', value: 'x' }, highlight);

    expect(el.querySelector('mark')?.getAttribute('data-lang')).toBe(
      'plaintext'
    );
  });

  it('renders text mode as a browser window carrying the url', () => {
    const { el, codeFit } = buildContentPanel(
      { type: 'text', value: 'hello', url: 'https://example.test' },
      highlight
    );

    expect(el.className).toBe('rdfa-content');
    expect(el.querySelector('.rdfa-window-url')?.textContent).toBe(
      'https://example.test'
    );
    expect(el.querySelector('.rdfa-content-body')?.textContent).toBe('hello');
    // Nothing to fit: only code panels negotiate a font scale.
    expect(codeFit).toBeUndefined();
  });

  it('treats an absent type as text and falls back to a localhost url', () => {
    const { el } = buildContentPanel({ value: 'v' }, highlight);

    expect(el.className).toBe('rdfa-content');
    expect(el.querySelector('.rdfa-window-url')?.textContent).toBe(
      'https://localhost'
    );
  });

  it('renders image mode as an <img> inside the window body', () => {
    const { el } = buildContentPanel(
      { type: 'image', value: '/pic.png' },
      highlight
    );

    const img = el.querySelector<HTMLImageElement>('.rdfa-content-body img');
    expect(img?.getAttribute('src')).toBe('/pic.png');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders a table with its header and rows', () => {
    const { el } = buildContentPanel(
      {
        type: 'table',
        columns: ['id', 'email'],
        rows_data: [
          ['1', 'a@b.c'],
          ['2', 'd@e.f'],
        ],
      },
      highlight
    );

    expect(el.className).toBe('rdfa-content rdfa-content--table');
    expect(
      [...el.querySelectorAll('thead th')].map((n) => n.textContent)
    ).toEqual(['id', 'email']);
    expect(
      [...el.querySelectorAll('tbody tr')].map((r) => r.textContent)
    ).toEqual(['1a@b.c', '2d@e.f']);
  });

  it('omits the head and body a table did not supply', () => {
    const { el } = buildContentPanel({ type: 'table' }, highlight);

    expect(el.querySelector('thead')).toBeNull();
    expect(el.querySelector('tbody')).toBeNull();
  });

  it('renders no body text at all for an empty value, as React does', () => {
    const { el } = buildContentPanel({ type: 'text' }, highlight);

    expect(el.querySelector('.rdfa-content-body')?.childNodes.length).toBe(0);
  });

  it('does NOT interpret rich text — `ContentPanel` renders a plain child', () => {
    const { el } = buildContentPanel(
      { type: 'text', value: 'water $H_2O$' },
      highlight
    );

    const body = el.querySelector('.rdfa-content-body');
    expect(body?.querySelector('sub')).toBeNull();
    expect(body?.textContent).toBe('water $H_2O$');
  });
});

describe('applyCodeFontScale', () => {
  /** jsdom reports no layout, so `measureCodeFit` is exercised separately. */
  const target = () => ({ pre: document.createElement('pre'), baseFont: 20 });

  it('writes the scaled font size', () => {
    const t = target();
    applyCodeFontScale(t, 0.5);

    expect(t.pre.style.fontSize).toBe('10px');
  });

  it('REMOVES the declaration at scale 1 rather than writing the base size', () => {
    const t = target();
    applyCodeFontScale(t, 0.5);
    applyCodeFontScale(t, 1);

    // React passes `undefined` here and drops the style entirely; a leftover
    // `20px` would pin the size against a stylesheet that scales with the player.
    expect(t.pre.style.fontSize).toBe('');
  });

  it('leaves an unmeasured block alone', () => {
    const pre = document.createElement('pre');
    applyCodeFontScale({ pre }, 0.5);

    expect(pre.style.fontSize).toBe('');
  });

  it('never scales below 1px', () => {
    const t = { pre: document.createElement('pre'), baseFont: 2 };
    applyCodeFontScale(t, 0.01);

    expect(t.pre.style.fontSize).toBe('1px');
  });
});

describe('measureCodeFit', () => {
  it('reports 1 and records the base font when nothing overflows', () => {
    // jsdom gives every box a zero size, so `natural* > avail*` is never true —
    // which is exactly the "fits" branch.
    const pre = document.createElement('pre');
    document.body.appendChild(pre);
    const t: CodeFitTarget = { pre };

    expect(measureCodeFit(t)).toBe(1);
    expect(t.baseFont).toBeGreaterThan(0);
  });

  it('restores an already-applied inline font size', () => {
    const pre = document.createElement('pre');
    pre.style.fontSize = '7px';
    document.body.appendChild(pre);

    measureCodeFit({ pre });

    expect(pre.style.fontSize).toBe('7px');
  });
});

describe('buildContentPanel — html mode', () => {
  it('renders the sanitised markup, not the escaped source', () => {
    const { el } = buildContentPanel(
      { type: 'html', value: '<p>Hello <b>you</b></p>' },
      highlight
    );
    const body = el.querySelector('.rdfa-content-html');
    expect(body?.innerHTML).toBe('<p>Hello <b>you</b></p>');
    // The `code` mode's highlighter must not be involved here.
    expect(el.querySelector('mark')).toBeNull();
  });

  it('goes through the sanitiser', () => {
    const { el } = buildContentPanel(
      { type: 'html', value: '<p onclick="x()">a</p><script>y()</script>' },
      highlight
    );
    expect(el.querySelector('.rdfa-content-html')?.innerHTML).toBe('<p>a</p>');
  });

  it('renders bare unless a url asks for the browser chrome', () => {
    const bare = buildContentPanel(
      { type: 'html', value: '<p>a</p>' },
      highlight
    );
    expect(bare.el.querySelector('.rdfa-window-bar')).toBeNull();

    const framed = buildContentPanel(
      { type: 'html', value: '<p>a</p>', url: 'https://app.test' },
      highlight
    );
    expect(framed.el.querySelector('.rdfa-window-url')?.textContent).toBe(
      'https://app.test'
    );
  });

  it('accepts a missing value', () => {
    const { el } = buildContentPanel({ type: 'html' }, highlight);
    expect(el.querySelector('.rdfa-content-html')?.childNodes.length).toBe(0);
  });

  it('exposes no code-fit and no frame target', () => {
    const panel = buildContentPanel(
      { type: 'html', value: '<p>a</p>' },
      highlight
    );
    expect(panel.codeFit).toBeUndefined();
    expect(panel.frames).toBeUndefined();
  });
});

describe('buildContentPanel — image frames', () => {
  const content = {
    type: 'image' as const,
    value: 'still.png',
    frames: ['f0.png', 'f1.png'],
  };

  it('builds at the still and hands back a frame target', () => {
    const { el, frames } = buildContentPanel(content, highlight);
    // `applyNodeElement` writes the frame for `t` right after this, on the
    // create path as much as the update path.
    expect(el.querySelector('img')?.getAttribute('src')).toBe('still.png');
    expect(frames?.img).toBe(el.querySelector('img'));
    expect(frames?.content).toBe(content);
  });

  it('hands back no target for a still image', () => {
    const panel = buildContentPanel(
      { type: 'image', value: 'still.png' },
      highlight
    );
    expect(panel.frames).toBeUndefined();
    expect(panel.el.querySelector('img')?.getAttribute('src')).toBe(
      'still.png'
    );
  });

  it('hands back no target for an empty sequence', () => {
    expect(
      buildContentPanel({ type: 'image', frames: [] }, highlight).frames
    ).toBeUndefined();
  });
});

describe('applyContentFrame', () => {
  const content = {
    type: 'image' as const,
    value: 'still.png',
    frames: ['f0.png', 'f1.png'],
  };

  it('points the img at the frame for the index', () => {
    const { frames } = buildContentPanel(content, highlight);
    applyContentFrame(frames!, 1);
    expect(frames!.img.getAttribute('src')).toBe('f1.png');
  });

  it('writes nothing when the frame has not moved', () => {
    const { frames } = buildContentPanel(content, highlight);
    applyContentFrame(frames!, 0);
    frames!.img.setAttribute('src', 'tampered');
    applyContentFrame(frames!, 0);
    expect(frames!.img.getAttribute('src')).toBe('tampered');
  });

  it('falls back to the still for an absent index', () => {
    const { frames } = buildContentPanel(content, highlight);
    applyContentFrame(frames!, 1);
    applyContentFrame(frames!, undefined);
    expect(frames!.img.getAttribute('src')).toBe('still.png');
  });

  it('removes the attribute rather than writing "undefined"', () => {
    const bare = { type: 'image' as const, frames: ['f0.png'] };
    const { frames } = buildContentPanel(bare, highlight);
    applyContentFrame(frames!, 0);
    applyContentFrame(frames!, undefined);
    expect(frames!.img.hasAttribute('src')).toBe(false);
  });
});

describe('buildContentPanel — html as a screen', () => {
  const screenContent = {
    type: 'html' as const,
    screen_width: 480,
    screen_height: 300,
    value: '<p>page</p>',
  };

  it('wraps the page in a frame and a design-sized screen', () => {
    const { el, screen } = buildContentPanel(screenContent, highlight);
    expect(el.className).toContain('rdfa-content--screen');
    expect(screen?.box).toEqual({ width: 480, height: 300 });
    expect(screen?.inner.style.width).toBe('480px');
    expect(screen?.inner.style.height).toBe('300px');
    expect(screen?.inner.querySelector('.rdfa-content-html')?.innerHTML).toBe(
      '<p>page</p>'
    );
  });

  it('puts the address bar INSIDE the screen, so it scales with the page', () => {
    const { el, screen } = buildContentPanel(
      { ...screenContent, url: 'youtube.test' },
      highlight
    );
    // Not a sibling of the frame: a simulated browser is one picture.
    expect(el.querySelector(':scope > .rdfa-window-bar')).toBeNull();
    expect(screen?.inner.firstElementChild?.className).toBe('rdfa-window-bar');
  });

  it('leaves an html panel with no design space flowing as before', () => {
    const { el, screen } = buildContentPanel(
      { type: 'html', value: '<p>a</p>' },
      highlight
    );
    expect(screen).toBeUndefined();
    expect(el.className).not.toContain('rdfa-content--screen');
    expect(
      el.querySelector('.rdfa-content-body.rdfa-content-html')
    ).not.toBeNull();
  });
});

describe('applyContentScreen', () => {
  const screenContent = {
    type: 'html' as const,
    screen_width: 480,
    screen_height: 300,
    value: '<p>page</p>',
  };

  it('gives the frame the SCALED size and the screen the transform', () => {
    const { screen } = buildContentPanel(screenContent, highlight);
    applyContentScreen(screen!, { maxW: 240, maxH: 600 });
    // The layout box tells the truth about what is painted, so a neighbour is
    // never pushed away by space nothing occupies.
    expect(screen!.frame.style.width).toBe('240px');
    expect(screen!.frame.style.height).toBe('150px');
    expect(screen!.inner.style.transform).toBe('scale(0.5)');
    // The design size is untouched — it is what the markup is laid out against.
    expect(screen!.inner.style.width).toBe('480px');
  });

  it('writes no transform at all at exactly 1', () => {
    const { screen } = buildContentPanel(screenContent, highlight);
    applyContentScreen(screen!, { maxW: 480, maxH: 300 });
    expect(screen!.inner.style.transform).toBe('');
    expect(screen!.frame.style.width).toBe('480px');
  });

  it('writes nothing when the allowance has not moved', () => {
    const { screen } = buildContentPanel(screenContent, highlight);
    applyContentScreen(screen!, { maxW: 240, maxH: 600 });
    screen!.frame.style.width = '999px';
    applyContentScreen(screen!, { maxW: 240, maxH: 600 });
    expect(screen!.frame.style.width).toBe('999px');
  });

  it('rounds, so no scale is ever written in scientific notation', () => {
    const { screen } = buildContentPanel(screenContent, highlight);
    applyContentScreen(screen!, { maxW: 317, maxH: 900 });
    expect(screen!.inner.style.transform).toBe('scale(0.66)');
    expect(screen!.frame.style.width).toBe('316.8px');
  });
});
