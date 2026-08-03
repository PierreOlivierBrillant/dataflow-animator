import { clamp, nextStop, prevStop, type Timeline } from '../engine/timeline';
import type { PlayerClock } from './clock';
import { h, s, setAttrIfChanged, setStyle, type Child } from './el';
import type { PlayerLabels } from './labels';

/**
 * Player control bar — the port of `Controls.tsx`.
 *
 * Same `create` + `apply` split as the stage elements, and for the same reason:
 * the bar is repainted on every frame of playback (the fill, the thumb and the
 * time readout all track `t`), so rebuilding it would put a DOM teardown on the
 * animation path.
 *
 * FIDELITY — the markup and the class names are reproduced exactly, including
 * two things that are easy to "improve" by accident:
 *
 *  - the scrub bar is a `<button class="rdfa-timeline">` with pointer maths, NOT
 *    an `<input type="range">`. Swapping it would change the accessibility tree,
 *    the keyboard behaviour and every pixel of the bar;
 *  - the time readout is three separate text nodes (`"3s"`, `" / "`, `"12s"`),
 *    because that is what JSX produces from `{fmt(t)} / {fmt(durationMs)}`.
 *
 * The user-visible labels are injected through `ControlsOptions.labels`, always
 * fully resolved: `mountPlayer` fills `PlayerOptions.labels` (a partial) with
 * the English defaults from `labels.ts`, so this module never falls back on its
 * own. English is the default because the package publishes in English.
 */

export interface ControlsOptions {
  clock: PlayerClock;
  timeline: Timeline;
  /** Fully resolved by the caller — see the module header. */
  labels: PlayerLabels;
  onToggleFullscreen(): void;
  /** Optional slot for the JSON spec button, rendered before full screen. */
  exportSlot?: HTMLElement;
}

/** A retained control bar. */
export interface ControlsElement {
  readonly el: HTMLElement;
  readonly playBtn: HTMLButtonElement;
  readonly fullscreenBtn: HTMLButtonElement;
  readonly fill: HTMLElement;
  readonly thumb: HTMLElement;
  readonly timeCurrent: Text;
  readonly timeTotal: Text;
  /** Carried on the handle so `apply` swaps labels without a new parameter. */
  readonly labels: PlayerLabels;
  /** Memo of the swapped icon subtrees, so a frame writes no DOM when idle. */
  playing?: boolean;
  fullscreen?: boolean;
}

function icon(paths: string[], stroke: boolean): SVGSVGElement {
  // Attribute ORDER matches what React emits, so a DOM diff against the React
  // chrome reads clean.
  const svg = s(
    'svg',
    stroke
      ? {
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2',
          'aria-hidden': 'true',
        }
      : {
          viewBox: '0 0 24 24',
          fill: 'currentColor',
          'aria-hidden': 'true',
        }
  );
  for (const d of paths) svg.appendChild(s('path', { d }));
  return svg;
}

/** `restart` is the one icon carrying round caps and joins. */
function restartIcon(): SVGSVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  svg.appendChild(s('path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }));
  svg.appendChild(s('path', { d: 'M3 3v5h5' }));
  return svg;
}

const ICONS = {
  play: () => icon(['M8 5v14l11-7z'], false),
  pause: () => icon(['M6 5h4v14H6zM14 5h4v14h-4z'], false),
  prev: () => icon(['M7 5h2v14H7zM20 5v14l-9-7z'], false),
  next: () => icon(['M15 5h2v14h-2zM4 5v14l9-7z'], false),
  enterFs: () => icon(['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'], true),
  exitFs: () => icon(['M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'], true),
};

function button(label: string, children: Child[]): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn',
      'aria-label': label,
      title: label,
    },
    children
  );
}

