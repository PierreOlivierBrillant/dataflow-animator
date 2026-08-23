import { beforeEach, describe, expect, it } from 'vitest';
import {
  estimateExportBytes,
  estimateExportMs,
  formatEstimate,
  formatSize,
  recordExportRate,
  recordExportSize,
  resetExportCalibration,
} from './estimate';

/**
 * The estimate exists to make the settings meaningful: someone should be able
 * to see that 1080p60 GIF is a different proposition from 540p20 BEFORE
 * committing to it. So what is asserted here is mostly ORDERING and shape —
 * the absolute milliseconds belong to whichever machine is running.
 */

const LABELS = { seconds: '{n} s', minutes: '{m} min {s} s' };

beforeEach(resetExportCalibration);

describe('estimateExportMs', () => {
  it('scales with the frame count', () => {
    const few = estimateExportMs({
      format: 'webm',
      width: 1280,
      height: 720,
      frames: 100,
    });
    const many = estimateExportMs({
      format: 'webm',
      width: 1280,
      height: 720,
      frames: 400,
    });
    expect(many).toBeGreaterThan(few * 3);
  });

  it('barely moves with resolution for video', () => {
    // Measured: 6–8.5 ms per frame from 0.23 to 2.07 megapixels. The work is
    // rasterising the DOM plus a hardware encoder, neither of which cares much.
    const small = estimateExportMs({
      format: 'mp4',
      width: 640,
      height: 360,
      frames: 300,
    });
    const large = estimateExportMs({
      format: 'mp4',
      width: 1920,
      height: 1080,
      frames: 300,
    });
    expect(large).toBeLessThan(small * 1.3);
  });

  it('climbs steeply with resolution for GIF', () => {
    // Measured: 10.8 → 44.9 ms per frame over the same range, because
    // quantisation and LZW run in JavaScript, per pixel.
    const small = estimateExportMs({
      format: 'gif',
      width: 640,
      height: 360,
      frames: 300,
    });
    const large = estimateExportMs({
      format: 'gif',
      width: 1920,
      height: 1080,
      frames: 300,
    });
    expect(large).toBeGreaterThan(small * 2.5);
  });

  it('prices GIF above video at the same settings', () => {
    const shape = { width: 1280, height: 720, frames: 300 } as const;
    expect(estimateExportMs({ format: 'gif', ...shape })).toBeGreaterThan(
      estimateExportMs({ format: 'webm', ...shape })
    );
  });
});

describe('calibration', () => {
  const input = {
    format: 'webm',
    width: 1280,
    height: 720,
    frames: 300,
  } as const;

  it('pulls later estimates toward what was actually observed', () => {
    const before = estimateExportMs(input);
    // This machine turned out to be twice as slow as the model assumed.
    recordExportRate(input, before * 2);
    const after = estimateExportMs(input);

    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(before * 2);
  });

  it('carries over to a different size of the same format', () => {
    recordExportRate(input, estimateExportMs(input) * 2);
    const other = { ...input, frames: 900 };

    // The correction is a ratio, not a rate, so it survives a change of shape.
    expect(estimateExportMs(other)).toBeGreaterThan(
      estimateExportMs({ ...other, format: 'mp4' })
    );
  });

  it('does not let one format teach another', () => {
    const gif = { ...input, format: 'gif' } as const;
    const gifBefore = estimateExportMs(gif);
    recordExportRate(input, estimateExportMs(input) * 3);

    expect(estimateExportMs(gif)).toBe(gifBefore);
  });

  it('ignores a nonsensical observation', () => {
    const before = estimateExportMs(input);
    recordExportRate(input, 0);
    recordExportRate(input, -5);
    expect(estimateExportMs(input)).toBe(before);
  });

  it('clamps a wild observation instead of trusting it', () => {
    // An export that ran while the tab was backgrounded is a measurement
    // artefact, not a machine a thousand times slower.
    const before = estimateExportMs(input);
    recordExportRate(input, before * 1000);
    expect(estimateExportMs(input)).toBeLessThan(before * 11);
  });
});

describe('formatEstimate', () => {
  it('rounds up to the second below ten', () => {
    expect(formatEstimate(3200, LABELS)).toBe('4 s');
    expect(formatEstimate(1, LABELS)).toBe('1 s');
  });

  it('rounds to five seconds between ten and sixty', () => {
    // Claiming `37 s` would imply a precision the model does not have.
    expect(formatEstimate(37_000, LABELS)).toBe('40 s');
  });

  it('switches to minutes past one', () => {
    expect(formatEstimate(100_000, LABELS)).toBe('1 min 40 s');
  });

  it('carries instead of writing "1 min 60 s"', () => {
    expect(formatEstimate(119_000, LABELS)).toBe('2 min 0 s');
  });
});

describe('estimateExportBytes', () => {
  it('scales with the frame count', () => {
    const shape = { format: 'webm', width: 1280, height: 720 } as const;
    expect(estimateExportBytes({ ...shape, frames: 600 })).toBeGreaterThan(
      estimateExportBytes({ ...shape, frames: 300 }) * 1.8
    );
  });

  it('puts GIF well above video at the same settings', () => {
    // Measured: 2.7 MB of GIF against 0.8 MB of WebM for the same 10.7s scene.
    const shape = { width: 960, height: 540, frames: 214 } as const;
    expect(estimateExportBytes({ format: 'gif', ...shape })).toBeGreaterThan(
      estimateExportBytes({ format: 'webm', ...shape }) * 2
    );
  });

  it('lands in the right order of magnitude for a measured export', () => {
    // The real thing: 960×540, 20 fps, 10.7s of clientServer → 2.74 MB.
    const bytes = estimateExportBytes({
      format: 'gif',
      width: 960,
      height: 540,
      frames: 214,
    });
    const megabytes = bytes / 1_048_576;
    expect(megabytes).toBeGreaterThan(1.5);
    expect(megabytes).toBeLessThan(4.5);
  });

  it('learns the real size and applies it to a later estimate', () => {
    const shape = {
      format: 'mp4',
      width: 1280,
      height: 720,
      frames: 300,
    } as const;
    const before = estimateExportBytes(shape);
    recordExportSize(shape, before * 3);

    expect(estimateExportBytes(shape)).toBeGreaterThan(before);
  });

  it('keeps size and duration calibration apart', () => {
    const shape = {
      format: 'mp4',
      width: 1280,
      height: 720,
      frames: 300,
    } as const;
    const bytesBefore = estimateExportBytes(shape);
    // A slow machine says nothing about how large its files are.
    recordExportRate(shape, estimateExportMs(shape) * 5);

    expect(estimateExportBytes(shape)).toBe(bytesBefore);
  });
});

describe('formatSize', () => {
  const LABELS_SIZE = { kilobytes: '{n} kB', megabytes: '{n} MB' };

  it('reads in kilobytes below a megabyte', () => {
    expect(formatSize(800 * 1024, LABELS_SIZE)).toBe('800 kB');
  });

  it('keeps one decimal in the single-megabyte range', () => {
    expect(formatSize(2.74 * 1_048_576, LABELS_SIZE)).toBe('2.7 MB');
  });

  it('drops the decimal once it is large', () => {
    expect(formatSize(23.4 * 1_048_576, LABELS_SIZE)).toBe('23 MB');
  });

  it('never claims a file weighs nothing', () => {
    expect(formatSize(1, LABELS_SIZE)).toBe('10 kB');
  });
});
