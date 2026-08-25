import type { ObjectContent } from '../types';

/**
 * A moving image, driven by the TIMELINE's clock instead of its own.
 *
 * An `<img>` pointed at an animated GIF plays on the wall clock: it ignores the
 * pause button, it does not rewind when the scrub bar goes backwards, and an
 * exported frame catches whichever moment the decoder happened to be on. None
 * of that is fixable from JavaScript — a GIF's playhead is not exposed.
 *
 * So a sequence is spelled out as `frames`, and the frame on screen is a PURE
 * function of `t`, exactly like every other value the renderer reads. Pausing
 * stops it because `t` stops; scrubbing backwards rewinds it because
 * `frameIndexAt` is not a stepper; the exporter gets the right frame because it
 * asks for an instant, not for "now".
 */

/** Frames per second when the content does not say. Cinematic enough, cheap. */
export const DEFAULT_CONTENT_FPS = 12;

/** Guards against a spec asking for 0 (a still) or 10⁶ (a divide by nothing). */
const MIN_FPS = 0.1;
const MAX_FPS = 60;

/** The sequence's declared rate, clamped into something renderable. */
export function contentFps(content: ObjectContent): number {
  const fps = content.fps ?? DEFAULT_CONTENT_FPS;
  if (!Number.isFinite(fps)) return DEFAULT_CONTENT_FPS;
  return Math.min(Math.max(fps, MIN_FPS), MAX_FPS);
}

/**
 * Duration of ONE pass through the sequence, or `undefined` when the content
 * carries no sequence. Used by the reading-time estimate, so a `set_content`
 * with no explicit `duration` lasts at least long enough to play through.
 */
export function contentCycleMs(content: ObjectContent): number | undefined {
  const count = content.frames?.length ?? 0;
  if (count === 0) return undefined;
  return (count / contentFps(content)) * 1000;
}

/**
 * Index of the frame visible `elapsedMs` after the sequence started, or
 * `undefined` when there is no sequence (the caller then leaves `value`'s still
 * image alone).
 *
 * A finished non-looping sequence HOLDS its last frame rather than clearing:
 * the panel stays up for as long as the action does, and blanking it at the end
 * would read as a bug.
 */
export function contentFrameIndex(
  content: ObjectContent,
  elapsedMs: number
): number | undefined {
  const frames = content.frames;
  if (!frames || frames.length === 0) return undefined;
  const step = Math.floor(
    (Math.max(0, elapsedMs) * contentFps(content)) / 1000
  );
  if (content.loop === false) return Math.min(step, frames.length - 1);
  return step % frames.length;
}

/**
 * The image source to show for `content` at frame `index`.
 *
 * `value` is the fallback in both directions: a sequence with no frame yet
 * shows the still, and a still with no sequence is all there is.
 */
export function contentFrameSrc(
  content: ObjectContent,
  index: number | undefined
): string | undefined {
  if (index === undefined) return content.value;
  return content.frames?.[index] ?? content.value;
}
