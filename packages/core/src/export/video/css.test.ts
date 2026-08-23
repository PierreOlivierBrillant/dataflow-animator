/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { animatedSelectors, animationPhaseCss, collectPlayerCss } from './css';

/**
 * Puts `sheets` into the GLOBAL document and returns it.
 *
 * It has to be the global one: jsdom leaves `styleSheets` empty on a document
 * built with `createHTMLDocument`, so a scratch document would make every
 * assertion here pass against nothing. The real CSSOM is what gives these tests
 * their value — the collector walks `CSSStyleRule` / `CSSKeyframesRule` shapes,
 * and a hand-built fake would only prove the fake matches itself.
 */
function docWithCss(...sheets: string[]): Document {
  for (const css of sheets) {
    const style = document.createElement('style');
    style.setAttribute('data-test-sheet', '');
    style.textContent = css;
    document.head.appendChild(style);
  }
  return document;
}

afterEach(() => {
  for (const style of Array.from(
    document.querySelectorAll('[data-test-sheet]')
  )) {
    style.remove();
  }
});

describe('collectPlayerCss', () => {
  it('keeps rules that target the player and drops everything else', () => {
    const css = collectPlayerCss(
      docWithCss(`
        .rdfa-player { color: red; }
        .unrelated-thing { color: blue; }
        article p { margin: 0; }
      `)
    );

    expect(css).toContain('.rdfa-player');
    expect(css).not.toContain('unrelated-thing');
    expect(css).not.toContain('article p');
  });

  it('keeps a host page override of a player class', () => {
    // A consumer restyling the player writes `.rdfa-` in the selector, so the
    // filter has to let their rule through or the export would not match what
    // they see on screen.
    const css = collectPlayerCss(
      docWithCss('.my-site .rdfa-node { border-radius: 0; }')
    );
    expect(css).toContain('.rdfa-node');
  });

  it('keeps rdfa keyframes, which carry no selector to match on', () => {
    const css = collectPlayerCss(
      docWithCss(
        '@keyframes rdfa-march { to { stroke-dashoffset: 10; } }',
        '@keyframes someone-elses-spin { to { rotate: 360deg; } }'
      )
    );
    expect(css).toContain('rdfa-march');
    expect(css).not.toContain('someone-elses-spin');
  });

  it('drops @font-face, whose external url would taint the canvas', () => {
    // THE reason this filter exists: a face fetched from another origin makes
    // the rasterised SVG cross-origin, `VideoFrame` then refuses the canvas and
    // the whole export dies. The player uses system fonts, so this costs
    // nothing.
    const css = collectPlayerCss(
      docWithCss(
        '@font-face { font-family: Fancy; src: url(https://cdn.example/f.woff2); }',
        '.rdfa-player { font-family: Fancy; }'
      )
    );
    expect(css).not.toContain('font-face');
    expect(css).not.toContain('cdn.example');
    expect(css).toContain('.rdfa-player');
  });

  it('keeps a media query only when something inside it survived', () => {
    const css = collectPlayerCss(
      docWithCss(`
        @media (min-width: 600px) { .rdfa-stage { padding: 8px; } }
        @media (min-width: 900px) { .other-thing { padding: 8px; } }
      `)
    );
    expect(css).toContain('min-width: 600px');
    expect(css).toContain('.rdfa-stage');
    expect(css).not.toContain('min-width: 900px');
    expect(css).not.toContain('.other-thing');
  });

  it('skips a cross-origin sheet instead of throwing', () => {
    const doc = docWithCss('.rdfa-player { color: red; }');
    // Reading `cssRules` of a cross-origin sheet throws a SecurityError; the
    // collector has to survive one and keep going through the rest.
    const hostile = {
      get cssRules(): CSSRuleList {
        throw new DOMException('denied', 'SecurityError');
      },
    } as CSSStyleSheet;
    const original = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'styleSheets'
    );
    const live = doc.styleSheets;
    Object.defineProperty(doc, 'styleSheets', {
      configurable: true,
      get: () => [hostile, ...Array.from(live)] as unknown as StyleSheetList,
    });
    try {
      expect(() => collectPlayerCss(doc)).not.toThrow();
      expect(collectPlayerCss(doc)).toContain('.rdfa-player');
    } finally {
      // Restored explicitly: this patches the GLOBAL document, and leaving the
      // throwing sheet in place would break every test that ran after it.
      delete (doc as unknown as Record<string, unknown>).styleSheets;
      if (original)
        Object.defineProperty(Document.prototype, 'styleSheets', original);
    }
  });
});

describe('animatedSelectors', () => {
  it('finds the selectors that declare an animation, and nothing else', () => {
    const css = [
      '.rdfa-arrow-line[data-style="animated"] { animation: rdfa-march 0.5s linear infinite; }',
      '.rdfa-loading-ring { animation-name: rdfa-pulse; }',
      '.rdfa-node { color: red; }',
      '@keyframes rdfa-march { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 8; } }',
    ].join('\n');

    expect(animatedSelectors(css)).toEqual([
      '.rdfa-arrow-line[data-style="animated"]',
      '.rdfa-loading-ring',
    ]);
  });

  it('does not mistake keyframe steps for selectors', () => {
    // `from`, `to` and `50%` sit inside @keyframes and are not selectors at
    // all; naming one in the phase rule would emit invalid CSS.
    const css =
      '@keyframes rdfa-x { from { animation-name: none; } 50% { opacity: 1; } }';
    expect(animatedSelectors(css)).toEqual([]);
  });

  it('is not fooled by a property that merely starts with the word', () => {
    const css =
      '.rdfa-a { animation-duration: 1s; } .rdfa-b { animation: x 1s; }';
    expect(animatedSelectors(css)).toEqual(['.rdfa-b']);
  });

  it('reports each selector once', () => {
    const css = '.rdfa-a { animation: x 1s; } .rdfa-a { animation: y 2s; }';
    expect(animatedSelectors(css)).toEqual(['.rdfa-a']);
  });
});

describe('animationPhaseCss', () => {
  const SELECTORS = ['.rdfa-loading-ring', '.rdfa-arrow-line'];

  it('pins the phase with a negative delay and pauses the animation', () => {
    // Three of the player's animations run on the browser clock, not on `t`.
    // A rasterised still would freeze them at frame one on every exported
    // frame; a negative delay of `t` puts each one at `t % duration`, whatever
    // its duration, and `paused` stops it advancing mid-rasterisation.
    const css = animationPhaseCss(1234, SELECTORS);
    expect(css).toContain('animation-delay: -1234ms');
    expect(css).toContain('animation-play-state: paused');
  });

  it('targets only the animated selectors, never the universal one', () => {
    // `.rdfa-player *` plus both pseudo-elements measured 2.8 ms MORE per
    // frame — about forty percent on top of rasterising a frame at all.
    const css = animationPhaseCss(0, SELECTORS);
    expect(css).toContain('.rdfa-loading-ring,.rdfa-arrow-line');
    expect(css).not.toContain('*');
  });

  it('emits nothing at all when the scene animates nothing', () => {
    expect(animationPhaseCss(500, [])).toBe('');
  });

  it('rounds and never emits a positive delay', () => {
    expect(animationPhaseCss(10.6, SELECTORS)).toContain('-11ms');
    // A negative `t` cannot happen through the exporter, but a positive delay
    // here would DELAY the animation's start rather than seek into it — the
    // opposite of the intent — so it is clamped rather than trusted.
    expect(animationPhaseCss(-50, SELECTORS)).toContain('-0ms');
  });
});
