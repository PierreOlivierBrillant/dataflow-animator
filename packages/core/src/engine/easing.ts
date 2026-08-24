/**
 * Easing curves, one per ROLE.
 *
 * `easeInOutCubic` used to govern five unrelated things: where a packet is, how
 * opacity fades, how a tree's edges draw, how a node rotates, and how panel
 * content cross-fades. One curve for five jobs is not a decision, it is the
 * absence of one — and changing it at the source would move all five at once.
 *
 * So roles get their own curves here, and `easeInOutCubic` stays exactly what it
 * was for everything not yet given one. Adding a role means adding a curve
 * below and applying it at ONE call site, never editing a shared one.
 */

/**
 * Solves a CSS `cubic-bezier(x1, y1, x2, y2)` for y at a given x.
 *
 * Newton-Raphson from a sensible seed, falling back to bisection when the
 * derivative is too flat to trust — the standard approach, and what browsers do
 * internally. Called once per moving element per frame, so it stays cheap.
 */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  const curve = (t: number, a: number, b: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const slope = (t: number, a: number, b: number): number => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const dx = curve(t, x1, x2) - x;
      if (Math.abs(dx) < 1e-6) return curve(t, y1, y2);
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Newton stalled (a flat stretch of the curve): finish by halving.
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (curve(t, x1, x2) < x) lo = t;
      else hi = t;
    }
    return curve(t, y1, y2);
  };
}

/**
 * How a packet covers ground: a decided departure, then a long settle.
 *
 * Asymmetric on purpose. A symmetric curve treats leaving and arriving as the
 * same event, which is true of the arithmetic and false of the perception —
 * arriving is what carries the information, and giving it the longer half is
 * what makes the packet read as an object with mass rather than a value being
 * interpolated. Preferred over the symmetric cubic in a blind A/B.
 */
export const easeTravel = cubicBezier(0.32, 0.72, 0, 1);
