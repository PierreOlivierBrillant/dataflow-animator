import { animatedSelectors, animationPhaseCss } from './css';

/**
 * Turns a live player subtree into pixels, one virtual instant at a time.
 *
 * The route is DOM → `<foreignObject>` SVG → `data:` URI → `<img>` → canvas.
 * Three details of it are load-bearing, and each one was arrived at by watching
 * the alternative fail:
 *
 *  1. **`data:`, never `blob:`.** A `blob:` URL taints the canvas it is drawn
 *     on — with no external resource involved, purely because of the opaque
 *     origin an SVG image gets. A tainted canvas is refused by `VideoFrame`
 *     ("VideoFrames can't be created from tainted sources"), so the export
 *     cannot proceed. The same markup behind a `data:` URI stays clean.
 *  2. **The serialised element is the `.rdfa-player` root, not the stage.**
 *     Every rule and every custom property is scoped under `.rdfa-player`
 *     (`--rdfa-bg`, the `data-theme` palettes, the `color-scheme` that resolves
 *     `light-dark()`). Serialising `.rdfa-stage` on its own drops all of it and
 *     rasterises a perfectly blank frame.
 *  3. **Scaling happens INSIDE the SVG.** A `transform: scale()` on the wrapper
 *     is applied before rasterisation, so the browser renders the scene at the
 *     output resolution: text and strokes come out sharp at 1080p from a 960px
 *     layout. Drawing small and enlarging the bitmap afterwards would not.
 */

export interface RasterizerOptions {
  /** The `.rdfa-player` root to capture. */
  el: HTMLElement;
  /** CSS-pixel box the element is laid out in. */
  layoutWidth: number;
  layoutHeight: number;
  /** Pixel box of the produced frames. */
  outWidth: number;
  outHeight: number;
  /** Player stylesheet, already collected. */
  css: string;
  /** Painted under every frame, so no format ever gets a transparent hole. */
  background: string;
}

export interface Rasterizer {
  /** The canvas frames are drawn on. Reused across the whole export. */
  readonly canvas: HTMLCanvasElement;
  /** Draws the element's CURRENT state, with animations phased to `tMs`. */
  drawFrame(tMs: number): Promise<void>;
}

/**
 * Escapes the two characters that would break out of the SVG's markup.
 *
 * The stylesheet is inlined as element TEXT, not as a CDATA section: a
 * `content: "]]>"` would terminate a CDATA block, whereas entity-escaping is
 * decoded by the XML parser before the CSS parser ever sees it and so is safe
 * for any rule.
 */
function escapeCssForXml(css: string): string {
  return css.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function createRasterizer(options: RasterizerOptions): Rasterizer {
  const {
    el,
    layoutWidth,
    layoutHeight,
    outWidth,
    outHeight,
    css,
    background,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  // `alpha: false` because every frame is painted over an opaque background
  // anyway; it also spares the compositor a needless blend per frame.
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx)
    throw new Error('[dataflow-animator] 2D canvas context unavailable');

  const serializer = new XMLSerializer();
  // Uniform scale, so a mismatched aspect letterboxes rather than distorts.
  const scale = Math.min(outWidth / layoutWidth, outHeight / layoutHeight);
  // Centre what the scale leaves over.
  //
  // Rounded, because the exact arithmetic does not come out exact: a 960→1000
  // fit leaves `offsetX` at -5.68e-14 rather than 0, and interpolating that
  // into the transform writes SCIENTIFIC NOTATION into a CSS value. Three
  // decimals is far below a pixel and always writes a plain number.
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  const offsetX = round((outWidth - layoutWidth * scale) / 2);
  const offsetY = round((outHeight - layoutHeight * scale) / 2);
  const escapedCss = escapeCssForXml(css);
  // Computed once: the stylesheet cannot change while an export runs, and this
  // scans every rule of it.
  const animated = animatedSelectors(css);

  const drawFrame = async (tMs: number): Promise<void> => {
    const markup = serializer.serializeToString(el);
    const phase = escapeCssForXml(animationPhaseCss(tMs, animated));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${layoutWidth}px;height:${layoutHeight}px;` +
      `transform:translate(${offsetX}px,${offsetY}px) scale(${scale});transform-origin:0 0">` +
      `<style>${escapedCss}${phase}</style>${markup}</div>` +
      `</foreignObject></svg>`;

    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            '[dataflow-animator] a frame failed to rasterise. This usually means the scene references an image or font from another origin, which an exported frame cannot load.'
          )
        );
    });

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.drawImage(image, 0, 0);
  };

  return { canvas, drawFrame };
}
