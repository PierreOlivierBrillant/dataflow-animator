import { describe, expect, it } from 'vitest';
import { clipOpacity, contentCrossfade, FADE_MS } from './clipOpacity';
import { APPEAR_HOLD } from '../engine/compiler';

// Minimal clip visible for a very long time (no exit constraint).
const farEnd = 99_999;

describe('clipOpacity — fade-in with hold (inDur > 0)', () => {
  const clip = { startMs: 0, animStartMs: APPEAR_HOLD, visibleUntilMs: farEnd };

  it('opacity 0 at the first instant', () => {
    expect(clipOpacity(clip, 0)).toBe(0);
  });

  it('opacity ~0.5 mid-hold', () => {
    expect(clipOpacity(clip, APPEAR_HOLD / 2)).toBeCloseTo(0.5);
  });

  it('opacity 1 at the end of the hold', () => {
    expect(clipOpacity(clip, APPEAR_HOLD)).toBe(1);
  });

  it('stays at 1 long after the hold', () => {
    expect(clipOpacity(clip, APPEAR_HOLD + 1000)).toBe(1);
  });
});

describe('clipOpacity — fade-in without hold (inDur = 0, over FADE_MS)', () => {
  const clip = { startMs: 0, animStartMs: 0, visibleUntilMs: farEnd };

  it('opacity 0 at t=0', () => {
    expect(clipOpacity(clip, 0)).toBe(0);
  });

  it('opacity ~0.5 at t=FADE_MS/2', () => {
    expect(clipOpacity(clip, FADE_MS / 2)).toBeCloseTo(0.5);
  });

  it('opacity 1 at t=FADE_MS', () => {
    expect(clipOpacity(clip, FADE_MS)).toBe(1);
  });
});

describe('clipOpacity — fade-out over FADE_MS', () => {
  const clip = { startMs: 0, animStartMs: 0, visibleUntilMs: 1000 };

  it('opacity 1 before the fade-out starts', () => {
    // outStart = 1000 - FADE_MS; checking an instant slightly before
    expect(clipOpacity(clip, 1000 - FADE_MS - 1)).toBe(1);
  });

  it('opacity ~0.5 mid-fade-out', () => {
    expect(clipOpacity(clip, 1000 - FADE_MS / 2)).toBeCloseTo(0.5);
  });

  it('opacity 0 at visibleUntilMs', () => {
    expect(clipOpacity(clip, 1000)).toBe(0);
  });
});

describe('clipOpacity — keepEnd suppresses the fade-out', () => {
  const clip = {
    startMs: 0,
    animStartMs: 0,
    visibleUntilMs: 1000,
    keepEnd: true,
  };

  it('opacity 1 at the theoretical fade-out midpoint', () => {
    expect(clipOpacity(clip, 1000 - FADE_MS / 2)).toBe(1);
  });

  it('opacity 1 at visibleUntilMs exactly', () => {
    expect(clipOpacity(clip, 1000)).toBe(1);
  });

  it('opacity 1 past visibleUntilMs', () => {
    expect(clipOpacity(clip, 1500)).toBe(1);
  });
});

describe('clipOpacity — custom fadeInMs', () => {
  it('fade_in_ms: 100 overrides FADE_MS for the fade-in', () => {
    const clip = {
      startMs: 0,
      animStartMs: 0,
      visibleUntilMs: 99_999,
      fadeInMs: 100,
    };
    expect(clipOpacity(clip, 0)).toBe(0);
    expect(clipOpacity(clip, 50)).toBeCloseTo(0.5);
    expect(clipOpacity(clip, 100)).toBe(1);
    expect(clipOpacity(clip, 200)).toBe(1);
  });

  it('fade_in_ms: 0 = instant appearance', () => {
    const clip = {
      startMs: 0,
      animStartMs: 0,
      visibleUntilMs: 99_999,
      fadeInMs: 0,
    };
    expect(clipOpacity(clip, 0)).toBe(1);
    expect(clipOpacity(clip, 500)).toBe(1);
  });

  it('fade_in_ms also overrides the starting hold (move)', () => {
    // For a move, inDur = APPEAR_HOLD = 300; fadeInMs = 100 takes precedence.
    const clip = {
      startMs: 0,
      animStartMs: APPEAR_HOLD,
      visibleUntilMs: 99_999,
      fadeInMs: 100,
    };
    expect(clipOpacity(clip, 0)).toBe(0);
    expect(clipOpacity(clip, 50)).toBeCloseTo(0.5);
    expect(clipOpacity(clip, 100)).toBe(1);
  });
});

describe('contentCrossfade — eased set_content fade (easeInOutCubic)', () => {
  // inDur = 0 → fade in over FADE_MS.
  const clip = { startMs: 0, animStartMs: 0, visibleUntilMs: farEnd };

  it('shares the fixed points of clipOpacity (0, 0.5, 1)', () => {
    expect(contentCrossfade(clip, 0)).toBe(0);
    expect(contentCrossfade(clip, FADE_MS / 2)).toBeCloseTo(0.5);
    expect(contentCrossfade(clip, FADE_MS)).toBe(1);
  });

  it('starts slower than linear (eased start)', () => {
    // At quarter fade, linear is 0.25; eased stays under 0.25.
    const linear = clipOpacity(clip, FADE_MS / 4);
    const eased = contentCrossfade(clip, FADE_MS / 4);
    expect(linear).toBeCloseTo(0.25);
    expect(eased).toBeLessThan(linear);
  });

  it('finishes slower than linear (eased end)', () => {
    // At three quarters, eased overtakes linear (it accelerates in the middle).
    const linear = clipOpacity(clip, (FADE_MS * 3) / 4);
    const eased = contentCrossfade(clip, (FADE_MS * 3) / 4);
    expect(eased).toBeGreaterThan(linear);
  });
});

describe('clipOpacity — custom fadeOutMs', () => {
  it('fade_out_ms: 100 overrides FADE_MS for the fade-out', () => {
    const clip = {
      startMs: 0,
      animStartMs: 0,
      visibleUntilMs: 1000,
      fadeOutMs: 100,
    };
    expect(clipOpacity(clip, 899)).toBe(1);
    expect(clipOpacity(clip, 950)).toBeCloseTo(0.5);
    expect(clipOpacity(clip, 1000)).toBe(0);
  });

  it('fade_out_ms: 0 = instant disappearance (opacity 1 until the end)', () => {
    const clip = {
      startMs: 0,
      animStartMs: 0,
      visibleUntilMs: 1000,
      fadeOutMs: 0,
    };
    expect(clipOpacity(clip, 999)).toBe(1);
    expect(clipOpacity(clip, 1000)).toBe(1);
  });
});
