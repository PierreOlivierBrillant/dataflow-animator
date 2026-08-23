import type { VideoExportFormat } from './types';
import { yieldToBrowser } from './yieldToBrowser';

/**
 * The three container writers, behind one interface.
 *
 * Every muxer is reached through `import()`, never a static import. That is the
 * whole reason an export button can exist in a library this size: a consumer
 * who never exports pays nothing, because the ~50 kB of muxer code lives in a
 * chunk that is only fetched when someone actually clicks. `vite.config.ts`
 * keeps the three specifiers EXTERNAL so they survive the library build as real
 * dynamic imports rather than being folded into the main bundle.
 *
 * WebCodecs is what makes the video formats viable, and `MediaRecorder` is what
 * makes them not: a recorder timestamps on the WALL CLOCK, so an animation
 * generated eight times faster than real time comes out as a file eight times
 * too short. `VideoEncoder` takes the timestamp as a parameter, so the file's
 * duration is whatever the animation's duration is, however fast the machine
 * produced it.
 */

/** What the orchestrator drives, whichever format was asked for. */
export interface FrameEncoder {
  /** Hands one drawn frame over. `index` is the frame number, from 0. */
  addFrame(canvas: HTMLCanvasElement, index: number): Promise<void>;
  /** Flushes, muxes, and returns the finished file. */
  finish(): Promise<Blob>;
}

export interface EncoderInit {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

/** Microsecond timestamp of frame `index` — the unit WebCodecs works in. */
function timestampFor(index: number, fps: number): number {
  return Math.round((index * 1_000_000) / fps);
}

/**
 * Shared WebCodecs plumbing for the two video formats.
 *
 * `onChunk` is where the two differ: each muxer takes the chunk and its
 * metadata in its own way. Everything else — configuration, the keyframe
 * cadence, error propagation — is identical.
 */
/**
 * H.264 candidates, lowest level first.
 *
 * A level caps the frame SIZE, and the cap bites at exactly the resolutions an
 * export offers: baseline 3.1 — the obvious "most compatible" choice, and what
 * this shipped with — tops out at 1280×720, so asking it for 1080p fails
 * outright with "this browser cannot encode". Rather than hard-code a
 * resolution→level table that would have to stay correct forever, the list is
 * tried in order and the first level the browser accepts AT THIS SIZE wins:
 * that keeps the file as widely playable as it can be, without ever refusing a
 * size the machine could actually encode.
 */
const H264_LEVELS = [
  'avc1.42001f', // baseline 3.1 — up to 1280×720
  'avc1.420028', // baseline 4.0 — up to 1920×1088
  'avc1.420032', // baseline 5.0 — beyond
  'avc1.420033', // baseline 5.1
];

async function createVideoEncoder(
  init: EncoderInit,
  codecs: string[],
  configExtra: Partial<VideoEncoderConfig>,
  onChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void
): Promise<{
  addFrame: (canvas: HTMLCanvasElement, index: number) => Promise<void>;
  flush: () => Promise<void>;
}> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error(
      '[dataflow-animator] video export needs the WebCodecs API, which this browser does not provide. Try the GIF format, or a Chromium-based browser.'
    );
  }

  const base = {
    width: init.width,
    height: init.height,
    bitrate: init.bitrate,
    framerate: init.fps,
    ...configExtra,
  };

  let config: VideoEncoderConfig | undefined;
  for (const codec of codecs) {
    const candidate: VideoEncoderConfig = { codec, ...base };
    const support = await VideoEncoder.isConfigSupported(candidate);
    if (support.supported) {
      config = candidate;
      break;
    }
  }
  if (!config) {
    throw new Error(
      `[dataflow-animator] this browser cannot encode ${codecs[0]} at ${init.width}×${init.height}.`
    );
  }

  // The error callback fires asynchronously, long after the `encode()` that
  // caused it has returned. Holding it and rethrowing at `flush` is what turns
  // it back into something the caller's `await` can catch.
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: onChunk,
    error: (error: DOMException) => {
      failure = new Error(
        `[dataflow-animator] encoding failed: ${error.message}`
      );
    },
  });
  encoder.configure(config);

  // One keyframe every two seconds: enough for a scrubbable file without
  // inflating it the way an all-keyframe stream would.
  const keyFrameInterval = Math.max(1, Math.round(init.fps * 2));

  return {
    async addFrame(canvas, index) {
      if (failure) throw failure;
      const frame = new VideoFrame(canvas, {
        timestamp: timestampFor(index, init.fps),
        duration: Math.round(1_000_000 / init.fps),
      });
      try {
        encoder.encode(frame, { keyFrame: index % keyFrameInterval === 0 });
      } finally {
        // A VideoFrame holds a GPU buffer; leaking one stalls the encoder after
        // a few dozen frames, so it is closed even if `encode` threw.
        frame.close();
      }
      // Back-pressure: without this the whole animation is queued at once and
      // memory climbs with the frame count.
      while (encoder.encodeQueueSize > 8) {
        await yieldToBrowser();
        if (failure) throw failure;
      }
    },
    async flush() {
      await encoder.flush();
      encoder.close();
      if (failure) throw failure;
    },
  };
}

