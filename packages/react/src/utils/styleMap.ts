import type { CSSProperties } from 'react';

/**
 * `CSSProperties` → the kebab-case, string-valued map the core's `el.ts` insists
 * on.
 *
 * The core cannot accept `CSSProperties` (that would be a React type in a
 * React-free package) and deliberately refuses number values, because React's
 * number→px coercion is per-property and getting it wrong costs a pixel
 * silently. The conversion therefore happens here, at the boundary.
 *
 * `UNITLESS` is an explicit, deliberately small list rather than a claim to
 * reimplement React's table: the properties a player root plausibly carries.
 * Anything outside it that is a number gets `px`, which is also React's rule for
 * everything not in its own list.
 */

const UNITLESS = new Set([
  'opacity',
  'zIndex',
  'flex',
  'flexGrow',
  'flexShrink',
  'order',
  'lineHeight',
  'fontWeight',
  'zoom',
  'gridRow',
  'gridRowStart',
  'gridRowEnd',
  'gridColumn',
  'gridColumnStart',
  'gridColumnEnd',
]);

/** `backgroundColor` → `background-color`; `WebkitMask` → `-webkit-mask`. */
function kebab(property: string): string {
  const dashed = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  // A capitalised first letter means a vendor prefix (`WebkitMask`, `MozFoo`),
  // which needs the leading dash the replace above already produced.
  return dashed;
}

export function toStyleMap(
  style?: CSSProperties
): Record<string, string> | undefined {
  if (!style) return undefined;
  const out: Record<string, string> = {};
  for (const [property, value] of Object.entries(style)) {
    if (value == null || value === false) continue;
    // Custom properties (`--rdfa-x`) are passed through untouched: they are
    // already the literal name, and case is significant in them.
    const name = property.startsWith('--') ? property : kebab(property);
    out[name] =
      typeof value === 'number' && !UNITLESS.has(property)
        ? `${value}px`
        : String(value);
  }
  return out;
}
