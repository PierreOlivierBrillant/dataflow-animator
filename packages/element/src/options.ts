import type { Density, PlayerOptions } from '@dataflow-animator/core';

/**
 * Attributes → `PlayerOptions`, and the rules that make that mapping honest.
 *
 * Kept apart from the element so it can be tested without a DOM at all: the only
 * thing it needs is something that answers `getAttribute`.
 *
 * ONE naming rule: a camelCase option of the core becomes a kebab-case attribute
 * (`autoPlay` → `auto-play`, `initialT` → `initial-t`). HTML lowercases attribute
 * names anyway, so a camelCase attribute would be a lie; hyphenating everything
 * keeps the rule mechanical instead of a list to memorise.
 *
 * ONE exception, and it is forced: the core's `className` option is spelled
 * `player-class` here. The mechanical rule would give `class-name` ↔ `className`,
 * and `className` on an element already means the element's own class list —
 * claiming it would break `el.className` for every consumer.
 *
 * THE rule that governs everything below: an absent attribute writes NO key into
 * the returned object, so the core's own default applies. That is not a detail —
 * `controls` defaults to `true` in the core, so the usual HTML boolean convention
 * ("absent means false") would silently strip the control bar off every player
 * that never mentions it. Absence means "unspecified" here, never "false".
 */

/** Log prefix. Constant, like the event names: renaming the tag must not move it. */
const LOG = '[dataflow-player]';

/**
 * The one closed enum that is validated, and the reason it is the only one.
 *
 * `density` is used as a RECORD KEY by the core (`DENSITY[density]` in
 * `engine/scale.ts`), so an unknown value is a TypeError, not a cosmetic
 * problem. `theme` and `mode` are the opposite: they only ever land in a
 * `data-theme`/`data-mode` attribute for the stylesheet to hook onto, so an
 * unknown value matches no rule and the player renders with the default
 * variables. Passing those through keeps the core's palette list from being
 * duplicated here — a list that would have to be manually resynced on every new
 * theme, for no gain.
 */
const DENSITIES = [
  'compact',
  'comfortable',
  'spacious',
] as const satisfies readonly Density[];

export interface AttributeSource {
  getAttribute(name: string): string | null;
}

/**
 * Every attribute the element reflects, i.e. its `observedAttributes`.
 *
 * `spec` is deliberately absent: the element observes it too, but it is handled
 * on its own path (parsed into a spec, not into an option).
 */
export const OPTION_ATTRIBUTES = [
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
] as const;

/**
 * `true` for a bare attribute, its own name, `"true"` or `"1"`; `false` for
 * `"false"` or `"0"`; `undefined` (with a warning) for anything else.
 *
 * The bare and repeated-name forms are the HTML idioms (`controls`,
 * `controls="controls"`); the explicit `"false"` is what this element NEEDS, and
 * the README says so in bold, because removing the attribute cannot mean `false`
 * when the core's default is `true`.
 */
export function parseBoolean(
  name: string,
  raw: string | null
): boolean | undefined {
  if (raw === null) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === '' || value === name || value === 'true' || value === '1')
    return true;
  if (value === 'false' || value === '0') return false;
  console.warn(
    `${LOG} ignoring \`${name}="${raw}"\`: expected true/false (or the bare attribute). Falling back to the default.`
  );
  return undefined;
}

/** A finite number, or `undefined` (with a warning) for anything else. */
export function parseNumber(
  name: string,
  raw: string | null
): number | undefined {
  if (raw === null) return undefined;
  // `Number('')` and `Number('  ')` are both 0, which would turn a blank
  // attribute into a real value instead of a mistake.
  if (raw.trim() === '') {
    console.warn(`${LOG} ignoring empty \`${name}\`: expected a number.`);
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.warn(
      `${LOG} ignoring \`${name}="${raw}"\`: expected a number. Falling back to the default.`
    );
    return undefined;
  }
  return value;
}

/**
 * A CSS length: `"420"` becomes the number 420, `"60vh"` stays a string.
 *
 * The core accepts both and takes a number as pixels, so this only has to decide
 * which of the two an attribute meant — and every attribute is a string.
 */
export function parseDimension(
  raw: string | null
): number | string | undefined {
  if (raw === null) return undefined;
  if (raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : raw;
}

function parseDensity(raw: string | null): Density | undefined {
  if (raw === null) return undefined;
  const value = raw.trim();
  if ((DENSITIES as readonly string[]).includes(value)) return value as Density;
  console.warn(
    `${LOG} ignoring \`density="${raw}"\`: expected one of ${DENSITIES.join(', ')}. Falling back to the default.`
  );
  return undefined;
}

/**
 * Reads the attributes into the options `mountPlayer` takes.
 *
 * Every branch is `if (x !== undefined)` rather than a default written here: a
 * default duplicated in a wrapper is a default that drifts from the core's, and
 * the core already documents its own.
 */
export function readOptions(source: AttributeSource): PlayerOptions {
  const options: PlayerOptions = {};
  const attr = (name: string): string | null => source.getAttribute(name);

  // Opaque CSS hooks — see the DENSITIES comment for why these are not
  // validated. The cast is the price of that decision: the attribute is
  // untrusted text, and the core only forwards it to `data-theme`/`data-mode`.
  const theme = attr('theme');
  if (theme !== null) options.theme = theme as PlayerOptions['theme'];
  const mode = attr('mode');
  if (mode !== null) options.mode = mode as PlayerOptions['mode'];

  const density = parseDensity(attr('density'));
  if (density !== undefined) options.density = density;

  const height = parseDimension(attr('height'));
  if (height !== undefined) options.height = height;
  const width = parseDimension(attr('width'));
  if (width !== undefined) options.width = width;

  const className = attr('player-class');
  if (className !== null) options.className = className;

  const speed = parseNumber('speed', attr('speed'));
  if (speed !== undefined) options.speed = speed;
  const initialT = parseNumber('initial-t', attr('initial-t'));
  if (initialT !== undefined) options.initialT = initialT;

  const controls = parseBoolean('controls', attr('controls'));
  if (controls !== undefined) options.controls = controls;
  const exportable = parseBoolean('exportable', attr('exportable'));
  if (exportable !== undefined) options.exportable = exportable;
  const autoPlay = parseBoolean('auto-play', attr('auto-play'));
  if (autoPlay !== undefined) options.autoPlay = autoPlay;
  const loop = parseBoolean('loop', attr('loop'));
  if (loop !== undefined) options.loop = loop;
  const debug = parseBoolean('debug', attr('debug'));
  if (debug !== undefined) options.debug = debug;

  return options;
}
