import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult {
  diffPixels: number;
  totalPixels: number;
  /** `diffPixels / totalPixels`, in [0, 1]. */
  ratio: number;
}

/**
 * Pixel-diffs two same-size PNG screenshots (as returned by Playwright's
 * `locator.screenshot()`). Shared by the A/B compare grid and its self-test
 * calibration — see docs/AI-VALIDATION.md.
 */
export function diffPngBuffers(a: Buffer, b: Buffer): DiffResult {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
    throw new Error(
      `panel size mismatch: A is ${imgA.width}x${imgA.height}, B is ${imgB.width}x${imgB.height}`
    );
  }
  const { width, height } = imgA;
  const diffPixels = pixelmatch(imgA.data, imgB.data, null, width, height, {
    threshold: 0.1,
  });
  const totalPixels = width * height;
  return { diffPixels, totalPixels, ratio: diffPixels / totalPixels };
}
