import type { DataFlowSpec, Highlighter, PlayerTheme } from '../types';
import type { Density } from '../engine/scale';
import { compile } from '../engine/compiler';
import { nextStop, prevStop, stepIndexAt } from '../engine/timeline';
import { describeAnimation } from '../a11y/describe';
import { copyText, downloadJson, serializeSpec } from '../export/json';
import { highlightCode } from '../highlight/highlight';
import { createPlayerClock, type PlayerClock } from './clock';
import {
  applyControlsElement,
  createControlsElement,
  type ControlsElement,
} from './controls';
import { h, s, setStyle } from './el';
import { resolveLabels, type PlayerLabels } from './labels';
import { createJsonDialog, type JsonDialogElement } from './jsonDialog';
import {
  createVideoExportButton,
  type VideoExportButtonElement,
} from './videoExportButton';
import type { VideoExportFormat } from '../export/video/types';
import {
  createTranscriptElement,
  type TranscriptElement,
} from './transcriptElement';
import { mountStage, type StageHandle } from './mount';

/**
 * The player: a stage, its control bar and its clock, in plain DOM.
 *
 * This is the package's headline entry point, and the one every framework
 * wrapper mounts. It is where the retained renderer gets a clock:
 * `createPlayerClock` drives `StageHandle.update` through a subscription. One
 * notification per frame, one `update(t)`, no rebuild — which is the whole
 * point of the design.
 *
 * OUT OF SCOPE, deliberately: changing the `spec` on a live player. `update`
 * only moves time. A new spec means a new mount, and arranging that is the
 * wrapper's job — every option here is read once, at mount.
 *
 * SSR-safe: nothing here touches `document` until `mountPlayer` is called.
 */

/**
 * How the export button behaves, when `PlayerOptions.videoExport` is an object.
 *
 * Every field is optional: `videoExport: true` and `videoExport: {}` mean the
 * same thing. The output size defaults per format (video is larger than GIF),
 * so a caller who only wants to restrict the format list writes nothing else.
 */
export interface VideoExportConfig {
  /** Formats offered, in menu order. Default: all three. */
  formats?: readonly VideoExportFormat[];
  /**
   * Output heights offered, in pixels — `720` reads `720p`, and the width
   * follows from the player's aspect ratio. Default: `[360, 540, 720, 1080]`.
   *
   * A list with ONE entry hides the control and fixes the value, which is how a
   * caller pins the output without also having to turn the panel off.
   */
  resolutions?: readonly number[];
  /** Frame rates offered. Default: `[15, 20, 24, 30, 60]`. Same one-entry rule. */
  frameRates?: readonly number[];
  /** Video bitrate in bits per second. Default: 4_000_000. */
  bitrate?: number;
  /** Base name of the downloaded file, extension excluded. */
  filename?: string;
}

export interface PlayerOptions {
  /** Height of the player. A number is taken as pixels. Default: 420. */
  height?: number | string;
  /**
   * Width of the player. A number is taken as pixels; omitted, the player
   * takes its width from its container.
   *
   * It exists for the same reason `height` does: the stage MEASURES during
   * mount — including the one-shot capture of a `set_content` node's pre-panel
   * geometry — so a caller that sizes the root afterwards would anchor the
   * icon→panel morph to a box the player never actually has. Sizing has to
   * happen before the first measurement, not after it.
   */
  width?: number | string;
  /**
   * Instant the player opens at, in ms. Default: 0.
   *
   * It has to be an option rather than a `seek` the caller performs afterwards,
   * and that is not a convenience: the stage captures a `set_content` node's
   * pre-panel geometry ONCE, during its first measurement. Mounting at 0 and
   * seeking to `t` therefore anchors the icon→panel morph to the state at 0 and
   * walks to `t`, which is a different (and equally legitimate) rendering from
   * one mounted at `t` directly — the path dependence `mountUpdate.ab.spec.ts`
   * documents. A player asked to open at `t` must actually open there.
   */
  initialT?: number;
  autoPlay?: boolean;
  loop?: boolean;
  /** Renders the control bar, the keyboard shortcuts and the focus ring. */
  controls?: boolean;
  /** Adds the JSON spec button and its dialog. */
  exportable?: boolean;
  /**
   * Adds the video export button to the control bar. Default: absent, i.e. no
   * button — so no existing player changes appearance by being updated.
   *
   * `true` offers every format; an object narrows the list or fixes the output
   * size. Needs `controls`, since the button lives in the bar.
   *
   * The export itself never disturbs this player: it mounts a second one off
   * screen and walks THAT through virtual time, so playback here carries on at
   * its own speed while a file is being written.
   */
  videoExport?: boolean | VideoExportConfig;
  theme?: PlayerTheme;
  mode?: 'auto' | 'light' | 'dark';
  density?: Density;
  speed?: number;
  highlight?: Highlighter;
  className?: string;
  /** Renders the timeline debug overlay. Default: false. */
  debug?: boolean;
  /**
   * The animation's text description — a summary, then one button per step that
   * seeks the player to it, plus a live region announcing the step the playhead
   * enters.
   *
   * - `'sr-only'` (default) renders it for assistive technology only, with a
   *   button to reveal it. Nothing about the visible player changes.
   * - `'visible'` renders it open, as a transcript panel under the stage.
   * - `'none'` leaves it out entirely. Use it only when the SAME information is
   *   already available in the page some other way — an animation with no text
   *   equivalent is one a screen-reader user cannot read at all, since the
   *   stage itself is `aria-hidden` decoration.
   */
  transcript?: 'sr-only' | 'visible' | 'none';
  /**
   * Extra inline styles for the `.rdfa-player` root.
   *
   * Kebab-case property names and string values — the contract `el.ts` states
   * and defends. Applied AFTER `height`/`width`, so a caller can override them,
   * and before the root is inserted, so the stage's first measurement already
   * sees the final box.
   */
  style?: Readonly<Record<string, string>>;
  /**
   * Localises the chrome — every `aria-label`, `title` and heading of the
   * control bar and the JSON dialog. Any key left out keeps its English
   * default; the resolution happens here, in the core, so no wrapper ever
   * writes a default of its own.
   */
  labels?: Partial<PlayerLabels>;
}

