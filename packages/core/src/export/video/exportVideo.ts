import type { DataFlowSpec } from '../../types';
import { mountPlayer } from '../../dom/player';
import { collectPlayerCss } from './css';
import { createEncoder, FORMAT_META } from './encoders';
import { recordExportRate, recordExportSize } from './estimate';
import { createRasterizer } from './rasterizer';
import { yieldToBrowser } from './yieldToBrowser';
import type {
  VideoExportOptions,
  VideoExportProgress,
  VideoExportResult,
} from './types';

/**
 * Renders a spec to a video or GIF file, without disturbing anything on screen.
 *
 * The export mounts a PLAYER OF ITS OWN, off screen, and walks it through
 * virtual time with `clock.seek`. Nothing here touches a player the user is
 * watching: one can keep playing, at its own speed, while this runs. That is
 * not a trick — it falls straight out of the engine being `evaluate(timeline,
 * t)`, a pure function with no real clock in it.
 *
 * On cost: the export is many times faster than watching the animation, because
 * it never waits for wall-clock time. Measured across the documentation demos
 * it lands between roughly a tenth and a third of the animation's own duration,
 * so a 30-second animation exports in a handful of seconds.
 *
 * SSR-safe: `document` is only reached inside this call, never at import.
 */

/** Even numbers only — H.264 in 4:2:0 cannot encode an odd dimension. */
function toEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Waits for the mounted stage to settle before the first frame is captured.
 *
 * The stage measures itself and converges (font refits, a `set_content`
 * panel's pre-panel geometry, the ResizeObserver's first callback). Capturing
 * immediately would put a half-measured frame at the head of the file.
 *
 * The timer is NOT belt-and-braces: `requestAnimationFrame` never fires in a
 * background tab, so waiting on it alone means an export freezes the moment the
 * user switches away — permanently, not until they come back. Layout still
 * happens in a hidden tab, so racing a timeout against the frames loses nothing
 * and keeps the export running when nobody is watching it.
 */
function afterLayout(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(done));
    setTimeout(done, 50);
  });
}

function abortError(): DOMException {
  return new DOMException('Export aborted', 'AbortError');
}

export async function exportVideo(
  spec: DataFlowSpec,
  options: VideoExportOptions = {}
): Promise<VideoExportResult> {
  if (typeof document === 'undefined') {
    throw new Error(
      '[dataflow-animator] exportVideo needs a DOM; call it from the browser.'
    );
  }

  const format = options.format ?? 'webm';
  const isGif = format === 'gif';
  // GIF is cheaper per frame than it looks at moderate sizes, so it defaults
  // close to the video formats rather than to the postage stamp the format is
  // usually associated with. 20 fps also divides the centisecond GIF stores
  // delays in (5 cs exactly), so no rounding has to be compensated for.
  const fps = options.fps ?? (isGif ? 20 : 30);
  const layoutWidth = options.layoutWidth ?? 960;
  const layoutHeight = options.layoutHeight ?? 540;
  const aspect = layoutWidth / layoutHeight;
  // Either dimension alone determines the other, so a caller can think in
  // heights (`720`, the way video resolutions are named) without also having to
  // work out the width their player's aspect ratio implies.
  const outWidth = toEven(
    options.width ??
      (options.height != null ? options.height * aspect : isGif ? 960 : 1280)
  );
  const outHeight = toEven(options.height ?? outWidth / aspect);
  const { signal, onProgress } = options;

  if (signal?.aborted) throw abortError();

  // Off screen, but still LAID OUT: `display:none` would give every element a
  // zero box and the stage would measure nothing. Fixed positioning keeps it
  // out of the document's scroll extent, and `aria-hidden` keeps a duplicate of
  // the whole scene out of the accessibility tree while the export runs.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;top:0;left:0;pointer-events:none;opacity:0;z-index:-1';
  host.style.width = `${layoutWidth}px`;
  host.style.height = `${layoutHeight}px`;
  document.body.appendChild(host);

  const player = mountPlayer(host, spec, {
    width: layoutWidth,
    height: layoutHeight,
    // No chrome of any kind: a control bar, a transcript or a focus ring would
    // all be baked into the exported pixels.
    controls: false,
    transcript: 'none',
    exportable: false,
    autoPlay: false,
    theme: options.theme,
    mode: options.mode ?? 'light',
    density: options.density,
    highlight: options.highlight,
  });

  const started = performance.now();
  try {
    await afterLayout();
    if (signal?.aborted) throw abortError();

    const durationMs = player.clock.durationMs;
    const frames = Math.max(1, Math.round((durationMs / 1000) * fps));
    const background =
      options.background ||
      getComputedStyle(player.el).backgroundColor ||
      '#ffffff';

    const rasterizer = createRasterizer({
      el: player.el,
      layoutWidth,
      layoutHeight,
      outWidth,
      outHeight,
      css: collectPlayerCss(document),
      background,
    });

    const encoder = await createEncoder(format, {
      width: outWidth,
      height: outHeight,
      fps,
      bitrate: options.bitrate ?? 4_000_000,
    });

    const report = (
      phase: VideoExportProgress['phase'],
      done: number
    ): void => {
      onProgress?.({
        phase,
        framesDone: done,
        framesTotal: frames,
        ratio: frames === 0 ? 1 : Math.min(1, done / frames),
      });
    };
    report('rendering', 0);

    let lastYield = performance.now();
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw abortError();
      const t = (i / fps) * 1000;
      player.clock.seek(t);
      await rasterizer.drawFrame(t);
      await encoder.addFrame(rasterizer.canvas, i);
      report('rendering', i + 1);

      // Awaiting the image decode already returns to the event loop, so the
      // host page stays responsive on its own. This is the backstop for the
      // case where decodes come back from cache instantly and the loop would
      // otherwise monopolise a long task.
      const now = performance.now();
      if (now - lastYield > 24) {
        await yieldToBrowser();
        lastYield = performance.now();
      }
    }

    report('finalising', frames);
    const blob = await encoder.finish();

    // What this run cost, so the next estimate is this machine's number rather
    // than the model's.
    const shape = { format, width: outWidth, height: outHeight, frames };
    recordExportRate(shape, performance.now() - started);
    recordExportSize(shape, blob.size);

    const { extension } = FORMAT_META[format];
    return {
      blob,
      filename: `${options.filename ?? 'dataflow'}.${extension}`,
      format,
      width: outWidth,
      height: outHeight,
      fps,
      frames,
      durationMs,
      elapsedMs: Math.round(performance.now() - started),
    };
  } finally {
    // Runs on the abort path too: an aborted export must not leave a second
    // player mounted and ticking.
    player.destroy();
    host.remove();
  }
}

/** Saves a finished export through a temporary anchor. */
export function downloadExport(result: VideoExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
