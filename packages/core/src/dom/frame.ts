import type { LayoutMap } from '../engine/layout';

/**
 * Fixed-aspect framing of a circuit schematic.
 *
 * Ported from the removed `Stage.tsx`'s `circuitFrameAspect` / `letterbox`
 * (see `stageConstants.ts` for why these live here rather than being imported).
 */

export interface Frame {
  w: number;
  h: number;
  offX: number;
  offY: number;
}

/**
 * Natural width:height aspect of a circuit layout, so it can be drawn in a
 * fixed-aspect frame (letterboxed) instead of stretched to the container — the
 * ONLY way routing stays identical at any size AND shape. It is simply the
 * aspect of the NODE CLOUD (`xspan / yspan`), so the frame matches the drawing
 * the layout already produced — a wide chain gets a wide frame, minimal margin.
 * Clamped to a sane range; 1.6 by default (too few nodes / a degenerate span).
 *
 * Origin: `Stage.tsx` `circuitFrameAspect`.
 */
export function circuitFrameAspect(layout: LayoutMap): number {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const id in layout) {
    xs.push(layout[id].cx);
    ys.push(layout[id].cy);
  }
  if (xs.length < 2) return 1.6;
  const xspan = Math.max(...xs) - Math.min(...xs);
  const yspan = Math.max(...ys) - Math.min(...ys);
  if (xspan < 1e-3 || yspan < 1e-3) return 1.6;
  return Math.min(3.2, Math.max(1, xspan / yspan));
}

/**
 * Largest box of the given aspect that fits in `w × h`, centred (letterbox).
 * `aspect <= 0` disables it (the content fills the container as before).
 *
 * Origin: `Stage.tsx` `letterbox`.
 */
export function letterbox(w: number, h: number, aspect: number): Frame {
  if (aspect <= 0 || w <= 0 || h <= 0) return { w, h, offX: 0, offY: 0 };
  const fw = Math.min(w, h * aspect);
  const fh = fw / aspect;
  return { w: fw, h: fh, offX: (w - fw) / 2, offY: (h - fh) / 2 };
}
