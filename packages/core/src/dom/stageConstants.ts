/**
 * Constants and small pure helpers the vanilla renderer shares with the React
 * `Stage`.
 *
 * Every value here is a DUPLICATE of one that currently lives inside
 * `packages/react-dataflow-animator/src/components/Stage.tsx` (or
 * `ArrowLine.tsx` / `useStageGeometry.ts`). They are copied rather than moved
 * because the React package's `src` is frozen for this phase; the duplication is
 * temporary and resorbed at step 2.6, when the React components are deleted and
 * these become the only copies. Each entry names its origin so the pair can be
 * checked by eye until then.
 */

/** Origin: `Stage.tsx` `lerp`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Height (px) of the reference "design space". Visual scale is
 * `designScale × (actual_height / DESIGN_H)`: everything is thus strictly
 * proportional to the player size.
 *
 * Origin: `Stage.tsx` `DESIGN_H`.
 */
export const DESIGN_H = 495;

/**
 * Radius (design px) of the bridge a circuit wire arches over another net's
 * wire — see `wireHops`. Scaled like the stroke it decorates.
 *
 * Origin: `Stage.tsx` `HOP_RADIUS`.
 */
export const HOP_RADIUS = 5;

/** Minimum padding (px) between a contained element and its zone border.
 *  Origin: `Stage.tsx` `ZONE_PADDING`. */
export const ZONE_PADDING = 20;

/** Extra pixels reserved at the top of a zone that has a label, so the label
 *  text never overlaps the highest node's background — regardless of z-index.
 *  Origin: `Stage.tsx` `ZONE_LABEL_EXTRA_TOP`. */
export const ZONE_LABEL_EXTRA_TOP = 20;

/** Vertical space (px) between the bottom of a node's visual and its label.
 *  Origin: `Stage.tsx` `NODE_LABEL_GAP`. */
export const NODE_LABEL_GAP = 6;

/**
 * Overhang (px, before scale) of the tinted pictogram's pill beyond the glyph.
 *
 * This constant now exists in THREE places, which is one more than is
 * comfortable: the CSS rule that draws it
 * (`dataflow.css`, `.rdfa-node--tinted .rdfa-node-icon::before { inset: calc(-5px * var(--rdfa-scale)) }`),
 * `useStageGeometry.ts`'s `PASTILLE_INSET`, and here. The reason none of them can
 * read the others is that the pill is a PSEUDO-ELEMENT: it is out of flow, so
 * `getBoundingClientRect` cannot see it and the geometry has to be reconstructed
 * arithmetically. Step 2.6 deletes the hook and brings this back down to two
 * copies (CSS + here); until then, a change to any one of the three must be
 * mirrored in the other two.
 */
export const PASTILLE_INSET = 5;

/** Half-width of the arrowhead triangle. Origin: `ArrowLine.tsx` `HEAD`. */
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
