import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OPTION_ATTRIBUTES,
  parseBoolean,
  parseDimension,
  parseNumber,
  readOptions,
  type AttributeSource,
} from './options';

// No DOM here on purpose: `readOptions` only needs something that answers
// `getAttribute`, which is what keeps this file runnable in the `node`
// environment and the parsing rules testable without mounting anything.
const source = (attrs: Record<string, string>): AttributeSource => ({
  getAttribute: (name) => (name in attrs ? attrs[name] : null),
});

afterEach(() => vi.restoreAllMocks());

describe('parseBoolean', () => {
  it('reads every truthy spelling, the HTML idioms included', () => {
    for (const raw of ['', 'controls', 'true', 'TRUE', '1', ' true '])
      expect(parseBoolean('controls', raw)).toBe(true);
  });

  it('reads the explicit falsy spellings', () => {
    for (const raw of ['false', 'FALSE', '0', ' false '])
      expect(parseBoolean('controls', raw)).toBe(false);
  });

  it('returns undefined for an absent attribute, NOT false', () => {
    // The whole point: the core defaults `controls` to true, so an absent
    // attribute must mean "unspecified", never "off".
    expect(parseBoolean('controls', null)).toBeUndefined();
  });

  it('warns and falls back for anything else', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseBoolean('controls', 'yes')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('controls="yes"')
    );
  });
});

describe('parseNumber', () => {
  it('reads finite numbers, negatives and zero included', () => {
    expect(parseNumber('speed', '2')).toBe(2);
    expect(parseNumber('speed', '0')).toBe(0);
    expect(parseNumber('speed', '0.5')).toBe(0.5);
    expect(parseNumber('initial-t', '-10')).toBe(-10);
  });

  it('returns undefined for an absent attribute', () => {
    expect(parseNumber('speed', null)).toBeUndefined();
  });

  it('warns on a blank attribute instead of reading it as 0', () => {
    // `Number('')` and `Number('  ')` are both 0 — a blank attribute is a
    // mistake, not a value.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseNumber('speed', '   ')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns on a non-number', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseNumber('speed', 'fast')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('speed="fast"'));
  });
});

describe('parseDimension', () => {
  it('turns a bare number into a number (pixels for the core)', () => {
    expect(parseDimension('420')).toBe(420);
  });

  it('keeps a CSS length as a string', () => {
    expect(parseDimension('60vh')).toBe('60vh');
    expect(parseDimension('100%')).toBe('100%');
  });

  it('returns undefined for absent or blank', () => {
    expect(parseDimension(null)).toBeUndefined();
    expect(parseDimension('  ')).toBeUndefined();
  });
});

describe('readOptions', () => {
  it('writes NO key for an attribute that is absent', () => {
    // The invariant the whole mapping rests on: an empty element yields an empty
    // options object, so every default comes from the core and none is
    // duplicated here.
    expect(readOptions(source({}))).toEqual({});
  });

  it('maps every attribute of the public table', () => {
    expect(
      readOptions(
        source({
          theme: 'blueprint',
          mode: 'dark',
          density: 'compact',
          height: '320',
          width: '60vw',
          'player-class': 'mine',
          speed: '1.5',
          'initial-t': '1200',
          controls: 'false',
          exportable: '',
          'auto-play': 'true',
          loop: '1',
          debug: 'true',
          transcript: 'visible',
        })
      )
    ).toEqual({
      theme: 'blueprint',
      mode: 'dark',
      density: 'compact',
      height: 320,
      width: '60vw',
      className: 'mine',
      speed: 1.5,
      initialT: 1200,
      controls: false,
      exportable: true,
      autoPlay: true,
      loop: true,
      debug: true,
      transcript: 'visible',
    });
  });

  it('validates transcript, because a typo would silence the animation', () => {
    // Unlike theme/mode, this is a behaviour switch: falling through to the
    // core's default is right, landing on 'none' would not be.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readOptions(source({ transcript: 'nope' }))).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('transcript="nope"')
    );
  });

  it('validates density, because the core uses it as a record key', () => {
    // `DENSITY[density]` in engine/scale.ts — an unknown value is a TypeError
    // there, not a cosmetic problem, so this is the one enum worth a list.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readOptions(source({ density: 'airy' }))).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('density="airy"')
    );
  });

  it('passes theme and mode through unvalidated', () => {
    // They only become `data-theme`/`data-mode` hooks for the stylesheet, so an
    // unknown value renders with the default variables instead of crashing —
    // which is why the core's palette list is not duplicated here.
    expect(readOptions(source({ theme: 'nope', mode: 'nope' }))).toEqual({
      theme: 'nope',
      mode: 'nope',
    });
  });

  it('lists exactly the option attributes the element observes', () => {
    // A guard against adding an option to `readOptions` and forgetting to
    // observe it: an unobserved attribute would work on the first mount and
    // never again.
    expect([...OPTION_ATTRIBUTES]).toEqual([
      'theme',
      'mode',
      'density',
      'height',
      'width',
      'player-class',
      'speed',
      'initial-t',
      'controls',
      'exportable',
      'auto-play',
      'loop',
      'debug',
      'transcript',
    ]);
  });
});