export interface PlayerHandle {
  /** The `.rdfa-player` root, for callers that need to place or measure it. */
  readonly el: HTMLElement;
  readonly clock: PlayerClock;
  /**
   * Compile warnings for the mounted spec — what a `debug` caller logs.
   *
   * Exposed rather than recomputed: the spec is already compiled here, and a
   * caller that wanted the warnings would otherwise have to compile it again.
   */
  readonly warnings: readonly string[];
  /** Detaches everything and releases the clock, observers and listeners. */
  destroy(): void;
}

/**
 * Pins `'auto'` to what the player is showing AT THIS MOMENT.
 *
 * An exported file has no viewer to follow, so `auto` has to become a concrete
 * choice — and it has to be the same one the stylesheet made, or the file comes
 * out in a theme nobody was looking at.
 *
 * The stylesheet resolves `auto` from an ANCESTOR carrying
 * `data-theme="light|dark"` (the Docusaurus convention) and falls back to the OS
 * only when there is none. Reading `prefers-color-scheme` alone — which this
 * did — exports a light file from a site the reader has switched to dark,
 * whenever their OS disagrees with the site.
 *
 * Called per export rather than at mount, because a site's theme toggle moves
 * under a player that is already on screen.
 */
function resolveExportMode(
  mode: 'auto' | 'light' | 'dark',
  root: HTMLElement
): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  // The player's OWN `data-theme` is a palette name (`neon`, `pcb`…), never
  // light/dark, so the search starts at its parent — same as the CSS, which
  // matches `[data-theme='dark'] .rdfa-player`.
  const host = root.parentElement?.closest(
    '[data-theme="light"], [data-theme="dark"]'
  );
  if (host) {
    return host.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The JSON spec button, ported from `DataFlowPlayer`'s `exportSlot`. */
function jsonButton(label: string, onOpen: () => void): HTMLButtonElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': 'true',
  });
  svg.appendChild(
    s('path', {
      d: 'M7 4a3 3 0 0 0-3 3v2a2 2 0 0 1-2 2v2a2 2 0 0 1 2 2v2a3 3 0 0 0 3 3h1v-2H7a1 1 0 0 1-1-1v-2a3 3 0 0 0-1.2-2.4A3 3 0 0 0 6 9V7a1 1 0 0 1 1-1h1V4H7zm10 0a3 3 0 0 1 3 3v2a2 2 0 0 0 2 2v2a2 2 0 0 0-2 2v2a3 3 0 0 1-3 3h-1v-2h1a1 1 0 0 0 1-1v-2a3 3 0 0 1 1.2-2.4A3 3 0 0 1 18 9V7a1 1 0 0 0-1-1h-1V4h1z',
    })
  );
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn',
      'aria-label': label,
      title: label,
    },
    [svg]
  );
  btn.addEventListener('click', onOpen);
  return btn;
}

