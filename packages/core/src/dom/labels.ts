/**
 * The player chrome's user-visible strings, and their one resolution point.
 *
 * Every `aria-label`, `title` and heading the control bar and the JSON dialog
 * render comes from a `PlayerLabels` object. The defaults are English — the
 * package publishes in English — and they are resolved HERE, in the core, so no
 * wrapper ever writes a default of its own (the same rule `controls` follows:
 * a default duplicated in a wrapper is a default that drifts from the core's).
 */

/** Every user-visible string of the player chrome. All optional at the API
 * surface (`PlayerOptions.labels` is a `Partial`); the defaults below fill the
 * gaps, so a caller localising only the control bar never sees an empty tooltip
 * in the dialog. */
export interface PlayerLabels {
  /** Restart button of the control bar. */
  restart: string;
  /** Play/pause toggle while paused. */
  play: string;
  /** Play/pause toggle while playing. */
  pause: string;
  /** Jump to the previous step. */
  prevStep: string;
  /** Play to the next step. */
  nextStep: string;
  /** The scrub bar (`aria-label` only — it carries no `title`). */
  progressBar: string;
  /** Fullscreen toggle while windowed. */
  fullscreen: string;
  /** Fullscreen toggle while fullscreen. */
  exitFullscreen: string;
  /** The JSON spec button, and the dialog's title and accessible name. */
  jsonSpec: string;
  /** Download button of the JSON dialog. */
  download: string;
  /** Copy button of the JSON dialog, at rest. */
  copy: string;
  /** Copy button while the confirmation shows (`aria-label` only). */
  copied: string;
  /** Copy button's constant `title` — it does NOT follow `copy`/`copied`. */
  copyToClipboard: string;
  /** Close button of the JSON dialog. */
  close: string;
  /** The dialog backdrop's accessible name. */
  closeDialog: string;
}

/** The published defaults. English, because the package is. */
export const DEFAULT_PLAYER_LABELS: PlayerLabels = {
  restart: 'Restart from the beginning',
  play: 'Play',
  pause: 'Pause',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  progressBar: 'Progress bar',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit fullscreen',
  jsonSpec: 'JSON specification',
  download: 'Download the JSON',
  copy: 'Copy',
  copied: 'Copied',
  copyToClipboard: 'Copy to clipboard',
  close: 'Close',
  closeDialog: 'Close the dialog',
};

/** Fills a caller's partial overrides with the English defaults. */
export function resolveLabels(overrides?: Partial<PlayerLabels>): PlayerLabels {
  return overrides
    ? { ...DEFAULT_PLAYER_LABELS, ...overrides }
    : DEFAULT_PLAYER_LABELS;
}
