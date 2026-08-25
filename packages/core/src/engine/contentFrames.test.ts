import { describe, expect, it } from 'vitest';
import {
  contentCycleMs,
  contentFps,
  contentFrameIndex,
  contentFrameSrc,
  DEFAULT_CONTENT_FPS,
} from './contentFrames';
import type { ObjectContent } from '../types';

const frames = ['a', 'b', 'c', 'd'];
const sequence: ObjectContent = { type: 'image', frames, fps: 10 };

describe('contentFps', () => {
  it('defaults when the content says nothing', () => {
    expect(contentFps({})).toBe(DEFAULT_CONTENT_FPS);
  });

  it('clamps a rate that would divide by nothing or by everything', () => {
    expect(contentFps({ fps: 0 })).toBe(0.1);
    expect(contentFps({ fps: -5 })).toBe(0.1);
    expect(contentFps({ fps: 1e6 })).toBe(60);
    expect(contentFps({ fps: Number.NaN })).toBe(DEFAULT_CONTENT_FPS);
  });
});

describe('contentCycleMs', () => {
  it('is the time one pass through the sequence takes', () => {
    expect(contentCycleMs(sequence)).toBe(400);
  });

  it('is undefined without a sequence, so the caller keeps its flat beat', () => {
    expect(
      contentCycleMs({ type: 'image', value: 'still.png' })
    ).toBeUndefined();
    expect(contentCycleMs({ type: 'image', frames: [] })).toBeUndefined();
  });
});

describe('contentFrameIndex', () => {
  it('advances one frame per 1/fps', () => {
    expect(contentFrameIndex(sequence, 0)).toBe(0);
    expect(contentFrameIndex(sequence, 99)).toBe(0);
    expect(contentFrameIndex(sequence, 100)).toBe(1);
    expect(contentFrameIndex(sequence, 250)).toBe(2);
  });

  it('wraps by default', () => {
    expect(contentFrameIndex(sequence, 400)).toBe(0);
    expect(contentFrameIndex(sequence, 1_000_000)).toBe(0);
  });

  it('holds the last frame when the sequence does not loop', () => {
    const once = { ...sequence, loop: false };
    expect(contentFrameIndex(once, 300)).toBe(3);
    expect(contentFrameIndex(once, 5000)).toBe(3);
  });

  it('is a pure function of the instant, so scrubbing backwards rewinds', () => {
    // The whole reason a sequence is not a GIF: asking twice for the same
    // instant, in any order, gives the same frame.
    const forwards = [0, 100, 200, 300].map((t) =>
      contentFrameIndex(sequence, t)
    );
    const backwards = [300, 200, 100, 0]
      .map((t) => contentFrameIndex(sequence, t))
      .reverse();
    expect(backwards).toEqual(forwards);
  });

  it('clamps a negative elapsed time to the first frame', () => {
    // A `set_content` is resolved a hair before its own start during a fade.
    expect(contentFrameIndex(sequence, -50)).toBe(0);
  });

  it('is undefined without a sequence', () => {
    expect(
      contentFrameIndex({ type: 'image', value: 'x' }, 500)
    ).toBeUndefined();
    expect(
      contentFrameIndex({ type: 'image', frames: [] }, 500)
    ).toBeUndefined();
  });
});

describe('contentFrameSrc', () => {
  it('reads the frame at the index', () => {
    expect(contentFrameSrc(sequence, 2)).toBe('c');
  });

  it('falls back to the still in both directions', () => {
    expect(contentFrameSrc({ type: 'image', value: 'still' }, undefined)).toBe(
      'still'
    );
    expect(contentFrameSrc({ type: 'image', value: 'still', frames }, 99)).toBe(
      'still'
    );
  });

  it('is undefined when the content carries no image at all', () => {
    expect(contentFrameSrc({ type: 'image' }, undefined)).toBeUndefined();
  });
});