async function createWebmEncoder(init: EncoderInit): Promise<FrameEncoder> {
  const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP8',
      width: init.width,
      height: init.height,
      frameRate: init.fps,
    },
  });
  const encoder = await createVideoEncoder(init, ['vp8'], {}, (chunk, meta) =>
    muxer.addVideoChunk(chunk, meta)
  );
  return {
    addFrame: encoder.addFrame,
    async finish() {
      await encoder.flush();
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/webm' });
    },
  };
}

async function createMp4Encoder(init: EncoderInit): Promise<FrameEncoder> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: init.width, height: init.height },
    // The MP4 index goes at the FRONT of the file. Without it a player has to
    // read to the end before it can start, which for a file served over HTTP
    // means it will not play until fully downloaded.
    fastStart: 'in-memory',
  });
  const encoder = await createVideoEncoder(
    init,
    H264_LEVELS,
    // `avc` (length-prefixed) rather than `annexb` — the format mp4-muxer wants.
    { avc: { format: 'avc' } },
    (chunk, meta) => muxer.addVideoChunk(chunk, meta)
  );
  return {
    addFrame: encoder.addFrame,
    async finish() {
      await encoder.flush();
      muxer.finalize();
      return new Blob([target.buffer], { type: 'video/mp4' });
    },
  };
}

async function createGifEncoder(init: EncoderInit): Promise<FrameEncoder> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const gif = GIFEncoder();

  // GIF stores a delay per frame in HUNDREDTHS of a second, so most frame rates
  // are not representable: 15 fps wants 6.67 cs and can only be given 6 or 7.
  // Rounding every frame the same way compounds that error — 161 frames of 7 cs
  // turn a 10.7 s animation into an 11.3 s file.
  //
  // So the delay is derived from where each frame ENDS on an exact timeline,
  // and the running total is subtracted back out. Individual frames alternate
  // between 6 and 7 cs, which nobody can see, and the total lands on the real
  // duration instead of drifting away from it.
  let emittedCs = 0;

  return {
    async addFrame(canvas, index) {
      const targetCs = Math.round(((index + 1) * 100) / init.fps);
      const delay = Math.max(1, targetCs - emittedCs) * 10;
      emittedCs += delay / 10;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('[dataflow-animator] 2D context lost');
      const { data } = ctx.getImageData(0, 0, init.width, init.height);
      // A per-frame palette, not a global one: these scenes are flat-colour
      // diagrams (a typical frame holds well under 256 distinct colours), so
      // quantisation is effectively lossless and costs less than reconciling
      // one shared palette across the whole animation would.
      const palette = quantize(data, 256);
      const indexed = applyPalette(data, palette);
      gif.writeFrame(indexed, init.width, init.height, { palette, delay });
      // GIF encoding is synchronous and CPU-bound, so the loop is yielded here
      // rather than in the orchestrator: without it a long export would hold
      // the main thread for seconds at a stretch.
      await yieldToBrowser();
    },
    async finish() {
      gif.finish();
      // `bytes()` returns a view over a larger buffer, so it is copied rather
      // than handed to Blob directly.
      const bytes = gif.bytes();
      return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
    },
  };
}

export function createEncoder(
  format: VideoExportFormat,
  init: EncoderInit
): Promise<FrameEncoder> {
  switch (format) {
    case 'webm':
      return createWebmEncoder(init);
    case 'mp4':
      return createMp4Encoder(init);
    case 'gif':
      return createGifEncoder(init);
  }
}

/** File extension and MIME type per format, for naming and downloading. */
export const FORMAT_META: Record<
  VideoExportFormat,
  { extension: string; mime: string }
> = {
  webm: { extension: 'webm', mime: 'video/webm' },
  mp4: { extension: 'mp4', mime: 'video/mp4' },
  gif: { extension: 'gif', mime: 'image/gif' },
};