function fmt(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

export function createControlsElement(
  options: ControlsOptions
): ControlsElement {
  const { clock, timeline, labels, onToggleFullscreen, exportSlot } = options;

  const restartBtn = button(labels.restart, [restartIcon()]);
  restartBtn.addEventListener('click', () => clock.restart());

  // Label and icon are written by `apply`, which runs before the bar is ever
  // shown — created bare here so there is exactly one writer for them.
  const playBtn = h('button', { type: 'button', class: 'rdfa-btn' });
  playBtn.addEventListener('click', () => clock.toggle());

  const prevBtn = button(labels.prevStep, [ICONS.prev()]);
  prevBtn.addEventListener('click', () => {
    clock.pause();
    clock.seek(prevStop(timeline, clock.t));
  });

  // NOT symmetric with `prev`, by nature: `playTo` animates forward, so "next"
  // plays to the stop; a backward `playTo` would just jump, so "prev" seeks.
  // The keyboard mirrors this pair (ArrowRight plays, ArrowLeft jumps).
  const nextBtn = button(labels.nextStep, [ICONS.next()]);
  nextBtn.addEventListener('click', () => {
    clock.playTo(nextStop(timeline, clock.t));
  });

  const fill = h('span', { class: 'rdfa-timeline-fill' });
  const thumb = h('span', { class: 'rdfa-timeline-thumb' });
  const track = h('span', { class: 'rdfa-timeline-track' }, [fill]);
  // Step ticks are a pure function of the timeline, so they are built once.
  // The bounds are STRICT: a stop exactly at 0 or at the end would draw a tick
  // under the thumb's rest positions.
  for (const stop of timeline.stops) {
    if (stop > 0 && stop < clock.durationMs) {
      const tick = h('span', { class: 'rdfa-timeline-step' });
      setStyle(tick, { left: `${(stop / clock.durationMs) * 100}%` });
      track.appendChild(tick);
    }
  }
  track.appendChild(thumb);

  const scrub = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-timeline',
      'aria-label': labels.progressBar,
    },
    [track]
  );
  scrub.addEventListener('click', (event) => {
    const rect = scrub.getBoundingClientRect();
    const r = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    clock.seek(r * clock.durationMs);
  });

  // Three text nodes, as JSX produces: the separator is its own node.
  const timeCurrent = document.createTextNode('');
  const timeTotal = document.createTextNode('');
  const time = h('span', { class: 'rdfa-time' });
  time.append(timeCurrent, ' / ', timeTotal);

  const fullscreenBtn = h('button', { type: 'button', class: 'rdfa-btn' });
  fullscreenBtn.addEventListener('click', onToggleFullscreen);

  const el = h('div', { class: 'rdfa-controls' }, [
    restartBtn,
    playBtn,
    prevBtn,
    nextBtn,
    scrub,
    time,
  ]);
  // The export slot sits between the readout and full screen — the focus order
  // is the document order, so this position is behavioural, not cosmetic.
  if (exportSlot) el.appendChild(exportSlot);
  el.appendChild(fullscreenBtn);

  return {
    el,
    playBtn,
    fullscreenBtn,
    fill,
    thumb,
    timeCurrent,
    timeTotal,
    labels,
  };
}

/** Writes the clock-dependent state. The whole per-frame cost of the bar. */
export function applyControlsElement(
  ctl: ControlsElement,
  clock: PlayerClock,
  isFullscreen: boolean
): void {
  const { t, playing, durationMs } = clock;
  const ratio = durationMs > 0 ? clamp(t / durationMs, 0, 1) : 0;

  if (ctl.playing !== playing) {
    const label = playing ? ctl.labels.pause : ctl.labels.play;
    setAttrIfChanged(ctl.playBtn, 'aria-label', label);
    setAttrIfChanged(ctl.playBtn, 'title', label);
    ctl.playBtn.replaceChildren(playing ? ICONS.pause() : ICONS.play());
    ctl.playing = playing;
  }

  if (ctl.fullscreen !== isFullscreen) {
    const label = isFullscreen
      ? ctl.labels.exitFullscreen
      : ctl.labels.fullscreen;
    setAttrIfChanged(ctl.fullscreenBtn, 'aria-label', label);
    setAttrIfChanged(ctl.fullscreenBtn, 'title', label);
    ctl.fullscreenBtn.replaceChildren(
      isFullscreen ? ICONS.exitFs() : ICONS.enterFs()
    );
    ctl.fullscreen = isFullscreen;
  }

  setStyle(ctl.fill, { width: `${ratio * 100}%` });
  setStyle(ctl.thumb, { left: `${ratio * 100}%` });

  // Assigning an unchanged `nodeValue` is already a no-op in every engine, so
  // no read-before-write guard is needed here.
  ctl.timeCurrent.nodeValue = fmt(t);
  ctl.timeTotal.nodeValue = fmt(durationMs);
}
