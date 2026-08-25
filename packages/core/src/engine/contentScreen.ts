import type { ContentLimit } from './placements';
import type { ObjectContent } from '../types';

/**
 * A panel that is a SCREEN: laid out once in its own pixel space, then scaled
 * to whatever room the node has.
 *
 * Without this, a rich panel re-flows. Its box is capped at the node's
 * allowance (`computeContentLimits`, ultimately ~38% of the player and 420px),
 * while its type stays the size the stylesheet says — so the same markup is a
 * two-column layout on a wide player and a stack of wrapped lines on a narrow
 * one. That is the right behaviour for a paragraph and the wrong one for a
 * SIMULATED INTERFACE, where the arrangement IS the message: a student has to
 * recognise the same screen at every size.
 *
 * So an author declares a design space — 480px wide, say — writes the markup
 * against it, and the renderer only ever changes the SCALE. Layout is computed
 * once, at the design size, and is therefore identical on a phone-sized preview
 * and on a projector. Nothing wraps differently; nothing needs measuring.
 *
 * The scale is pure arithmetic over `ContentLimit`, which is itself a function
 * of the layout and the player box — never of anything measured. That is what
 * keeps a screen as scrubbable and as exportable as the rest of the renderer.
 */

/**
 * Height of a screen whose author gave only a width: 16:10, the shape of a
 * laptop lid. A screen has to have a height — it is a box, and what overflows
 * it is cropped, exactly as a real screen crops what is below the fold.
 */
const DEFAULT_SCREEN_RATIO = 0.625;

/** Bounds, so a spec cannot ask for a 3-pixel or a 20-metre screen. */
const MIN_SCREEN_PX = 40;
const MAX_SCREEN_PX = 4000;

export interface ScreenBox {
  /** Design width in CSS px — the space the markup is laid out in. */
  width: number;
  /** Design height in CSS px. */
  height: number;
}

/**
 * The design space `content` asks for, or `undefined` when it asks for none —
 * in which case the panel keeps the ordinary flowing behaviour.
 */
export function screenBox(content: ObjectContent): ScreenBox | undefined {
  const declared = content.screen_width;
  if (declared == null || !Number.isFinite(declared) || declared <= 0)
    return undefined;
  const width = clampPx(declared);
  const height = clampPx(content.screen_height ?? width * DEFAULT_SCREEN_RATIO);
  return { width, height };
}

function clampPx(value: number): number {
  if (!Number.isFinite(value)) return MIN_SCREEN_PX;
  return Math.min(Math.max(value, MIN_SCREEN_PX), MAX_SCREEN_PX);
}

/**
 * Factor the screen is drawn at, so the whole of it fits the node's allowance.
 *
 * Uniform on both axes — a screen that stretched would stop being the picture
 * the author composed. Not capped at 1: on a roomy player the screen grows into
 * the space it is given, which is the whole point of a design space, and
 * `ContentLimit` is what stops it from ever covering a neighbour.
 */
export function screenScale(
  box: ScreenBox,
  limit: ContentLimit | undefined
): number {
  if (!limit || limit.maxW <= 0 || limit.maxH <= 0) return 1;
  return Math.min(limit.maxW / box.width, limit.maxH / box.height);
}
