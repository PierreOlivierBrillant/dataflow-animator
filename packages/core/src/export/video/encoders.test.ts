/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The three container writers, with WebCodecs and the muxers faked.
 *
 * jsdom has no `VideoEncoder`, so the fakes ARE the environment here. They are
 * shaped to the real contracts in the ways that matter: the encoder reports
 * errors through a callback rather than a throw, `VideoFrame` must be closed,
 * and `encodeQueueSize` is what back-pressure reads.
 */

interface EncodeCall {
  timestamp: number;
  keyFrame: boolean;
}

let encodeCalls: EncodeCall[] = [];
let closedFrames = 0;
let createdFrames = 0;
let configured: VideoEncoderConfig | undefined;
let flushed = 0;
let supported = true;
/** Set to fire the encoder's error callback on the Nth encode (1-based). */
let failOnEncode = 0;
let queueSize = 0;
let errorCallback: ((e: DOMException) => void) | undefined;

const webmMuxer = { addVideoChunk: vi.fn(), finalize: vi.fn() };
const mp4Muxer = { addVideoChunk: vi.fn(), finalize: vi.fn() };
let webmOptions: Record<string, unknown> | undefined;
let mp4Options: Record<string, unknown> | undefined;

vi.mock('webm-muxer', () => ({
  Muxer: class {
    constructor(options: Record<string, unknown>) {
      webmOptions = options;
      return webmMuxer as unknown as object;
    }
  },
  ArrayBufferTarget: class {
    buffer = new ArrayBuffer(8);
  },
}));
vi.mock('mp4-muxer', () => ({
  Muxer: class {
    constructor(options: Record<string, unknown>) {
      mp4Options = options;
      return mp4Muxer as unknown as object;
    }
  },
  ArrayBufferTarget: class {
    buffer = new ArrayBuffer(8);
  },
}));

const gifFrames: { delay: number; width: number }[] = [];
vi.mock('gifenc', () => ({
  GIFEncoder: () => ({
    writeFrame: (
      _index: Uint8Array,
      width: number,
      _height: number,
      options: { delay: number }
    ) => gifFrames.push({ delay: options.delay, width }),
    finish: () => {},
    bytes: () => new Uint8Array([0x47, 0x49, 0x46]),
  }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array(4),
}));

const { createEncoder, FORMAT_META } = await import('./encoders');

function canvas(): HTMLCanvasElement {
  const element = document.createElement('canvas');
  element.width = 4;
  element.height = 4;
  return element;
}

beforeEach(() => {
  encodeCalls = [];
  closedFrames = 0;
  createdFrames = 0;
  configured = undefined;
  flushed = 0;
  supported = true;
  failOnEncode = 0;
  queueSize = 0;
  gifFrames.length = 0;
  webmMuxer.addVideoChunk.mockClear();
  webmMuxer.finalize.mockClear();
  mp4Muxer.addVideoChunk.mockClear();
  mp4Muxer.finalize.mockClear();

  vi.stubGlobal(
    'VideoEncoder',
    class {
      static isConfigSupported = async (config: {
        codec: string;
        width: number;
      }): Promise<{ supported: boolean }> => {
        if (!supported) return { supported: false };
        // Mirrors a real level cap: baseline 3.1 refuses anything above 720p.
        if (config.codec === 'avc1.42001f' && config.width > 1280)
          return { supported: false };
        return { supported: true };
      };
      constructor(init: {
        output: (c: unknown, m?: unknown) => void;
        error: (e: DOMException) => void;
      }) {
        this.#output = init.output;
        errorCallback = init.error;
      }
      #output: (c: unknown, m?: unknown) => void;
      get encodeQueueSize(): number {
        return queueSize;
      }
      configure(config: VideoEncoderConfig): void {
        configured = config;
      }
      encode(
        frame: { timestamp: number },
        options: { keyFrame: boolean }
      ): void {
        encodeCalls.push({
          timestamp: frame.timestamp,
          keyFrame: options.keyFrame,
        });
        if (encodeCalls.length === failOnEncode) {
          errorCallback?.(
            new DOMException('encoder blew up', 'OperationError')
          );
        }
        this.#output({ byteLength: 10 }, { decoderConfig: {} });
      }
      async flush(): Promise<void> {
        flushed++;
      }
      close(): void {}
    }
  );

  vi.stubGlobal(
    'VideoFrame',
    class {
      timestamp: number;
      constructor(_source: unknown, init: { timestamp: number }) {
        this.timestamp = init.timestamp;
        createdFrames++;
      }
      close(): void {
        closedFrames++;
      }
    }
  );

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        getImageData: () => ({ data: new Uint8ClampedArray(64) }),
      }) as unknown as CanvasRenderingContext2D
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const init = { width: 320, height: 180, fps: 10, bitrate: 1_000_000 };

describe('webm', () => {
  it('configures VP8 and muxes into a WebM blob', async () => {
    const encoder = await createEncoder('webm', init);
    await encoder.addFrame(canvas(), 0);
    const blob = await encoder.finish();

    expect(configured?.codec).toBe('vp8');
    expect(webmOptions?.video).toMatchObject({
      codec: 'V_VP8',
      width: 320,
      height: 180,
    });
    expect(webmMuxer.addVideoChunk).toHaveBeenCalledTimes(1);
    expect(webmMuxer.finalize).toHaveBeenCalledTimes(1);
    expect(blob.type).toBe('video/webm');
  });

  it('timestamps frames from the frame rate, not the wall clock', async () => {
    const encoder = await createEncoder('webm', init);
    for (let i = 0; i < 3; i++) await encoder.addFrame(canvas(), i);

    // 10 fps → 100_000 µs apart. This is exactly what MediaRecorder cannot do,
    // and why it is not used: it would stamp these with real elapsed time.
    expect(encodeCalls.map((c) => c.timestamp)).toEqual([0, 100_000, 200_000]);
  });

  it('emits a keyframe every two seconds', async () => {
    const encoder = await createEncoder('webm', init);
    for (let i = 0; i < 21; i++) await encoder.addFrame(canvas(), i);

    const keyed = encodeCalls
      .map((c, i) => (c.keyFrame ? i : -1))
      .filter((i) => i >= 0);
    expect(keyed).toEqual([0, 20]); // fps 10 → every 20 frames
  });

  it('closes every VideoFrame it creates', async () => {
    const encoder = await createEncoder('webm', init);
    for (let i = 0; i < 5; i++) await encoder.addFrame(canvas(), i);

    // A VideoFrame holds a GPU buffer; leaking them stalls the encoder after a
    // few dozen frames.
    expect(createdFrames).toBe(5);
    expect(closedFrames).toBe(5);
  });

  it('waits when the encoder queue backs up', async () => {
    const encoder = await createEncoder('webm', init);
    queueSize = 20;
    let settled = false;
    const pending = encoder.addFrame(canvas(), 0).then(() => {
      settled = true;
    });

    await new Promise((r) => setTimeout(r, 5));
    expect(settled).toBe(false); // still throttled

    queueSize = 0;
    await pending;
    expect(settled).toBe(true);
  });

  it('surfaces an asynchronous encoder error at the next call', async () => {
    const encoder = await createEncoder('webm', init);
    failOnEncode = 1;
    await encoder.addFrame(canvas(), 0);

    // The error callback fires long after `encode()` returned, so it is held
    // and rethrown where an `await` can actually catch it.
    await expect(encoder.addFrame(canvas(), 1)).rejects.toThrow(
      'encoder blew up'
    );
  });

  it('refuses a configuration the browser cannot encode', async () => {
    supported = false;
    await expect(createEncoder('webm', init)).rejects.toThrow(/cannot encode/);
  });

  it('explains itself when WebCodecs is missing entirely', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    await expect(createEncoder('webm', init)).rejects.toThrow(/WebCodecs/);
  });
});

