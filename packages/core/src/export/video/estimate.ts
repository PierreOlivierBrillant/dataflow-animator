import type { VideoExportFormat } from './types';

/**
 * How long an export will take, before it is started.
 *
 * The point is to let someone SEE the cost of a choice — 1080p GIF at 60 fps is
 * a different proposition from 540p at 20 — while the settings are still open,
 * rather than discovering it from a progress bar.
 *
 * The model comes from measurement, and the two formats behave nothing alike:
 *
 *  - **Video is nearly flat in resolution.** WebM and MP4 measured 6–8.5 ms per
 *    frame across 0.23 → 2.07 megapixels, because the work is rasterising the
 *    DOM (which happens once, at whatever size) plus a hardware encoder that
 *    barely notices the difference. Frame COUNT is what costs.
 *  - **GIF is linear in pixels.** 10.8 → 17.2 → 25.6 → 44.9 ms per frame over
 *    the same range: quantisation and LZW run in JavaScript, per pixel.
 *
 * Absolute numbers belong to the machine that measured them, so they are a
 * STARTING point only — `recordExportRate` replaces them with what this machine
 * actually does as soon as it has done one export.
 */

/** Fixed cost of an export: mounting the offscreen player, first layout, mux. */
const OVERHEAD_MS = 300;

/** Per-frame cost model, in ms: `base + perMegapixel × megapixels`. */
const FRAME_COST: Record<VideoExportFormat, { base: number; perMp: number }> = {
  webm: { base: 7, perMp: 0.3 },
  mp4: { base: 7, perMp: 0.3 },
  gif: { base: 7, perMp: 19 },
};

/**
 * What this machine has actually been measured doing, per format.
 *
 * A ratio of observed to predicted, not an absolute rate, so it stays valid
 * when the resolution or the frame count changes. It survives for the life of
 * the page: a second export of a different size is estimated with what the
 * first one taught us.
 */
const calibration = new Map<VideoExportFormat, number>();

export interface EstimateInput {
  format: VideoExportFormat;
  width: number;
  height: number;
  /** Total frames the export will write. */
  frames: number;
}

/** Milliseconds the export is expected to take. */
export function estimateExportMs(input: EstimateInput): number {
  const cost = FRAME_COST[input.format];
  const megapixels = (input.width * input.height) / 1_000_000;
  const perFrame = cost.base + cost.perMp * megapixels;
  const raw = OVERHEAD_MS + input.frames * perFrame;
  return Math.round(raw * (calibration.get(input.format) ?? 1));
}

/**
 * Teaches the estimator what an export really cost.
 *
 * Blended rather than replaced, so one export that happened to land during a
 * garbage collection does not throw every later estimate off. Clamped, because
 * a wild ratio is far more likely to be a measurement artefact — an export
 * started while the tab was backgrounded, say — than a machine genuinely ten
 * times slower than the model.
 */
export function recordExportRate(
  input: EstimateInput,
  observedMs: number
): void {
  const previous = calibration.get(input.format) ?? 1;
  // Predict with the factor removed, so the ratio measures the MODEL, not the
  // model already multiplied by a previous correction.
  const cost = FRAME_COST[input.format];
  const megapixels = (input.width * input.height) / 1_000_000;
  const predicted =
    OVERHEAD_MS + input.frames * (cost.base + cost.perMp * megapixels);
  if (predicted <= 0 || observedMs <= 0) return;

  const ratio = Math.min(10, Math.max(0.1, observedMs / predicted));
  calibration.set(input.format, previous * 0.4 + ratio * 0.6);
}

/**
 * Bytes per frame: `base + perMegapixel × megapixels`, in KILOBYTES.
 *
 * Measured on the documentation demos, which is worth stating plainly: file
 * size depends on how much of the picture MOVES, and these are sparse diagrams.
 * A denser animation compresses worse and will come out larger than this says —
 * which is why the numbers are a starting point and `recordExportSize` replaces
 * them with the real thing after one export.
 *
 * The bitrate ceiling is deliberately not used as the model: at 4 Mbit/s a
 * 10.7 s export would predict 5.4 MB, while the encoders actually produced
 * 0.6–0.8 MB. Variable bitrate on a simple scene lands nowhere near the cap.
 */
const FRAME_BYTES: Record<VideoExportFormat, { base: number; perMp: number }> =
  {
    webm: { base: 1, perMp: 2.75 },
    mp4: { base: 0.76, perMp: 2.07 },
    gif: { base: 4.8, perMp: 14.3 },
  };

const sizeCalibration = new Map<VideoExportFormat, number>();

/** Bytes the finished file is expected to weigh. */
export function estimateExportBytes(input: EstimateInput): number {
  const cost = FRAME_BYTES[input.format];
  const megapixels = (input.width * input.height) / 1_000_000;
  const kilobytes = input.frames * (cost.base + cost.perMp * megapixels);
  const raw = kilobytes * 1024;
  return Math.round(raw * (sizeCalibration.get(input.format) ?? 1));
}

/** Teaches the size model what an export really weighed. See {@link recordExportRate}. */
export function recordExportSize(
  input: EstimateInput,
  observedBytes: number
): void {
  const previous = sizeCalibration.get(input.format) ?? 1;
  const cost = FRAME_BYTES[input.format];
  const megapixels = (input.width * input.height) / 1_000_000;
  const predicted = input.frames * (cost.base + cost.perMp * megapixels) * 1024;
  if (predicted <= 0 || observedBytes <= 0) return;

  const ratio = Math.min(10, Math.max(0.1, observedBytes / predicted));
  sizeCalibration.set(input.format, previous * 0.4 + ratio * 0.6);
}

/**
 * A file size a person can read at a glance: `"800 kB"`, `"2.7 MB"`.
 *
 * Same coarseness as the duration, and for the same reason: the model cannot
 * tell a busy animation from a sparse one, so a third significant figure would
 * be invention.
 */
export function formatSize(
  bytes: number,
  labels: { kilobytes: string; megabytes: string }
): string {
  const megabytes = bytes / 1_048_576;
  if (megabytes < 1) {
    const kilobytes = Math.max(10, Math.round(bytes / 1024 / 10) * 10);
    return labels.kilobytes.replace('{n}', String(kilobytes));
  }
  const rounded =
    megabytes < 10 ? Math.round(megabytes * 10) / 10 : Math.round(megabytes);
  return labels.megabytes.replace('{n}', String(rounded));
}

/** Forgets what was learned. Exists for tests; nothing in the player calls it. */
export function resetExportCalibration(): void {
  calibration.clear();
  sizeCalibration.clear();
}

/**
 * A duration a person can read at a glance: `"~4 s"`, `"~1 min 20 s"`.
 *
 * Deliberately coarse. The estimate is an order of magnitude, not a promise,
 * and rendering it as `3.7 s` would claim a precision the model does not have —
 * so anything under ten seconds rounds to the second and anything above rounds
 * harder as it grows.
 */
export function formatEstimate(
  ms: number,
  labels: { seconds: string; minutes: string }
): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    const rounded =
      seconds < 10 ? Math.ceil(seconds) : Math.ceil(seconds / 5) * 5;
    return labels.seconds.replace('{n}', String(rounded));
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.ceil((seconds - minutes * 60) / 10) * 10;
  // `1 min 60 s` is what naive rounding produces; carry it instead.
  if (rest >= 60) {
    return labels.minutes
      .replace('{m}', String(minutes + 1))
      .replace('{s}', '0');
  }
  return labels.minutes
    .replace('{m}', String(minutes))
    .replace('{s}', String(rest));
}
