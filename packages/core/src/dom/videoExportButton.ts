import type { DataFlowSpec } from '../types';
import { downloadExport, exportVideo } from '../export/video/exportVideo';
import {
  estimateExportBytes,
  estimateExportMs,
  formatEstimate,
  formatSize,
} from '../export/video/estimate';
import type {
  VideoExportFormat,
  VideoExportOptions,
} from '../export/video/types';
import { h, s } from './el';
import type { PlayerLabels } from './labels';

/**
 * The control bar's export button, and the settings panel it opens.
 *
 * The panel is a small FORM rather than a list of formats, because the three
 * choices interact: 1080p GIF at 60 fps is a wildly different proposition from
 * 540p at 20, and the only way to know is to be told before pressing the
 * button. So the running estimate is not decoration — it is what makes the
 * resolution and frame-rate controls meaningful.
 *
 * While an export runs the panel turns into a progress readout with a cancel
 * button rather than closing. Export is the one action in this bar that takes
 * seconds, so it needs somewhere to say how it is going, and somewhere to be
 * stopped from.
 */

export interface VideoExportButtonOptions {
  spec: DataFlowSpec;
  labels: PlayerLabels;
  /** Formats offered, in menu order. A single entry hides the control. */
  formats: readonly VideoExportFormat[];
  /** Output heights offered, in pixels. A single entry hides the control. */
  resolutions: readonly number[];
  /** Frame rates offered. A single entry hides the control. */
  frameRates: readonly number[];
  /** Duration of the animation, for the estimate's frame count. */
  durationMs: number;
  /** Rendering options forwarded to the exporter. */
  exportOptions: Omit<
    VideoExportOptions,
    'format' | 'signal' | 'onProgress' | 'width' | 'height' | 'fps' | 'mode'
  >;
  /**
   * The light/dark the file should be written in, asked at export time.
   *
   * A function rather than a value because a host site's theme toggle moves
   * under a player that is already mounted; the export has to match what is on
   * screen when the button is pressed, not when the bar was built.
   */
  resolveMode: () => 'light' | 'dark';
}

export interface VideoExportButtonElement {
  readonly el: HTMLElement;
  /** Aborts a running export and unbinds the document listeners. */
  destroy(): void;
}

function downloadIcon(): SVGSVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  // A film frame with an arrow leaving it: "the animation, as a file".
  svg.appendChild(
    s('path', { d: 'M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10' })
  );
  svg.appendChild(s('path', { d: 'M7 3v4M17 3v4' }));
  svg.appendChild(s('path', { d: 'M12 12v7' }));
  svg.appendChild(s('path', { d: 'm9 16 3 3 3-3' }));
  return svg;
}

/** Display name of a format. Deliberately NOT localised — these are the file
 * extensions, and `MP4` is `MP4` in every language. */
const FORMAT_LABEL: Record<VideoExportFormat, string> = {
  webm: 'WebM',
  mp4: 'MP4',
  gif: 'GIF',
};

/**
 * The settings each format opens on.
 *
 * GIF is given its own pair because its cost curve is not the video one: it
 * encodes in JavaScript, per pixel, so the same 1080p60 that a hardware encoder
 * shrugs at would take it minutes and produce tens of megabytes. 20 fps is also
 * exactly 5 centiseconds, the unit GIF stores delays in.
 */
const FORMAT_DEFAULTS: Record<
  VideoExportFormat,
  { height: number; fps: number }
> = {
  webm: { height: 720, fps: 30 },
  mp4: { height: 720, fps: 30 },
  gif: { height: 540, fps: 20 },
};

/**
 * Nearest available value to `wanted`, so a switch never lands off-list.
 *
 * Ties go to the LARGER value: when 720 is wanted and only 480 and 960 are
 * offered, both are 240 away, and quietly picking the smaller one would
 * downgrade the export to resolve an arithmetic coin-toss.
 */
function nearest(values: readonly number[], wanted: number): number {
  return values.reduce((best, value) => {
    const gap = Math.abs(value - wanted);
    const bestGap = Math.abs(best - wanted);
    if (gap < bestGap) return value;
    return gap === bestGap && value > best ? value : best;
  });
}

/**
 * A labelled row: a `<select>` when there is a choice, static text when there
 * is not.
 *
 * A pinned value is still SHOWN rather than hidden. "Which format am I about to
 * get" is the panel's most important fact, and a caller who fixed it to MP4 has
 * not asked for it to become a secret — dropping the row would leave the button
 * promising an export of nothing in particular.
 */