describe('mp4', () => {
  it('steps up the H.264 level when the size needs it', async () => {
    // Baseline 3.1 tops out at 1280×720. Hard-coding it — which this shipped
    // with — made a 1080p MP4 fail outright with "cannot encode", exactly at
    // the resolution the settings panel now offers.
    const encoder = await createEncoder('mp4', {
      ...init,
      width: 1920,
      height: 1080,
    });
    await encoder.addFrame(canvas(), 0);

    expect(configured?.codec).toBe('avc1.420028');
  });

  it('keeps the most compatible level when the size allows it', async () => {
    await createEncoder('mp4', { ...init, width: 1280, height: 720 });
    expect(configured?.codec).toBe('avc1.42001f');
  });

  it('configures H.264 baseline in avc format, with a front-loaded index', async () => {
    const encoder = await createEncoder('mp4', init);
    await encoder.addFrame(canvas(), 0);
    const blob = await encoder.finish();

    expect(configured?.codec).toBe('avc1.42001f');
    // mp4-muxer wants length-prefixed samples, not Annex B.
    expect(configured?.avc).toEqual({ format: 'avc' });
    // Without `fastStart` a player must read to the end before it can begin.
    expect(mp4Options?.fastStart).toBe('in-memory');
    expect(blob.type).toBe('video/mp4');
    expect(mp4Muxer.finalize).toHaveBeenCalledTimes(1);
    expect(flushed).toBe(1);
  });
});

describe('gif', () => {
  it('compensates the centisecond rounding so the total stays honest', async () => {
    // 15 fps wants 6.67 cs per frame and GIF can only store whole centiseconds.
    // Rounding each frame identically would stretch a 10.7 s animation to 11.3 s;
    // alternating 6 and 7 keeps the total on the real duration.
    const encoder = await createEncoder('gif', { ...init, fps: 15 });
    for (let i = 0; i < 15; i++) await encoder.addFrame(canvas(), i);

    const delays = gifFrames.map((f) => f.delay);
    expect(new Set(delays)).toEqual(new Set([60, 70]));
    // One second of frames must add up to one second.
    expect(delays.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('is exact when the frame rate divides cleanly', async () => {
    const encoder = await createEncoder('gif', { ...init, fps: 20 });
    for (let i = 0; i < 5; i++) await encoder.addFrame(canvas(), i);

    expect(gifFrames.map((f) => f.delay)).toEqual([50, 50, 50, 50, 50]);
  });

  it('produces a gif blob and touches no video encoder', async () => {
    const encoder = await createEncoder('gif', init);
    await encoder.addFrame(canvas(), 0);
    const blob = await encoder.finish();

    expect(blob.type).toBe('image/gif');
    expect(configured).toBeUndefined();
    expect(createdFrames).toBe(0);
  });
});

describe('FORMAT_META', () => {
  it('names a file extension for every format', () => {
    expect(FORMAT_META.webm.extension).toBe('webm');
    expect(FORMAT_META.mp4.extension).toBe('mp4');
    expect(FORMAT_META.gif.extension).toBe('gif');
  });
});
