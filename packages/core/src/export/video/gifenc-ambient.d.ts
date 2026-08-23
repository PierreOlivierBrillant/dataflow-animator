/**
 * Minimal typings for `gifenc`, which ships none of its own.
 *
 * Only the four entry points `encoders.ts` reaches for are declared. Widening
 * this is fine; guessing at the shape of what is not used here is not.
 */
declare module 'gifenc' {
  /** An RGB (or RGBA) palette entry, as `gifenc` returns it. */
  export type GifPalette = number[][];

  export interface GifWriteFrameOptions {
    palette?: GifPalette;
    /** Hundredths of a second are what the format stores; this takes ms. */
    delay?: number;
    transparent?: boolean;
    dispose?: number;
  }

  export interface GifEncoderStream {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifWriteFrameOptions
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GifEncoderStream;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean;
    }
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}
