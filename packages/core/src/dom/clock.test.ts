/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerClock } from './clock';

const TICK = 16;
const DURATION = 1000;

/**
 * Hand-driven `requestAnimationFrame`: every frame's timestamp is chosen
 * explicitly, which is what lets the MAX_DT ceiling and the `last`-capture
 * timing be asserted exactly rather than inferred from a timer.
 */
function driveFrames() {
  let now = 0;
  let pending: ((time: number) => void) | null = null;
  let nextId = 1;

  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    pending = cb;
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = null;
  });
  vi.stubGlobal('performance', { now: () => now });

  return {
    /** Advances the wall clock by `ms` and delivers the pending frame. */
    advance(ms: number): void {
      now += ms;
      const cb = pending;
      pending = null;
      cb?.(now);
    },
    /** Moves the wall clock WITHOUT delivering a frame (a backgrounded tab). */
    skip(ms: number): void {
      now += ms;
    },
    get scheduled(): boolean {
      return pending !== null;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createPlayerClock — cursor', () => {
  it('seeks to the value clamped into [0, durationMs]', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.seek(500);
    expect(clock.t).toBe(500);

    clock.seek(9999);
    expect(clock.t).toBe(DURATION);

    clock.seek(-10);
    expect(clock.t).toBe(0);
  });

  it('keeps playing when seeked mid-playback', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.play();
    frames.advance(TICK);
    clock.seek(500);

    expect(clock.playing).toBe(true);
    frames.advance(TICK);
    expect(clock.t).toBe(500 + TICK);
  });
});

describe('createPlayerClock — playback', () => {
  it('advances t proportionally to elapsed time', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.play();
    for (let i = 0; i < 6; i++) frames.advance(TICK);

    expect(clock.t).toBe(6 * TICK);
  });

  it('scales the advance by `speed`', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION, speed: 2 });

    clock.play();
    for (let i = 0; i < 6; i++) frames.advance(TICK);

    expect(clock.t).toBe(6 * TICK * 2);
  });

  it('pause() stops the advance and cancels the pending frame', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.play();
    frames.advance(TICK);
    frames.advance(TICK);
    clock.pause();

    expect(clock.playing).toBe(false);
    expect(frames.scheduled).toBe(false);
    frames.advance(6 * TICK);
    expect(clock.t).toBe(2 * TICK);
  });

  it('toggle() alternates play and pause', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.toggle();
    expect(clock.playing).toBe(true);
    clock.toggle();
    expect(clock.playing).toBe(false);
  });

  it('autoPlay starts the loop immediately', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION, autoPlay: true });

    expect(clock.playing).toBe(true);
    frames.advance(TICK);
    expect(clock.t).toBe(TICK);
  });

  it('play() at the end replays from the beginning', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.seek(DURATION);
    clock.play();

    expect(clock.t).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it('restart() rewinds and starts playing unconditionally', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.seek(500);
    clock.restart();

    expect(clock.t).toBe(0);
    expect(clock.playing).toBe(true);
  });
});

describe('createPlayerClock — end of timeline', () => {
  it('stops exactly on durationMs when not looping', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: 2 * TICK, loop: false });

    clock.play();
    for (let i = 0; i < 3; i++) frames.advance(TICK);

    expect(clock.t).toBe(2 * TICK);
    expect(clock.playing).toBe(false);
    expect(frames.scheduled).toBe(false);
  });

  it('wraps by modulo when looping, preserving the overshoot', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: 2 * TICK, loop: true });

    clock.play();
    for (let i = 0; i < 3; i++) frames.advance(TICK);

    // 48 % 32 = 16 — the remainder is kept, not reset to 0.
    expect(clock.t).toBe(TICK);
    expect(clock.playing).toBe(true);
  });

  it('never wraps a zero duration — the modulo would be NaN', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: 0, loop: true });

    clock.play();
    frames.advance(TICK);

    expect(clock.t).toBe(0);
    expect(clock.playing).toBe(false);
  });
});

