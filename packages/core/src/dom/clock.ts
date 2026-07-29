import { clamp } from '../engine/timeline';

/**
 * Framework-free playback clock — the port of
 * `packages/react/src/hooks/useClock.ts`.
 *
 * Time `t` (ms) is the ONLY source of truth of the animation: everything else
 * (`evaluate`) flows from it. `seek` sets `t`, playback only advances it.
 *
 * The React hook keeps `t` twice — as state (for rendering) and in a ref (for
 * the rAF loop, to avoid a stale closure). Here a single mutable value plus an
 * explicit subscription serves both roles.
 *
 * SSR-safe: `requestAnimationFrame` is only reached when the loop actually
 * starts, never at module evaluation.
 */

// Tab sent to background → rAF frozen → dt can be several minutes on return.
// Without a ceiling, t would jump to the end (or to an arbitrary position in
// loop mode).
const MAX_DT = 100; // ms

export interface PlayerClockOptions {
  durationMs: number;
  speed?: number;
  loop?: boolean;
  autoPlay?: boolean;
}

export interface PlayerClock {
  readonly t: number;
  readonly playing: boolean;
  readonly durationMs: number;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(ms: number): void;
  /** Plays then stops automatically at `targetMs` (step navigation). */
  playTo(targetMs: number): void;
  /** Restarts from the beginning and resumes playback. */
  restart(): void;
  /** Re-clamps the cursor when the duration changes (spec recompilation). */
  setDuration(ms: number): void;
  /** Notified after every change to `t` or `playing`. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Cancels any pending frame and drops every listener. */
  destroy(): void;
}

export function createPlayerClock(options: PlayerClockOptions): PlayerClock {
  const { speed = 1, loop = false, autoPlay = false } = options;

  let durationMs = options.durationMs;
  let t = 0;
  let playing = autoPlay;
  let target: number | null = null;

  let raf = 0;
  let running = false;
  let last = 0;

  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of [...listeners]) listener();
  };

  const tick = (now: number): void => {
    // `last` takes the RAW `now`, not the clamped delta: a long freeze is
    // absorbed (that time is genuinely lost), not replayed in slices.
    const dt = Math.min(now - last, MAX_DT);
    last = now;
    let next = t + dt * speed;
    let stop = false;

    // The target is checked FIRST and sets `stop`, so an armed `playTo` beats
    // looping for that frame.
    if (target != null && next >= target) {
      next = target;
      target = null;
      stop = true;
    }
    if (next >= durationMs) {
      // `durationMs > 0` guards the modulo: `% 0` is NaN. Wrapping is a modulo,
      // not a reset, so the overshoot remainder is preserved.
      if (loop && !stop && durationMs > 0) {
        next %= durationMs;
      } else {
        next = durationMs;
        stop = true;
      }
    }

    t = next;
    if (stop) {
      playing = false;
      running = false;
    } else {
      raf = requestAnimationFrame(tick);
    }
    // One notification per frame, matching React's single batched re-render for
    // the `setT` + `setPlaying` pair.
    emit();
  };

  const startLoop = (): void => {
    if (running) return;
    if (typeof requestAnimationFrame === 'undefined') return; // SSR
    running = true;
    // Captured at loop START, exactly like the React effect — so the first `dt`
    // spans the gap between starting playback and the first frame.
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const stopLoop = (): void => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  };

  const syncLoop = (): void => {
    if (playing) startLoop();
    else stopLoop();
  };

  const seek = (ms: number): void => {
    target = null;
    t = clamp(ms, 0, durationMs);
    // Deliberately does NOT touch `playing`: seeking mid-playback keeps playing.
    emit();
  };

  const play = (): void => {
    target = null;
    if (t >= durationMs) t = 0; // replays from the beginning
    playing = true;
    syncLoop();
    emit();
  };

  const pause = (): void => {
    target = null;
    playing = false;
    stopLoop();
    emit();
  };

  if (autoPlay) startLoop();

  return {
    get t() {
      return t;
    },
    get playing() {
      return playing;
    },
    get durationMs() {
      return durationMs;
    },
    play,
    pause,
    seek,
    toggle() {
      if (playing) pause();
      else play();
    },
    playTo(targetMs: number) {
      const next = clamp(targetMs, 0, durationMs);
      // A backwards target is a plain jump, not playback.
      if (next <= t) {
        seek(next);
        return;
      }
      target = next;
      playing = true;
      syncLoop();
      emit();
    },
    restart() {
      target = null;
      t = 0;
      playing = true; // unconditionally, unlike `play`
      syncLoop();
      emit();
    },
    setDuration(ms: number) {
      durationMs = ms;
      // Clamps DOWN only — never bumps `t` up, never touches `playing`.
      if (t > durationMs) t = durationMs;
      // React's effect depends on `durationMs`, so changing it tears the loop
      // down and rebuilds it, resetting `last`. Mirrored here so the frame
      // straddling a recompilation measures its delta the same way.
      if (running) {
        stopLoop();
        startLoop();
      }
      emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      stopLoop();
      listeners.clear();
    },
  };
}
