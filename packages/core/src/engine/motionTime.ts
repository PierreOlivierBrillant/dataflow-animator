import type { LayoutMap } from './layout';

/**
 * How long a movement takes, derived from the distance it covers rather than
 * configured — and how long the pauses around it last.
 *
 * The defect this addresses is the mirror image of `readingTime`'s: a `move`
 * took the same time whatever the length of its trip, so the apparent SPEED
 * varied by a factor of two within one scene (measured on the `loadBalancer`
 * demo: 2.09x between its shortest and longest hop). The eye reads a speed, not
 * a duration, and a speed that changes for no reason reads as a mistake.
 *
 * ── The reference frame ──────────────────────────────────────────────────
 *
 * `compile()` knows no geometry: the layout gives ratios, and pixels only exist
 * once a player is mounted. Feeding it the real aspect would make the timeline
 * recompile on every resize — total duration and navigation stops would shift
 * mid-playback, which is worse than the defect being fixed.
 *
 * So distances are measured in a FIXED reference frame instead. The animation
 * keeps one chronology at every size and shape, exactly as the circuit router
 * keeps one routing by letterboxing into a fixed-aspect frame (`dom/frame.ts`).
 * The number below is not the player's size and never has to match it — it is
 * only the ruler the compiler measures with.
 */

/** Width of the frame distances are measured in. A ruler, not a size. */
const REFERENCE_WIDTH = 960;

/** Its aspect — 16:9, the shape a player is most often given. */
export const REFERENCE_ASPECT = 16 / 9;

const REFERENCE_HEIGHT = REFERENCE_WIDTH / REFERENCE_ASPECT;

/**
 * Pixels per second a packet travels at. Calibrated on the corpus so the median
 * derived duration lands on the median an author had been writing by hand:
 * the point is not to change the overall pace, it is to stop the speed from
 * drifting between one hop and the next.
 */
const TRAVEL_SPEED = 430;

/**
 * Bounds. The floor keeps a hop between two adjacent nodes from being a blink;
 * the ceiling keeps a corner-to-corner trip from dragging. Calibrated against
 * the corpus: at a 1400 ms ceiling a quarter of all trips fell outside the
 * linear range, which defeats the point — a bound should catch the extremes,
 * not govern the common case. At 1800 exactly one trip reaches it.
 */
const MIN_MS = 380;
const MAX_MS = 1800;

/** Distance between two nodes, in the reference frame. `undefined` if unknown. */
export function moveDistance(
  layout: LayoutMap,
  fromId: string,
  toId: string
): number | undefined {
  const from = layout[fromId];
  const to = layout[toId];
  if (!from || !to) return undefined;
  return Math.hypot(
    (to.cx - from.cx) * REFERENCE_WIDTH,
    (to.cy - from.cy) * REFERENCE_HEIGHT
  );
}

/**
 * The time that distance should take at a constant speed, bounded. `pace`
 * scales the result after the bounds, as it does for reading time.
 */
export function derivedMoveDuration(
  distance: number,
  pace: number
): number | undefined {
  if (!(distance > 0)) return undefined;
  const ms = (distance / TRAVEL_SPEED) * 1000;
  return Math.round(Math.min(Math.max(ms, MIN_MS), MAX_MS) * pace);
}

/**
 * ── The pauses around a movement ─────────────────────────────────────────
 *
 * A packet is held at its origin before leaving, and at its destination before
 * fading. Both were flat constants (300 ms each), which measured across a busy
 * demo came to 9.2 s of waiting against 9.9 s of actual movement — nearly par.
 *
 * They are fractions of the movement they frame instead, because that is what
 * they are for: a long, slow trip earns a beat to settle, a quick hop should
 * chain straight into the next. The bounds stop either extreme from being
 * absurd, and the arrival gets slightly more than the departure — arriving is
 * the part carrying the information.
 */
const APPEAR_FRACTION = 0.2;
const ARRIVE_FRACTION = 0.26;
const HOLD_MIN_MS = 90;
const HOLD_MAX_MS = 300;

const boundedHold = (ms: number): number =>
  Math.round(Math.min(Math.max(ms, HOLD_MIN_MS), HOLD_MAX_MS));

/** Hold at the origin, before the packet leaves. */
export function appearHold(durationMs: number): number {
  return boundedHold(durationMs * APPEAR_FRACTION);
}

/** Hold at the destination, before the packet fades. */
export function arriveHold(durationMs: number): number {
  return boundedHold(durationMs * ARRIVE_FRACTION);
}
