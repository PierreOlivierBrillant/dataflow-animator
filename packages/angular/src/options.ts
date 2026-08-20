import type {
  Density,
  Highlighter,
  PlayerLabels,
  PlayerMode,
  PlayerOptions,
  PlayerTheme,
} from '@dataflow-animator/core';

/**
 * The component's inputs → the core's `PlayerOptions`, and the one rule that
 * makes that mapping honest.
 *
 * Kept apart from the component so it can be tested with no TestBed, no zone and
 * no DOM: it is a pure function over a plain object.
 *
 * THE rule: an input that was never bound writes **no key** into the returned
 * object, so the core's own default applies. That is not a nicety — the core
 * defaults `controls` to `true`, so anything that turned "not bound" into `false`
 * would silently strip the control bar off every player that never mentions it.
 * `put` below is the whole mechanism, and it is the only place a value reaches the
 * options object; there is deliberately no default written anywhere in this
 * package, because a default duplicated in a wrapper is a default that drifts
 * from the core's.
 *
 * ONE name differs from the core's option it feeds: `playerClass` → `className`.
 * Same reason the custom element spells it `player-class` — `class` and
 * `className` already mean the host's own class list in a template, so claiming
 * the name would be ambiguous at every call site.
 */

/** Every input of `DataFlowPlayerComponent` that maps to a player option. */
export interface PlayerInputs {
  theme?: PlayerTheme;
  mode?: PlayerMode;
  density?: Density;
  height?: number | string;
  width?: number | string;
  /** The core's `className` option — an extra class on the `.rdfa-player` root. */
  playerClass?: string;
  speed?: number;
  initialT?: number;
  controls?: boolean;
  exportable?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  debug?: boolean;
  /**
   * The animation's text description: `'sr-only'` (default), `'visible'` or
   * `'none'`. See the core's `PlayerOptions.transcript`.
   */
  transcript?: PlayerOptions['transcript'];
  highlight?: Highlighter;
  /** Chrome strings — any key left out keeps the core's English default. */
  labels?: Partial<PlayerLabels>;
}

/**
 * Writes `value` under `key` only when it is defined.
 *
 * Generic over `keyof PlayerOptions` so the value type is checked against the
 * core's own option type — no cast, and adding an option to the core without
 * mapping it here stays a type error rather than a silent omission.
 */
function put<K extends keyof PlayerOptions>(
  options: PlayerOptions,
  key: K,
  value: PlayerOptions[K] | undefined
): void {
  if (value !== undefined) options[key] = value;
}

export function toPlayerOptions(inputs: PlayerInputs): PlayerOptions {
  const options: PlayerOptions = {};

  put(options, 'theme', inputs.theme);
  put(options, 'mode', inputs.mode);
  put(options, 'density', inputs.density);
  put(options, 'height', inputs.height);
  put(options, 'width', inputs.width);
  put(options, 'className', inputs.playerClass);
  put(options, 'speed', inputs.speed);
  put(options, 'initialT', inputs.initialT);
  put(options, 'controls', inputs.controls);
  put(options, 'exportable', inputs.exportable);
  put(options, 'autoPlay', inputs.autoPlay);
  put(options, 'loop', inputs.loop);
  put(options, 'debug', inputs.debug);
  put(options, 'transcript', inputs.transcript);
  put(options, 'highlight', inputs.highlight);
  put(options, 'labels', inputs.labels);

  return options;
}
