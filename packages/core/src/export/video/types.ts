import type { Density } from '../../engine/scale';
import type { Highlighter, PlayerTheme } from '../../types';

/**
 * Public shape of the video export.
 *
 * The animation is already a pure function of `t` (`evaluate(timeline, t)`),
 * which is what makes an export possible at all: the exporter walks virtual
 * time at its own pace and never touches the real clock. Nothing here depends
 * on a player being on screen, or on one being paused.
 */

/**
 * Container the frames are written into.
 *
 * - `webm` — VP8 in a WebM container. The fastest of the three and the
 *   smallest to mux. Plays in Chrome, Firefox and Edge; NOT in Safari, and not
 *   in PowerPoint.
 * - `mp4` — H.264 in an MP4 container. Slightly slower, universally playable:
 *   Safari, slide decks, social platforms, chat apps.
 * - `gif` — palette animation. Defaults to a lower resolution and frame rate
 *   than the video formats, which is the norm for the format rather than a
 *   limitation of this implementation. Worth its size where a video will not
 *   auto-play: a GitHub README, a Markdown file.
 */
export type VideoExportFormat = 'webm' | 'mp4' | 'gif';

/** What `onProgress` reports. `ratio` is the one value a progress bar needs. */
export interface VideoExportProgress {
  /**
   * `rendering` covers the whole frame walk (rasterise + encode, which are
   * interleaved); `finalising` is the mux, which is not per-frame and is
   * reported once. There is no separate `encoding` phase because no frame is
   * ever held back — a frame is encoded as soon as it is drawn.
   */
  phase: 'rendering' | 'finalising';
  framesDone: number;
  framesTotal: number;
  /** `framesDone / framesTotal`, clamped to 0..1. */
  ratio: number;
}

export interface VideoExportOptions {
  /** Container and codec. Default: `'webm'`. */
  format?: VideoExportFormat;
  /**
   * Width of the output, in pixels. Default: 1280 (640 for `gif`).
   *
   * The height follows from the player's aspect ratio unless given explicitly.
   * Both are forced to EVEN numbers: H.264 in 4:2:0 cannot encode an odd
   * dimension, and a silent one-pixel crop is worse than a rounded request.
   */
  width?: number;
  /** Height of the output. Default: derived from `width` and the aspect ratio. */
  height?: number;
  /** Frames per second. Default: 30 (15 for `gif`). */
  fps?: number;
  /** Video bitrate in bits per second. Ignored by `gif`. Default: 4_000_000. */
  bitrate?: number;
  /**
   * Size the player is MOUNTED at while exporting, in CSS pixels.
   *
   * This is the layout size, not the output size: the scene is laid out here
   * and then scaled to `width`×`height` as VECTORS, inside the SVG, so text
   * stays sharp at any output resolution. Default: 960×540.
   *
   * It matters because the layout is a function of the box — nodes reflow, a
   * `set_content` panel refits its font. Exporting at the size the player is
   * shown at reproduces what the viewer saw; exporting at a larger one gives a
   * roomier diagram that is no longer pixel-for-pixel the same scene.
   */
  layoutWidth?: number;
  /** Layout height. See {@link layoutWidth}. Default: 540. */
  layoutHeight?: number;
  /** Palette background, drawn under every frame. Default: the theme's. */
  background?: string;
  /** Aborts the export. The returned promise rejects with an `AbortError`. */
  signal?: AbortSignal;
  /** Called after each frame, and once when the mux starts. */
  onProgress?: (progress: VideoExportProgress) => void;
  /** Base name of the produced file, extension excluded. Default: `'dataflow'`. */
  filename?: string;

  // ─── Rendering, mirrored from `PlayerOptions` ─────────────────────────────
  //
  // The exporter mounts a player of its own, so it needs the same rendering
  // knobs the visible one was given. They are repeated rather than accepting a
  // whole `PlayerOptions` because most of that interface is meaningless here:
  // there is no control bar, no clock, no transcript and no fullscreen in an
  // export.

  theme?: PlayerTheme;
  /**
   * Default: `'light'`, NOT `'auto'`.
   *
   * An exported file has no viewer to follow: `auto` resolves against whoever
   * happens to render it, which for a rasterised frame is the exporting
   * machine's OS setting. A file whose colours depend on the exporter's desktop
   * theme is a surprise, so the default is pinned and `'dark'` is explicit.
   */
  mode?: 'light' | 'dark';
  density?: Density;
  highlight?: Highlighter;
}

export interface VideoExportResult {
  /** The finished file. */
  blob: Blob;
  /** Name including the extension, e.g. `dataflow.webm`. */
  filename: string;
  format: VideoExportFormat;
  width: number;
  height: number;
  fps: number;
  /** Frames actually written. */
  frames: number;
  /** Duration of the animation, and so of the file, in ms. */
  durationMs: number;
  /** Wall-clock time the export took, in ms. */
  elapsedMs: number;
}
