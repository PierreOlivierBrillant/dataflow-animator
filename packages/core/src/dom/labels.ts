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
  /**
   * The loading indicator a host shows while the player is still mounting —
   * the React binding's pre-mount placeholder today.
   *
   * It belongs here rather than in the binding for the same reason every other
   * string does: a default written in a wrapper is a default that drifts from
   * the core's, and the indicator's markup and stylesheet already ship from
   * here.
   */
  loading: string;

  // ─── Text description of the animation ────────────────────────────────────
  //
  // These are TEMPLATES, not sentences: `{name}` placeholders are filled in by
  // `describeAnimation`. They are strings rather than functions on purpose —
  // a string survives a JSON round-trip, so `<dataflow-player>` can carry a
  // translated set in a property and an author can keep their wording in the
  // same file as the rest of their copy.
  //
  // Word order is the translator's to change: `{object} travels from {from} to
  // {to}` and `{from} sends {object} to {to}` are both valid fillings of
  // `describeMove`, and a language that needs the verb last can put it last.

  /** Accessible name of the whole player region. */
  playerRegion: string;
  /** Heading of the text description, and label of its disclosure button. */
  transcriptTitle: string;
  /** Button that reveals the text description. */
  showTranscript: string;
  /** Button that hides it again. */
  hideTranscript: string;
  /** Accessible name of one step button. `{n}`, `{total}`, `{text}`. */
  transcriptStep: string;
  /** Announces the step the playhead just entered. `{n}`, `{total}`, `{text}`. */
  stepAnnouncement: string;
  /** Opens the summary with the cast of the animation. `{list}`. */
  describeActors: string;
  /**
   * States how many steps the animation has. `{count}`.
   *
   * Paired with a `…One` singular below, and every counted template here is:
   * "1 steps" is the kind of detail that makes a generated description sound
   * generated. The core picks the singular at exactly one — the English rule;
   * a language that also singularises zero can put the same wording in both.
   */
  describeStepCount: string;
  /** Singular of {@link PlayerLabels.describeStepCount}. */
  describeStepCountOne: string;
  /** Names a connection that carries no label of its own. `{id}`. */
  describeConnection: string;
  /** `move`. `{object}`, `{from}`, `{to}`. */
  describeMove: string;
  /** `arrow` without a label. `{from}`, `{to}`. */
  describeArrow: string;
  /** `arrow` with a label. `{from}`, `{to}`, `{text}`. */
  describeArrowLabelled: string;
  /** `parallel`: wraps the children's sentences. `{actions}`. */
  describeParallel: string;
  /** `loading`. `{object}`. */
  describeLoading: string;
  /** `set_content`. `{object}`, `{content}`. */
  describeSetContent: string;
  /** `comment` attached to a node. `{object}`, `{text}`. */
  describeCommentOn: string;
  /** `highlight`. `{object}`. */
  describeHighlight: string;
  /** `set_visible: true`. `{object}`. */
  describeAppear: string;
  /** `set_visible: false`. `{object}`. */
  describeDisappear: string;
  /** `set_color`. `{object}`. */
  describeSetColor: string;
  /** `set_icon` with a value. `{object}`, `{icon}`. */
  describeSetIcon: string;
  /** `set_icon` with an empty value. `{object}`. */
  describeClearIcon: string;
  /** `rotate` toward an angle. `{object}`. */
  describeRotate: string;
  /** `rotate` in continuous spin. `{object}`. */
  describeSpin: string;
  /** `rotate_subtree`. `{object}`. */
  describeRotateSubtree: string;
  /** `flow`. `{route}`. */
  describeFlow: string;
  /** `toggle: closed`. `{object}`. */
  describeToggleClosed: string;
  /** `toggle: open`. `{object}`. */
  describeToggleOpen: string;
  /** `wait`. */
  describePause: string;
  /**
   * What a packet IS, when nothing it carries can name it — its id is the
   * author's handle on it, not a name a listener can use.
   */
  describePacketHttp: string;
  /** A `sql_request` with no readable query. */
  describePacketSqlRequest: string;
  /** A `sql_response` with neither header nor row count. */
  describePacketSqlResponse: string;
  /** A `sql_response` known only by its row count. `{rows}`. */
  describePacketRows: string;
  /** Singular of {@link PlayerLabels.describePacketRows}. */
  describePacketRowsOne: string;
  /** A `simple_node` / `complex_node` packet with no readable content. */
  describePacketPanel: string;
  /** A `subicon` packet with no readable badge. */
  describePacketBadge: string;
  /** A `set_content` carrying an image. */
  describeContentImage: string;
  /** A `set_content` carrying a table. `{columns}`, `{rows}`. */
  describeContentTable: string;
  /** Singular of {@link PlayerLabels.describeContentTable}. */
  describeContentTableOne: string;
  /** A `set_content` with nothing to read out. */
  describeContentEmpty: string;
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
  loading: 'Loading…',

  playerRegion: 'Data flow animation',
  transcriptTitle: 'Text description',
  showTranscript: 'Show the text description',
  hideTranscript: 'Hide the text description',
  transcriptStep: 'Step {n} of {total}: {text}',
  stepAnnouncement: 'Step {n} of {total}. {text}',
  describeActors: 'Elements: {list}',
  describeStepCount: '{count} steps',
  describeStepCountOne: '{count} step',
  describeConnection: 'the {id} link',
  describeMove: '{object} travels from {from} to {to}',
  describeArrow: 'An arrow is drawn from {from} to {to}',
  describeArrowLabelled:
    'An arrow labelled “{text}” is drawn from {from} to {to}',
  describeParallel: 'At the same time: {actions}',
  describeLoading: '{object} is working',
  describeSetContent: '{object} now shows: {content}',
  describeCommentOn: 'About {object}: {text}',
  describeHighlight: '{object} is highlighted',
  describeAppear: '{object} appears',
  describeDisappear: '{object} disappears',
  describeSetColor: '{object} changes colour',
  describeSetIcon: 'The badge on {object} becomes “{icon}”',
  describeClearIcon: 'The badge on {object} is removed',
  describeRotate: '{object} rotates',
  describeSpin: '{object} spins',
  describeRotateSubtree: 'The subtree at {object} rotates',
  describeFlow: 'Current flows along {route}',
  describeToggleClosed: '{object} closes',
  describeToggleOpen: '{object} opens',
  describePause: 'Pause',
  describePacketHttp: 'an HTTP packet',
  describePacketSqlRequest: 'a SQL query',
  describePacketSqlResponse: 'a SQL response',
  describePacketRows: 'a SQL response of {rows} rows',
  describePacketRowsOne: 'a SQL response of {rows} row',
  describePacketPanel: 'a panel',
  describePacketBadge: 'a badge',
  describeContentImage: 'an image',
  describeContentTable: 'a table of {rows} rows, columns {columns}',
  describeContentTableOne: 'a table of {rows} row, columns {columns}',
  describeContentEmpty: 'nothing',
};

/** Fills a caller's partial overrides with the English defaults. */
export function resolveLabels(overrides?: Partial<PlayerLabels>): PlayerLabels {
  return overrides
    ? { ...DEFAULT_PLAYER_LABELS, ...overrides }
    : DEFAULT_PLAYER_LABELS;
}
