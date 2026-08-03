import { describe, expect, it } from 'vitest';
import { toPlayerOptions } from './options';

/**
 * No TestBed, no zone, no DOM here — `toPlayerOptions` is a pure function, and
 * that is why it is a separate module. What is being defended is one rule: an
 * unbound input writes NO key, so the core's default survives.
 */
describe('toPlayerOptions', () => {
  it('writes no key at all when nothing is bound', () => {
    expect(toPlayerOptions({})).toEqual({});
  });

  it('omits `controls` when unbound rather than defaulting it to false', () => {
    // THE reason the rule exists: the core defaults `controls` to true, so an
    // absent input that wrote `false` would silently strip the control bar off
    // every player that never mentions it.
    expect('controls' in toPlayerOptions({})).toBe(false);
  });

  it('keeps an explicit `false`, which is not the same as absence', () => {
    expect(toPlayerOptions({ controls: false })).toEqual({ controls: false });
  });

  it('keeps a falsy-but-meaningful zero', () => {
    expect(toPlayerOptions({ initialT: 0, speed: 0 })).toEqual({
      initialT: 0,
      speed: 0,
    });
  });

  it('renames `playerClass` to the core’s `className`', () => {
    expect(toPlayerOptions({ playerClass: 'mine' })).toEqual({
      className: 'mine',
    });
  });

  it('maps every input through to its option', () => {
    const highlight = (code: string, language: string): string =>
      `${language}:${code}`;
    const labels = { play: 'Lecture' };
    expect(
      toPlayerOptions({
        theme: 'blueprint',
        mode: 'dark',
        density: 'compact',
        height: '60vh',
        width: 800,
        playerClass: 'mine',
        speed: 2,
        initialT: 1200,
        controls: false,
        exportable: true,
        autoPlay: true,
        loop: true,
        debug: true,
        highlight,
        labels,
      })
    ).toEqual({
      theme: 'blueprint',
      mode: 'dark',
      density: 'compact',
      height: '60vh',
      width: 800,
      className: 'mine',
      speed: 2,
      initialT: 1200,
      controls: false,
      exportable: true,
      autoPlay: true,
      loop: true,
      debug: true,
      highlight,
      labels,
    });
  });
});
