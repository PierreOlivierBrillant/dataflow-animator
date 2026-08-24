import { clamp, easeInOutCubic, FADE_MS } from '../engine/timeline';

/**
 * Opacity of a clip with fade: fade in during the appear hold (or over
 * FADE_MS if there is none), fade out over FADE_MS before disappearing.
 * No fade out if `keepEnd` is true (the clip must remain visible
 * until the very end of the timeline).
 *
 * `fadeInMs` and `fadeOutMs` replace default durations if provided.
 * 0 = instant appearance/disappearance (no fade).
 */
export function clipOpacity(
  clip: {
    startMs: number;
    animStartMs: number;
    visibleUntilMs: number;
    keepEnd?: boolean;
    fadeInMs?: number;
    fadeOutMs?: number;
  },
  t: number
): number {
  const inDur = clip.animStartMs - clip.startMs;
  const effectiveFadeIn =
    clip.fadeInMs !== undefined ? clip.fadeInMs : inDur > 0 ? inDur : FADE_MS;
  const fadeIn =
    effectiveFadeIn <= 0
      ? 1
      : clamp((t - clip.startMs) / effectiveFadeIn, 0, 1);
  if (clip.keepEnd) return fadeIn;
  const effectiveFadeOut =
    clip.fadeOutMs !== undefined ? clip.fadeOutMs : FADE_MS;
  const outStart = clip.visibleUntilMs - effectiveFadeOut;
  const fadeOut =
    effectiveFadeOut <= 0 || t <= outStart
      ? 1
      : clamp((clip.visibleUntilMs - t) / effectiveFadeOut, 0, 1);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Crossfade of a `set_content`: linear fade of `clipOpacity` eased by
 * `easeInOutCubic`. This value drives BOTH the content opacity AND the
 * geometry lerp (the node transitions from icon to panel); easing them together
 * removes the mechanical effect of the linear morph — eased start and end.
 * Packet/arrow fades keep raw `clipOpacity`.
 *
 * Single source of truth shared with the validation harness (see
 * scripts/validation-harness): the curve it plots IS the one rendered here.
 */
export function contentCrossfade(
  clip: Parameters<typeof clipOpacity>[0],
  t: number
): number {
  return easeInOutCubic(clipOpacity(clip, t));
}
