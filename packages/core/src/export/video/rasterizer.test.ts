/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRasterizer } from './rasterizer';

/**
 * The rasteriser's contract, minus the pixels.
 *
 * jsdom neither lays out nor paints, so what is checked here is the SVG that
 * gets handed to the image decoder — which is where every one of this module's
 * hard-won decisions actually lives.
 */

interface FakeImage {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

let lastImage: FakeImage | undefined;
/** When false, the fake decoder reports failure instead of success. */
let decodeSucceeds = true;
const drawn: unknown[] = [];
let fillStyleWrites: string[] = [];

beforeEach(() => {
  lastImage = undefined;
  decodeSucceeds = true;
  drawn.length = 0;
  fillStyleWrites = [];

  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      #src = '';
      constructor() {
        lastImage = this as unknown as FakeImage;
      }
      get src(): string {
        return this.#src;
      }
      set src(value: string) {
        this.#src = value;
        // Decoding is asynchronous in a browser; keeping that shape here means
        // the awaited promise in `drawFrame` is exercised rather than skipped.
        queueMicrotask(() => {
          if (decodeSucceeds) this.onload?.();
          else this.onerror?.();
        });
      }
    }
  );

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        set fillStyle(value: string) {
          fillStyleWrites.push(value);
        },
        fillRect: () => {},
        drawImage: (...args: unknown[]) => drawn.push(args),
      }) as unknown as CanvasRenderingContext2D
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function make(over: Partial<Parameters<typeof createRasterizer>[0]> = {}) {
  const el = document.createElement('div');
  el.className = 'rdfa-player';
  el.textContent = 'scene';
  return createRasterizer({
    el,
    layoutWidth: 960,
    layoutHeight: 540,
    outWidth: 1920,
    outHeight: 1080,
    css: '.rdfa-player{color:red}',
    background: '#ffffff',
    ...over,
  });
}

/** The SVG the decoder was handed, decoded back out of the data URI. */
function lastSvg(): string {
  const src = lastImage?.src ?? '';
  return decodeURIComponent(src.slice(src.indexOf(',') + 1));
}

describe('createRasterizer', () => {
  it('hands the decoder a data: URI, never a blob:', async () => {
    // THE decision this module turns on. A `blob:` URL taints the canvas — with
    // no external resource involved — and `VideoFrame` then refuses the canvas
    // outright, so the export cannot produce a single frame. Same markup behind
    // a `data:` URI stays clean.
    const r = make();
    await r.drawFrame(0);

    expect(lastImage?.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(lastImage?.src).not.toContain('blob:');
  });

  it('sizes the SVG to the OUTPUT box and scales the layout into it', async () => {
    const r = make();
    await r.drawFrame(0);
    const svg = lastSvg();

    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
    // Scaling INSIDE the svg is what keeps text sharp: the browser rasterises
    // at the output resolution instead of enlarging a small bitmap.
    expect(svg).toContain('scale(2)');
    expect(svg).toContain('width:960px');
  });

  it('letterboxes rather than distorting a mismatched aspect', async () => {
    const r = make({ outWidth: 1000, outHeight: 1000 });
    await r.drawFrame(0);
    const svg = lastSvg();

    // 1000/960 vs 1000/540 → the smaller scale wins, and the slack is centred.
    expect(svg).toContain('scale(1.0416666666666667)');
    expect(svg).toContain('translate(0px,218.75px)');
  });

  it('inlines the stylesheet and the animation phase for the instant asked', async () => {
    const r = make({
      css: '.rdfa-player{color:red}.rdfa-arrow-line{animation:rdfa-march 0.5s linear infinite}',
    });
    await r.drawFrame(1500);
    const svg = lastSvg();

    expect(svg).toContain('.rdfa-player{color:red}');
    expect(svg).toContain('.rdfa-arrow-line {');
    expect(svg).toContain('animation-delay: -1500ms');
  });

  it('emits no phase rule for a scene that animates nothing', async () => {
    // Most scenes have no browser-clock animation at all, and the rule is the
    // single most expensive thing in a frame — so it is left out entirely
    // rather than written against a selector that matches nothing.
    const r = make({ css: '.rdfa-player{color:red}' });
    await r.drawFrame(1500);

    expect(lastSvg()).not.toContain('animation-delay');
  });

  it('serialises the element as it stands at the moment of the call', async () => {
    const el = document.createElement('div');
    el.className = 'rdfa-player';
    el.textContent = 'first';
    const r = make({ el });

    await r.drawFrame(0);
    expect(lastSvg()).toContain('first');

    // The exporter seeks the player between frames and the DOM mutates in
    // place; the rasteriser must read it fresh each time rather than caching.
    el.textContent = 'second';
    await r.drawFrame(100);
    expect(lastSvg()).toContain('second');
  });

  it('escapes markup characters in the CSS', async () => {
    // A rule like `content: "<"` would otherwise close the <style> element and
    // produce malformed XML that refuses to decode at all.
    const r = make({ css: '.rdfa-x::after{content:"<&"}' });
    await r.drawFrame(0);

    expect(lastImage?.src).toContain('%3C'); // the svg's own tags
    expect(lastSvg()).toContain('&lt;&amp;');
    expect(lastSvg()).not.toContain('content:"<&"');
  });

  it('paints the background before the frame', async () => {
    const r = make({ background: 'rgb(11, 17, 32)' });
    await r.drawFrame(0);

    expect(fillStyleWrites).toContain('rgb(11, 17, 32)');
    expect(drawn).toHaveLength(1);
  });

  it('rejects with a diagnosable message when a frame will not decode', async () => {
    decodeSucceeds = false;
    const r = make();

    await expect(r.drawFrame(0)).rejects.toThrow(/another origin/);
    expect(drawn).toHaveLength(0);
  });
});