describe('createPlayerClock — playTo', () => {
  it('stops on the target and clears playing', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.playTo(100);
    for (let i = 0; i < 7; i++) frames.advance(TICK);

    expect(clock.t).toBe(100);
    expect(clock.playing).toBe(false);
  });

  it('degrades to a plain seek for a backwards target', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.seek(500);
    clock.playTo(200);

    expect(clock.t).toBe(200);
    expect(clock.playing).toBe(false);
  });

  it('an armed target beats looping on the frame it lands', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: 2 * TICK, loop: true });

    // Target 24ms sits before the 32ms duration; the 2nd frame overshoots both.
    clock.playTo(24);
    frames.advance(TICK);
    frames.advance(TICK);

    expect(clock.t).toBe(24);
    expect(clock.playing).toBe(false);
  });

  it('play() and pause() disarm a pending target', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    clock.playTo(100);
    clock.play();
    for (let i = 0; i < 10; i++) frames.advance(TICK);

    // Without the disarm, playback would have stopped at 100.
    expect(clock.t).toBe(10 * TICK);
    expect(clock.playing).toBe(true);
  });
});

describe('createPlayerClock — invalid speed', () => {
  it.each([
    ['negative', -1],
    ['zero', 0],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('falls back to 1 and warns once for %s speed', (_label, speed) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION, speed });

    clock.play();
    for (let i = 0; i < 6; i++) frames.advance(TICK);

    expect(clock.t).toBe(6 * TICK);
    expect(clock.t).toBeGreaterThanOrEqual(0);
    expect(clock.t).toBeLessThanOrEqual(DURATION);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('an invalid speed still lets playTo reach and stop at its target', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION, speed: -1 });

    clock.playTo(100);
    for (let i = 0; i < 7; i++) frames.advance(TICK);

    expect(clock.t).toBe(100);
    expect(clock.playing).toBe(false);
  });
});

describe('createPlayerClock — MAX_DT ceiling', () => {
  it('caps a giant frame gap and does not replay the lost time', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION, speed: 2 });

    clock.play();
    // Tab backgrounded for a minute, then one frame lands.
    frames.advance(60_000);

    // MAX_DT (100) × speed (2), not 60000 × 2.
    expect(clock.t).toBe(200);

    // `last` took the RAW timestamp, so the NEXT frame measures 16ms — the
    // discarded minute is gone, not queued up.
    frames.advance(TICK);
    expect(clock.t).toBe(200 + TICK * 2);
  });

  it('measures the first delta from when playback started, not from frame 0', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });

    frames.skip(500); // time passes while paused
    clock.play(); // `last` is captured here
    frames.advance(TICK);

    expect(clock.t).toBe(TICK);
  });
});

describe('createPlayerClock — setDuration', () => {
  it('clamps the cursor down, never up', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: 1000 });

    clock.seek(800);
    clock.setDuration(500);
    expect(clock.t).toBe(500);

    clock.setDuration(2000);
    expect(clock.t).toBe(500);
    expect(clock.durationMs).toBe(2000);
  });

  it('does not touch playing', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: 1000 });

    clock.play();
    frames.advance(TICK);
    clock.setDuration(500);

    expect(clock.playing).toBe(true);
    frames.advance(TICK);
    expect(clock.t).toBe(2 * TICK);
  });
});

describe('createPlayerClock — subscription and teardown', () => {
  it('notifies once per frame and once per command', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });
    const seen: number[] = [];
    clock.subscribe(() => seen.push(clock.t));

    clock.play(); // 1
    frames.advance(TICK); // 2
    frames.advance(TICK); // 3

    expect(seen).toEqual([0, TICK, 2 * TICK]);
  });

  it('unsubscribes', () => {
    driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });
    const listener = vi.fn();
    const off = clock.subscribe(listener);

    clock.seek(1);
    off();
    clock.seek(2);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('destroy() cancels the pending frame and drops listeners', () => {
    const frames = driveFrames();
    const clock = createPlayerClock({ durationMs: DURATION });
    const listener = vi.fn();
    clock.subscribe(listener);

    clock.play();
    clock.destroy();

    expect(frames.scheduled).toBe(false);
    listener.mockClear();
    clock.seek(100);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createPlayerClock — SSR', () => {
  it('does not touch requestAnimationFrame when it is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);

    const clock = createPlayerClock({ durationMs: DURATION, autoPlay: true });

    // State still reflects the request; only the loop is absent.
    expect(clock.playing).toBe(true);
    expect(clock.t).toBe(0);
    expect(() => clock.pause()).not.toThrow();
  });
});
