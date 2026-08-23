/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataFlowSpec } from '../../types';

/**
 * The export loop: sizing, the virtual-time walk, progress, abort and cleanup.
 *
 * The rasteriser and the encoders are mocked — they are covered by their own
 * tests, and neither WebCodecs nor a painting canvas exists in jsdom. What
 * matters here is that the loop drives them correctly and always tidies up.
 */

const mountPlayer = vi.fn();
const createRasterizer = vi.fn();
const createEncoder = vi.fn();
const collectPlayerCss = vi.fn(() => '.rdfa-player{}');

vi.mock('../../dom/player', () => ({
  mountPlayer: (...args: unknown[]) => mountPlayer(...args),
}));
vi.mock('./rasterizer', () => ({
  createRasterizer: (...args: unknown[]) => createRasterizer(...args),
}));
vi.mock('./encoders', () => ({
  createEncoder: (...args: unknown[]) => createEncoder(...args),
  FORMAT_META: {
    webm: { extension: 'webm', mime: 'video/webm' },
    mp4: { extension: 'mp4', mime: 'video/mp4' },
    gif: { extension: 'gif', mime: 'image/gif' },
  },
}));
vi.mock('./css', () => ({
  collectPlayerCss: () => collectPlayerCss(),
  animationPhaseCss: () => '',
}));

const { exportVideo, downloadExport } = await import('./exportVideo');

const spec = { nodes: [], steps: [] } as unknown as DataFlowSpec;

let seeks: number[] = [];
let framesDrawn: number[] = [];
let framesEncoded: number[] = [];
let destroyed = 0;
let finishCalls = 0;