function field(
  id: string,
  labelText: string,
  options: { value: string; text: string }[],
  onChange: (value: string) => void
): { row: HTMLElement; select: HTMLSelectElement } {
  const select = h('select', {
    class: 'rdfa-export-select',
    id,
  }) as HTMLSelectElement;
  for (const option of options) {
    select.appendChild(
      h('option', { value: option.value }, [option.text]) as HTMLOptionElement
    );
  }
  select.addEventListener('change', () => onChange(select.value));

  if (options.length < 2) {
    // The `<select>` still exists and still holds the value — it is simply not
    // in the document, so the rest of this module reads it without caring
    // whether the user could have changed it.
    const label = h('span', { class: 'rdfa-export-label' }, [labelText]);
    const value = h('span', { class: 'rdfa-export-fixed', id }, [
      options[0]?.text ?? '',
    ]);
    return {
      row: h('div', { class: 'rdfa-export-row' }, [label, value]),
      select,
    };
  }

  const label = h('label', { class: 'rdfa-export-label', for: id }, [
    labelText,
  ]);
  return {
    row: h('div', { class: 'rdfa-export-row' }, [label, select]),
    select,
  };
}

let panelSeq = 0;

export function createVideoExportButton(
  options: VideoExportButtonOptions
): VideoExportButtonElement {
  const {
    spec,
    labels,
    formats,
    resolutions,
    frameRates,
    durationMs,
    exportOptions,
    resolveMode,
  } = options;

  const trigger = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-btn',
      'aria-label': labels.exportVideo,
      title: labels.exportVideo,
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
    },
    [downloadIcon()]
  );

  const panel = h('div', {
    class: 'rdfa-export-menu',
    role: 'group',
    'aria-label': labels.exportVideo,
    hidden: '',
  });
  const el = h('div', { class: 'rdfa-export' }, [trigger, panel]);

  let controller: AbortController | null = null;
  let open = false;

  // Current selection. `touched` is what lets a format switch move the settings
  // without ever discarding a choice the user made on purpose.
  let format = formats[0];
  let height = nearest(resolutions, FORMAT_DEFAULTS[format].height);
  let fps = nearest(frameRates, FORMAT_DEFAULTS[format].fps);
  let heightTouched = false;
  let fpsTouched = false;

  /**
   * Caps the panel at the room actually above the button, inside the player.
   *
   * A viewport-relative `max-height` is the wrong unit here: the panel is
   * clipped by `.rdfa-player`'s `overflow: hidden`, not by the window, and a
   * 200px-tall player has far less room than `60vh` would allow — measured, the
   * form overflowed it by 12px and lost its top row. Measuring at OPEN time
   * rather than at build time is what makes it survive the player being
   * resized, or going fullscreen, between two openings.
   */
  const capHeight = (): void => {
    const player = el.closest('.rdfa-player');
    if (!player) return;
    const room =
      trigger.getBoundingClientRect().top -
      player.getBoundingClientRect().top -
      // The 6px the panel sits above the button, plus the same again so it
      // does not touch the player's own edge.
      12;
    // Below this the panel is more frustrating than useful; let it be clipped
    // rather than render a two-line scroll area.
    panel.style.maxHeight = room > 80 ? `${Math.floor(room)}px` : '';
  };

  const setOpen = (next: boolean): void => {
    open = next;
    trigger.setAttribute('aria-expanded', String(next));
    if (next) {
      panel.removeAttribute('hidden');
      capHeight();
    } else panel.setAttribute('hidden', '');
  };

  /** Rebuilds the settings form. */
  const showSettings = (): void => {
    panel.replaceChildren();
    const seq = panelSeq++;

    const formatField = field(
      `rdfa-export-format-${seq}`,
      labels.exportFormat,
      formats.map((f) => ({ value: f, text: FORMAT_LABEL[f] })),
      (value) => {
        format = value as VideoExportFormat;
        // Untouched settings follow the new format's defaults; a deliberate
        // choice survives the switch, snapped to what this list offers.
        if (!heightTouched)
          height = nearest(resolutions, FORMAT_DEFAULTS[format].height);
        if (!fpsTouched) fps = nearest(frameRates, FORMAT_DEFAULTS[format].fps);
        formatField.select.value = format;
        resolutionField.select.value = String(height);
        fpsField.select.value = String(fps);
        refreshEstimate();
      }
    );

    const resolutionField = field(
      `rdfa-export-height-${seq}`,
      labels.exportResolution,
      resolutions.map((value) => ({ value: String(value), text: `${value}p` })),
      (value) => {
        height = Number(value);
        heightTouched = true;
        refreshEstimate();
      }
    );

    const fpsField = field(
      `rdfa-export-fps-${seq}`,
      labels.exportFrameRate,
      frameRates.map((value) => ({
        value: String(value),
        text: labels.exportFps.replace('{n}', String(value)),
      })),
      (value) => {
        fps = Number(value);
        fpsTouched = true;
        refreshEstimate();
      }
    );

    formatField.select.value = format;
    resolutionField.select.value = String(height);
    fpsField.select.value = String(fps);

    const estimate = h('p', { class: 'rdfa-export-status' });
    const start = h('button', { type: 'button', class: 'rdfa-export-start' }, [
      labels.startExport,
    ]);
    start.addEventListener('click', () => void run());

    panel.append(formatField.row, resolutionField.row, fpsField.row);
    panel.append(estimate, start);

    function refreshEstimate(): void {
      const frames = Math.max(1, Math.round((durationMs / 1000) * fps));
      // The aspect ratio the exporter will use, so the estimate is priced on
      // the pixels it will really encode.
      const aspect =
        (exportOptions.layoutWidth ?? 960) /
        (exportOptions.layoutHeight ?? 540);
      const shape = {
        format,
        width: Math.round(height * aspect),
        height,
        frames,
      };
      estimate.textContent = labels.exportEstimate
        .replace(
          '{duration}',
          formatEstimate(estimateExportMs(shape), {
            seconds: labels.exportSeconds,
            minutes: labels.exportMinutes,
          })
        )
        .replace(
          '{size}',
          formatSize(estimateExportBytes(shape), {
            kilobytes: labels.exportKilobytes,
            megabytes: labels.exportMegabytes,
          })
        );
    }
    refreshEstimate();
  };

  /** Progress state: a bar, a percentage, and a way out. */
  const showProgress = (): ((ratio: number, finalising: boolean) => void) => {
    panel.replaceChildren();
    const fill = h('span', { class: 'rdfa-export-progress-fill' });
    const bar = h(
      'div',
      {
        class: 'rdfa-export-progress',
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        'aria-label': labels.exporting,
      },
      [fill]
    );
    const text = document.createTextNode(labels.exporting);
    const status = h('p', { class: 'rdfa-export-status' });
    status.appendChild(text);
    const cancel = h('button', { type: 'button', class: 'rdfa-export-start' }, [
      labels.cancelExport,
    ]);
    cancel.addEventListener('click', () => controller?.abort());
    panel.append(status, bar, cancel);

    return (ratio: number, finalising: boolean) => {
      const percent = Math.round(ratio * 100);
      fill.style.width = `${percent}%`;
      bar.setAttribute('aria-valuenow', String(percent));
      text.nodeValue = finalising
        ? labels.finalisingExport
        : `${labels.exporting} ${percent}%`;
    };
  };

  const showError = (message: string): void => {
    panel.replaceChildren();
    const status = h('p', { class: 'rdfa-export-status rdfa-export-error' }, [
      message,
    ]);
    // `alert` so the failure is spoken as soon as it lands: by then the user
    // has been watching a progress bar for several seconds and has no reason
    // to keep looking at it.
    status.setAttribute('role', 'alert');
    const back = h('button', { type: 'button', class: 'rdfa-export-start' }, [
      labels.close,
    ]);
    back.addEventListener('click', () => {
      showSettings();
      trigger.focus();
    });
    panel.append(status, back);
  };

  const run = async (): Promise<void> => {
    if (controller) return; // one export at a time
    controller = new AbortController();
    const update = showProgress();
    try {
      const result = await exportVideo(spec, {
        ...exportOptions,
        format,
        height,
        fps,
        mode: resolveMode(),
        signal: controller.signal,
        onProgress: (progress) =>
          update(progress.ratio, progress.phase === 'finalising'),
      });
      downloadExport(result);
      setOpen(false);
      showSettings();
    } catch (error) {
      // An abort is a user decision, not a failure to report back to them.
      if (error instanceof DOMException && error.name === 'AbortError') {
        showSettings();
        trigger.focus();
      } else {
        showError(error instanceof Error ? error.message : labels.exportFailed);
      }
    } finally {
      controller = null;
    }
  };

  trigger.addEventListener('click', () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Reopening mid-export must show the progress that is still running, not a
    // fresh form that would start a second one.
    if (!controller) showSettings();
    setOpen(true);
  });

  const onDocumentPointerDown = (event: MouseEvent): void => {
    if (!open) return;
    if (!el.contains(event.target as Node)) setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!open || event.key !== 'Escape') return;
    // Stops the player's own Escape handling (leaving fullscreen) from firing
    // on the same press that closes this panel.
    event.stopPropagation();
    setOpen(false);
    trigger.focus();
  };

  document.addEventListener('pointerdown', onDocumentPointerDown);
  el.addEventListener('keydown', onKeyDown);

  showSettings();

  return {
    el,
    destroy() {
      controller?.abort();
      controller = null;
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      el.removeEventListener('keydown', onKeyDown);
    },
  };
}
