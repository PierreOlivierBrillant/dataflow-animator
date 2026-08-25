import { describe, expect, it } from 'vitest';
import { screenBox, screenScale } from './contentScreen';

describe('screenBox', () => {
  it('is undefined when the content asks for no design space', () => {
    expect(screenBox({ type: 'html', value: '<p>a</p>' })).toBeUndefined();
  });

  it('derives a 16:10 lid from a width alone', () => {
    expect(screenBox({ type: 'html', screen_width: 480 })).toEqual({
      width: 480,
      height: 300,
    });
  });

  it('takes both dimensions when both are given', () => {
    expect(
      screenBox({ type: 'html', screen_width: 390, screen_height: 844 })
    ).toEqual({ width: 390, height: 844 });
  });

  it('refuses a width that is not a usable number', () => {
    expect(screenBox({ type: 'html', screen_width: 0 })).toBeUndefined();
    expect(screenBox({ type: 'html', screen_width: -10 })).toBeUndefined();
    expect(
      screenBox({ type: 'html', screen_width: Number.NaN })
    ).toBeUndefined();
  });

  it('clamps a screen that is absurdly small or large', () => {
    expect(screenBox({ type: 'html', screen_width: 5 })?.width).toBe(40);
    expect(screenBox({ type: 'html', screen_width: 999999 })?.width).toBe(4000);
    expect(
      screenBox({ type: 'html', screen_width: 480, screen_height: 1 })?.height
    ).toBe(40);
  });
});

describe('screenScale', () => {
  const box = { width: 480, height: 300 };

  it('fits the screen inside the node`s allowance', () => {
    expect(screenScale(box, { maxW: 240, maxH: 600 })).toBe(0.5);
    expect(screenScale(box, { maxW: 960, maxH: 150 })).toBe(0.5);
  });

  it('is uniform: the tighter axis decides', () => {
    // A screen that stretched would stop being the picture the author composed.
    expect(screenScale(box, { maxW: 240, maxH: 60 })).toBe(0.2);
  });

  it('grows into a roomy node rather than stopping at 1', () => {
    expect(screenScale(box, { maxW: 960, maxH: 600 })).toBe(2);
  });

  it('falls back to 1 when there is no allowance yet', () => {
    expect(screenScale(box, undefined)).toBe(1);
    expect(screenScale(box, { maxW: 0, maxH: 0 })).toBe(1);
  });

  it('is a pure function of the box and the limit', () => {
    // Nothing measured goes in, so a screen is as scrubbable and as
    // exportable as the rest of the renderer.
    const limit = { maxW: 420, maxH: 560 };
    expect(screenScale(box, limit)).toBe(screenScale(box, limit));
  });
});