function setup(durationMs = 1000): void {
  // Cleared, not just re-implemented: `mock.calls` is cumulative, so asserting
  // on `calls[1]` would otherwise read an earlier test's invocation.
  mountPlayer.mockClear();
  createRasterizer.mockClear();
  createEncoder.mockClear();
  seeks = [];
  framesDrawn = [];
  framesEncoded = [];
  destroyed = 0;
  finishCalls = 0;

  mountPlayer.mockImplementation((host: HTMLElement) => ({
    el: Object.assign(document.createElement('div'), {
      className: 'rdfa-player',
    }),
    clock: {
      durationMs,
      seek: (t: number) => seeks.push(t),
    },
    warnings: [],
    destroy: () => {
      destroyed++;
      host.replaceChildren();
    },
  }));

  createRasterizer.mockImplementation(() => ({
    canvas: document.createElement('canvas'),
    drawFrame: async (t: number) => {
      framesDrawn.push(t);
    },
  }));

  createEncoder.mockImplementation(async () => ({
    addFrame: async (_canvas: unknown, index: number) => {
      framesEncoded.push(index);
    },
    finish: async () => {
      finishCalls++;
      return new Blob(['x'], { type: 'video/webm' });
    },
  }));
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 0);
    return 1;
  });
  setup();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('exportVideo', () => {
  it('walks virtual time and encodes one frame per step', async () => {
    const result = await exportVideo(spec, { format: 'webm', fps: 10 });

    expect(result.frames).toBe(10); // 1000ms at 10fps
    expect(seeks).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
    expect(framesDrawn).toEqual(seeks);
    expect(framesEncoded).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(finishCalls).toBe(1);
  });

  it('reports the animation duration, not the time it took to render', async () => {
    // The whole point of driving WebCodecs by hand rather than MediaRecorder:
    // the file lasts as long as the animation, however fast it was produced.
    const result = await exportVideo(spec, { fps: 10 });
    expect(result.durationMs).toBe(1000);
  });

  it('defaults differently for gif than for video', async () => {
    // GIF encodes per pixel in JavaScript, so it defaults smaller and slower —
    // but not by much: 960/20 measured 31% of the animation's own duration,
    // against 58% for 1280/24, which is the wall it should stay behind.
    // 20 fps is also exactly 5 centiseconds, the unit GIF stores delays in.
    const gif = await exportVideo(spec, { format: 'gif' });
    expect(gif.fps).toBe(20);
    expect(gif.width).toBe(960);
    expect(gif.filename).toBe('dataflow.gif');

    const webm = await exportVideo(spec, { format: 'webm' });
    expect(webm.fps).toBe(30);
    expect(webm.width).toBe(1280);
  });

  it('derives the width when only a height is given', async () => {
    // The panel thinks in heights (`720p`), so a caller must be able to as
    // well, without working out the width their aspect ratio implies.
    const result = await exportVideo(spec, {
      height: 720,
      layoutWidth: 960,
      layoutHeight: 540,
    });
    expect(result.height).toBe(720);
    expect(result.width).toBe(1280);
  });

  it('forces even dimensions, which H.264 cannot do without', async () => {
    const result = await exportVideo(spec, { width: 641, height: 361 });
    expect(result.width % 2).toBe(0);
    expect(result.height % 2).toBe(0);
  });

  it('derives the height from the layout aspect when only width is given', async () => {
    const result = await exportVideo(spec, {
      width: 800,
      layoutWidth: 960,
      layoutHeight: 540,
    });
    expect(result.height).toBe(450); // 800 * 540/960
  });

  it('mounts its own player with no chrome at all', async () => {
    await exportVideo(spec, {});
    const options = mountPlayer.mock.calls[0][2];

    // A control bar, a transcript or a JSON button would be baked into the
    // exported pixels.
    expect(options.controls).toBe(false);
    expect(options.transcript).toBe('none');
    expect(options.exportable).toBe(false);
    expect(options.autoPlay).toBe(false);
  });

  it('pins the mode rather than leaving it to follow a viewer', async () => {
    const result = await exportVideo(spec, {});
    expect(mountPlayer.mock.calls[0][2].mode).toBe('light');
    expect(result).toBeDefined();

    await exportVideo(spec, { mode: 'dark' });
    expect(mountPlayer.mock.calls[1][2].mode).toBe('dark');
  });

  it('reports progress across the frames and once for the mux', async () => {
    const seen: { phase: string; ratio: number }[] = [];
    await exportVideo(spec, {
      fps: 4,
      onProgress: (p) => seen.push({ phase: p.phase, ratio: p.ratio }),
    });

    expect(seen[0]).toEqual({ phase: 'rendering', ratio: 0 });
    expect(seen.at(-1)).toEqual({ phase: 'finalising', ratio: 1 });
    expect(seen.filter((p) => p.phase === 'rendering')).toHaveLength(5);
  });

  it('removes the offscreen host and player when it finishes', async () => {
    const before = document.body.childElementCount;
    await exportVideo(spec, { fps: 2 });

    expect(destroyed).toBe(1);
    expect(document.body.childElementCount).toBe(before);
  });

  it('aborts mid-run and still tidies up', async () => {
    const controller = new AbortController();
    createRasterizer.mockImplementation(() => ({
      canvas: document.createElement('canvas'),
      drawFrame: async (t: number) => {
        framesDrawn.push(t);
        if (framesDrawn.length === 3) controller.abort();
      },
    }));

    const before = document.body.childElementCount;
    await expect(
      exportVideo(spec, { fps: 20, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });

    // Stopped early rather than running to the end...
    expect(framesDrawn.length).toBeLessThan(20);
    // ...and left nothing mounted behind it.
    expect(destroyed).toBe(1);
    expect(document.body.childElementCount).toBe(before);
    expect(finishCalls).toBe(0);
  });

  it('refuses immediately when the signal is already aborted', async () => {
    await expect(
      exportVideo(spec, { signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mountPlayer).not.toHaveBeenCalled();
  });

  it('tidies up when the encoder throws', async () => {
    createEncoder.mockImplementation(async () => {
      throw new Error('WebCodecs unavailable');
    });

    const before = document.body.childElementCount;
    await expect(exportVideo(spec, {})).rejects.toThrow(
      'WebCodecs unavailable'
    );
    expect(destroyed).toBe(1);
    expect(document.body.childElementCount).toBe(before);
  });

  it('always produces at least one frame, even for a zero-length animation', async () => {
    setup(0);
    const result = await exportVideo(spec, {});
    expect(result.frames).toBe(1);
    expect(framesEncoded).toEqual([0]);
  });

  it('yields to the browser during a long run of instant frames', async () => {
    // Awaiting an image decode normally returns to the event loop on its own.
    // When decodes come back instantly (a warm cache), nothing would — so the
    // loop has a time-budget backstop, and this is what proves it fires.
    setup(4000);
    let nowValue = 0;
    const realNow = performance.now.bind(performance);
    vi.spyOn(performance, 'now').mockImplementation(() => {
      nowValue += 10; // every reading advances 10ms → the 24ms budget trips
      return nowValue;
    });

    const macrotasks: number[] = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.stubGlobal('setTimeout', ((fn: () => void, ms?: number) => {
      macrotasks.push(ms ?? 0);
      return realSetTimeout(fn, 0);
    }) as typeof setTimeout);

    await exportVideo(spec, { fps: 30 });

    vi.mocked(performance.now).mockRestore();
    performance.now = realNow;
    expect(macrotasks.filter((ms) => ms === 0).length).toBeGreaterThan(0);
  });
});

describe('downloadExport', () => {
  it('saves the blob under the result filename, then releases the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clicked: HTMLAnchorElement[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked.push(this);
    };

    downloadExport({
      blob: new Blob(['x']),
      filename: 'diagram.mp4',
      format: 'mp4',
      width: 2,
      height: 2,
      fps: 30,
      frames: 1,
      durationMs: 1,
      elapsedMs: 1,
    });

    HTMLAnchorElement.prototype.click = realClick;

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('diagram.mp4');
    expect(clicked[0].href).toBe('blob:fake');
    // The anchor is temporary and the object URL is released, so a page that
    // exports repeatedly does not accumulate either.
    expect(clicked[0].isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