export function mountPlayer(
  container: HTMLElement,
  spec: DataFlowSpec,
  options: PlayerOptions = {}
): PlayerHandle {
  const {
    height = 420,
    width,
    initialT = 0,
    autoPlay = false,
    loop = false,
    controls = true,
    exportable = false,
    videoExport = false,
    theme = 'default',
    mode = 'auto',
    density = 'comfortable',
    speed = 1,
    highlight = highlightCode,
    className,
    debug = false,
    transcript = 'sr-only',
    style,
    labels,
  } = options;

  // THE resolution point: past this line every consumer of the chrome receives
  // a complete `PlayerLabels`, never a partial.
  const chrome = resolveLabels(labels);

  const { timeline, warnings } = compile(spec);

  const root = h('div', {
    class: `rdfa-player${className ? ` ${className}` : ''}`,
    'data-theme': theme,
    'data-mode': mode,
  });
  setStyle(root, {
    height: typeof height === 'number' ? `${height}px` : height,
    ...(width != null
      ? { width: typeof width === 'number' ? `${width}px` : width }
      : {}),
    ...style,
  });
  // `tabIndex` is what makes the root focusable for the keyboard shortcuts, so
  // it is present exactly when the controls are — as in React.
  if (controls) root.setAttribute('tabindex', '0');
  // A named region, so the player is something a screen-reader user can find
  // and jump to rather than a `div` they fall into. The name is the spec's own
  // `description` when it has one — "How a page load reaches the database"
  // beats a generic label on a page carrying several players.
  root.setAttribute('role', 'region');
  root.setAttribute(
    'aria-label',
    spec.description?.trim() || chrome.playerRegion
  );
  container.appendChild(root);

  const clock = createPlayerClock({
    durationMs: timeline.durationMs,
    speed,
    loop,
    autoPlay,
  });
  // Seeded immediately, before ANYTHING reads it. The stage captures a
  // `set_content` node's pre-panel geometry once, on its first measurement, and
  // the control bar is written from the clock exactly once at construction —
  // both happen below, and both must already see the instant asked for. Seeking
  // afterwards would leave the bar showing 0 (nothing is subscribed yet) and
  // would anchor the icon→panel morph to the state at 0.
  if (initialT !== 0) clock.seek(initialT);

  let isFullscreen = false;
  const toggleFullscreen = (): void => {
    // Exit only when THIS player is the fullscreen element: another player (or
    // any other element) being fullscreen is not ours to collapse.
    if (document.fullscreenElement === root) void document.exitFullscreen();
    else void root.requestFullscreen?.();
  };

  let bar: ControlsElement | undefined;
  let dialog: JsonDialogElement | undefined;
  let videoExportButton: VideoExportButtonElement | undefined;

  const openDialog = (): void => {
    if (dialog) return;
    const json = serializeSpec(spec);
    dialog = createJsonDialog({
      json,
      highlight,
      labels: chrome,
      onCopy: () => copyText(json),
      onDownload: () => downloadJson(json),
      onClose: closeDialog,
    });
    root.appendChild(dialog.el);
  };
  const closeDialog = (): void => {
    dialog?.destroy();
    dialog = undefined;
  };

  // The control bar goes in BEFORE the stage is mounted, and that ordering is
  // load-bearing rather than stylistic. The stage takes its height from the
  // space the bar leaves, and it MEASURES during `mountStage` — including
  // the one-shot capture of a `set_content` node's pre-panel geometry. Mounting
  // the stage first would measure it at the full player height, anchor the
  // icon→panel morph to that, and then shrink it when the bar arrived; React
  // commits the stage and the bar together and never sees the intermediate
  // size. The stage is moved back in front of the bar afterwards, which changes
  // the document order without changing either box.
  if (controls) {
    const slots: HTMLElement[] = [];
    if (exportable) slots.push(jsonButton(chrome.jsonSpec, openDialog));
    if (videoExport) {
      const config: VideoExportConfig = videoExport === true ? {} : videoExport;
      videoExportButton = createVideoExportButton({
        spec,
        labels: chrome,
        formats: config.formats ?? ['webm', 'mp4', 'gif'],
        resolutions: config.resolutions ?? [360, 540, 720, 1080],
        frameRates: config.frameRates ?? [15, 20, 24, 30, 60],
        // The estimate needs a frame count, and the frame count needs the
        // animation's length — already compiled here, so it is passed rather
        // than compiled a second time inside the button.
        durationMs: timeline.durationMs,
        exportOptions: {
          bitrate: config.bitrate,
          filename: config.filename,
          // The export mounts its own player, so it has to be told how this
          // one looks.
          theme,
          density,
          highlight,
        },
        // A FUNCTION, not a value: the host's theme toggle moves under a
        // mounted player, and the export must follow it rather than whatever
        // the theme happened to be when the bar was built.
        resolveMode: () => resolveExportMode(mode, root),
      });
      slots.push(videoExportButton.el);
    }
    bar = createControlsElement({
      clock,
      timeline,
      labels: chrome,
      onToggleFullscreen: toggleFullscreen,
      actionSlots: slots,
    });
    applyControlsElement(bar, clock, isFullscreen);
    root.appendChild(bar.el);
  }

  const stage: StageHandle = mountStage(root, spec, clock.t, {
    density,
    highlight,
    debug,
  });
  if (bar) root.insertBefore(stage.el, bar.el);

  // The stage is DECOR for assistive technology, and hiding it is the whole
  // point rather than a shortcut. Its labels are absolutely positioned, so a
  // screen reader reads them in reconciliation order — "BrowserWeb serverGET
  // /users", four strings with no relationship between them — while the
  // animation itself, the thing being communicated, is nowhere in the text.
  // The transcript below carries that information in order and on purpose.
  stage.el.setAttribute('aria-hidden', 'true');

  let script: TranscriptElement | undefined;
  /** Position of each root-step index in the described list, for the announcer. */
  const positionByStep = new Map<number, number>();
  if (transcript !== 'none') {
    const description = describeAnimation(spec, timeline, chrome);
    description.steps.forEach((step, position) =>
      positionByStep.set(step.index, position)
    );
    script = createTranscriptElement({
      description,
      labels: chrome,
      visible: transcript === 'visible',
      onSeek: (startMs) => {
        // Pause first: a reader who picked a step wants to BE there, not to
        // watch the playhead run away from it.
        clock.pause();
        clock.seek(startMs);
      },
    });
    root.appendChild(script.el);
  }

  const onFullscreenChange = (): void => {
    isFullscreen = document.fullscreenElement === root;
    if (bar) applyControlsElement(bar, clock, isFullscreen);
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  /**
   * The shortcuts listen on the ROOT, which also contains the control bar and
   * — while it is open — the JSON dialog. Every keydown on a focused button
   * therefore bubbles here, and two exclusions follow from that:
   *
   *  - **Space is not a shortcut on an activatable control.** Space ACTIVATES a
   *    focused button; claiming it here would toggle playback instead of
   *    pressing "Next step". It stays the play/pause shortcut only when the
   *    focus is on the root or the stage, i.e. on nothing activatable.
   *  - **No shortcut fires from inside the dialog.** It is modal, and its
   *    `<pre>` is focusable and scrollable, so the arrows there belong to the
   *    scroll. Everywhere else the arrows stay global — unlike Space they
   *    compete with no button activation, so a focused button still steps the
   *    timeline with them.
   */
  const fromDialog = (target: EventTarget | null): boolean =>
    dialog !== undefined &&
    target instanceof Node &&
    dialog.el.contains(target);
  const fromActivatable = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest('button') !== null;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (fromDialog(event.target)) return;
    if (event.key === ' ') {
      if (fromActivatable(event.target)) return;
      event.preventDefault();
      clock.toggle();
    } else if (event.key === 'ArrowRight') {
      // Mirrors the "next" button: PLAY to the next stop (playTo animates
      // forward). ArrowLeft mirrors "prev" — a backward jump — below.
      event.preventDefault();
      clock.playTo(nextStop(timeline, clock.t));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      clock.pause();
      clock.seek(prevStop(timeline, clock.t));
    }
  };
  if (controls) root.addEventListener('keydown', onKeyDown);

  // The one line the whole migration was for: a clock tick mutates the stage
  // instead of re-rendering it.
  const announce = (): void => {
    if (!script) return;
    const step = timeline.steps[stepIndexAt(timeline, clock.t)];
    script.setCurrentStep(
      step === undefined ? -1 : (positionByStep.get(step.index) ?? -1)
    );
  };
  announce();

  const unsubscribe = clock.subscribe(() => {
    stage.update(clock.t);
    if (bar) applyControlsElement(bar, clock, isFullscreen);
    announce();
  });

  return {
    el: root,
    clock,
    warnings,
    destroy() {
      // Order matters: drop the subscription before stopping the clock, so a
      // final notification cannot reach a stage that is already gone.
      unsubscribe();
      clock.destroy();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      root.removeEventListener('keydown', onKeyDown);
      closeDialog();
      // Aborts a running export, so a destroyed player cannot leave one
      // writing frames into a file nobody will receive.
      videoExportButton?.destroy();
      script?.destroy();
      stage.destroy();
      root.remove();
    },
  };
}
