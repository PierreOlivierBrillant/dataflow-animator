/**
 * Layout constants and small pure helpers shared across the renderer.
 *
 * They live in one module rather than next to their first user because several
 * of them are read from both the geometry pass and the drawing pass, and a
 * value the two disagree on is a class of bug nothing else catches.
 */

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Height (px) of the reference "design space". Visual scale is
 * `designScale × (actual_height / DESIGN_H)`: everything is thus strictly
 * proportional to the player size.
 */
export const DESIGN_H = 495;

/**
 * Radius (design px) of the bridge a circuit wire arches over another net's
 * wire — see `wireHops`. Scaled like the stroke it decorates.
 */
export const HOP_RADIUS = 5;

/** Minimum padding (px) between a contained element and its zone border. */
export const ZONE_PADDING = 20;

/** Extra pixels reserved at the top of a zone that has a label, so the label
 *  text never overlaps the highest node's background — regardless of z-index. */
export const ZONE_LABEL_EXTRA_TOP = 20;

/** Vertical space (px) between the bottom of a node's visual and its label. */
export const NODE_LABEL_GAP = 6;

/**
 * Overhang (px, before scale) of the tinted pictogram's pill beyond the glyph.
 *
 * The value exists TWICE: here, and in the CSS rule that draws it
 * (`dataflow.css`, `.rdfa-node--tinted .rdfa-node-icon::before { inset: calc(-5px * var(--rdfa-scale)) }`).
 * Neither can read the other because the pill is a PSEUDO-ELEMENT: it is out of
 * flow, so `getBoundingClientRect` cannot see it and the geometry has to be
 * reconstructed arithmetically. A change to one must be mirrored in the other.
 */
export const PASTILLE_INSET = 5;

/** Half-width of the arrowhead triangle. */
export const ARROW_HEAD = 9;

/**
 * Muted mid-tones used to tint each logic net. Chosen to stay legible on both
 * themes and to differ only slightly from the neutral wire — enough to tell two
 * crossing nets apart without shouting.
 *
 * Origin: `Stage.tsx` `NET_PALETTE`.
 */
export const NET_PALETTE = [
  '#6b7bab',
  '#ab6b7b',
  '#6b9c78',
  '#8f6bab',
  '#ab946b',
  '#6ba7a1',
  '#9cab6b',
  '#ab7b6b',
];
