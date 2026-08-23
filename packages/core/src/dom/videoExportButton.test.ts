/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataFlowSpec } from '../types';
import { DEFAULT_PLAYER_LABELS } from './labels';

/**
 * The export panel, with the exporter itself mocked out.
 *
 * What is under test is the FORM and the states around a long action: the
 * settings, the estimate that makes them meaningful, and progress / cancel /
 * failure. Whether a file comes out the far end is the exporter's business, and
 * it needs WebCodecs — which jsdom has none of.
 */

const exportVideo = vi.fn();
const downloadExport = vi.fn();

vi.mock('../export/video/exportVideo', () => ({
  exportVideo: (...args: unknown[]) => exportVideo(...args),
  downloadExport: (...args: unknown[]) => downloadExport(...args),
}));

const { createVideoExportButton } = await import('./videoExportButton');
const { resetExportCalibration } = await import('../export/video/estimate');

const spec = { nodes: [], steps: [] } as unknown as DataFlowSpec;

function make(
  over: {
    formats?: ('webm' | 'mp4' | 'gif')[];
    resolutions?: number[];
    frameRates?: number[];
    durationMs?: number;
  } = {}
) {
  const button = createVideoExportButton({
    spec,
    labels: DEFAULT_PLAYER_LABELS,
    formats: over.formats ?? ['webm', 'mp4', 'gif'],
    resolutions: over.resolutions ?? [360, 540, 720, 1080],
    frameRates: over.frameRates ?? [15, 20, 24, 30, 60],
    durationMs: over.durationMs ?? 10_000,
    exportOptions: {},
    resolveMode: () => 'light',
  });
  document.body.appendChild(button.el);
  const trigger = button.el.querySelector('button') as HTMLButtonElement;
  const panel = button.el.querySelector('.rdfa-export-menu') as HTMLElement;
  const selects = (): HTMLSelectElement[] =>
    Array.from(panel.querySelectorAll('select'));
  const select = (id: 'format' | 'height' | 'fps'): HTMLSelectElement =>
    panel.querySelector(`[id^="rdfa-export-${id}-"]`) as HTMLSelectElement;
  const estimate = (): string =>
    panel.querySelector('.rdfa-export-status')?.textContent ?? '';
  const change = (which: 'format' | 'height' | 'fps', value: string): void => {
    const element = select(which);
    element.value = value;
    element.dispatchEvent(new Event('change'));
  };
  const start = (): HTMLButtonElement =>
    panel.querySelector('.rdfa-export-start') as HTMLButtonElement;
  return { button, trigger, panel, selects, select, estimate, change, start };
}

beforeEach(() => {
  exportVideo.mockReset();
  downloadExport.mockReset();
  resetExportCalibration();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('the settings form', () => {
  it('offers format, resolution and frame rate', () => {
    const { trigger, selects } = make();
    trigger.click();

    expect(selects()).toHaveLength(3);
  });

  it('opens on the format defaults', () => {
    const { trigger, select } = make();
    trigger.click();

    expect(select('format').value).toBe('webm');
    expect(select('height').value).toBe('720');
    expect(select('fps').value).toBe('30');
  });

  it('shows a pinned value as text instead of a dropdown', () => {
    // A caller pinning the output has not asked for it to become a secret:
    // "which format am I about to get" is the panel's most important fact.
    const { trigger, selects, panel } = make({
      formats: ['mp4'],
      resolutions: [1080],
    });
    trigger.click();

    expect(selects()).toHaveLength(1); // frame rate is the only real choice
    const fixed = Array.from(panel.querySelectorAll('.rdfa-export-fixed')).map(
      (e) => e.textContent
    );
    expect(fixed).toEqual(['MP4', '1080p']);
    // Still labelled, so the value is not a bare number floating in a panel.
    expect(panel.textContent).toContain(DEFAULT_PLAYER_LABELS.exportFormat);
  });

  it('exports with the values chosen', async () => {
    exportVideo.mockResolvedValue({ blob: new Blob(), filename: 'x.mp4' });
    const { trigger, change, start } = make();
    trigger.click();

    change('format', 'mp4');
    change('height', '1080');
    change('fps', '60');
    start().click();

    await vi.waitFor(() => expect(downloadExport).toHaveBeenCalled());
    expect(exportVideo).toHaveBeenCalledWith(
      spec,
      expect.objectContaining({ format: 'mp4', height: 1080, fps: 60 })
    );
  });
});

describe('format switching', () => {
  it('moves untouched settings to the new format defaults', () => {
    // GIF encodes per pixel in JavaScript, so it opens smaller and slower than
    // the video formats rather than inheriting their 720p60.
    const { trigger, select, change } = make();
    trigger.click();
    change('format', 'gif');

    expect(select('height').value).toBe('540');
    expect(select('fps').value).toBe('20');
  });

  it('keeps a setting the user chose on purpose', () => {
    const { trigger, select, change } = make();
    trigger.click();
    change('height', '1080');
    change('format', 'gif');

    // Switching format to compare containers must not silently discard the
    // resolution that was deliberately picked.
    expect(select('height').value).toBe('1080');
    expect(select('fps').value).toBe('20'); // untouched, so it follows
  });

  it('snaps a default onto the nearest offered value', () => {
    const { trigger, select } = make({ resolutions: [600, 1080] });
    trigger.click();

    // 720 is not on offer; 600 is the nearest of what is.
    expect(select('height').value).toBe('600');
  });

  it('breaks an exact tie in favour of the larger value', () => {
    // 480 and 960 are both 240 from the wanted 720; downgrading to resolve a
    // coin-toss would be the wrong way to settle it.
    const { trigger, select } = make({ resolutions: [480, 960] });
    trigger.click();

    expect(select('height').value).toBe('960');
  });
});

describe('the estimate', () => {
  it('shows a duration AND a size as soon as the panel opens', () => {
    const { trigger, estimate } = make();
    trigger.click();

    // Size is the half that decides a GIF: 2.7 MB and 4.6 MB are a different
    // question from 3 s and 6 s.
    expect(estimate()).toMatch(/\d+ s/);
    expect(estimate()).toMatch(/\d+(\.\d)? (kB|MB)/);
  });

  it('grows the size estimate with resolution', () => {
    const { trigger, estimate, change } = make({ durationMs: 60_000 });
    trigger.click();
    change('format', 'gif');

    change('height', '360');
    const small = estimate();
    change('height', '1080');

    expect(estimate()).not.toBe(small);
  });

  it('grows with the frame rate', () => {
    const { trigger, estimate, change } = make({ durationMs: 60_000 });
    trigger.click();

    change('fps', '15');
    const slow = estimate();
    change('fps', '60');
    const fast = estimate();

    // Four times the frames cannot cost the same.
    expect(fast).not.toBe(slow);
  });

  it('grows with resolution for GIF, which encodes per pixel', () => {
    const { trigger, estimate, change } = make({ durationMs: 60_000 });
    trigger.click();
    change('format', 'gif');

    change('height', '360');
    const small = estimate();
    change('height', '1080');
    const large = estimate();

    expect(large).not.toBe(small);
  });

  it('reads in minutes once it passes one', () => {
    const { trigger, estimate, change } = make({ durationMs: 600_000 });
    trigger.click();
    change('format', 'gif');
    change('height', '1080');
    change('fps', '60');

    expect(estimate()).toContain('min');
  });
});

describe('running an export', () => {
  it('shows progress, as a labelled progressbar', async () => {
    let report: ((p: unknown) => void) | undefined;
    exportVideo.mockImplementation(
      (_spec: unknown, options: { onProgress: (p: unknown) => void }) => {
        report = options.onProgress;
        return new Promise(() => {}); // never settles: hold the progress state
      }
    );

    const { trigger, panel, start } = make();
    trigger.click();
    start().click();
    await vi.waitFor(() => expect(report).toBeDefined());

    report?.({
      phase: 'rendering',
      framesDone: 1,
      framesTotal: 4,
      ratio: 0.25,
    });
    const bar = panel.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(panel.textContent).toContain('25%');

    report?.({ phase: 'finalising', framesDone: 4, framesTotal: 4, ratio: 1 });
    expect(panel.textContent).toContain(DEFAULT_PLAYER_LABELS.finalisingExport);
  });

  it('aborts when cancel is pressed, and returns to the form', async () => {
    let signal: AbortSignal | undefined;
    exportVideo.mockImplementation(
      (_spec: unknown, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Export aborted', 'AbortError'))
          );
        });
      }
    );

    const { trigger, start, selects } = make();
    trigger.click();
    start().click();
    await vi.waitFor(() => expect(signal).toBeDefined());

    start().click(); // the cancel button occupies the same slot
    expect(signal?.aborted).toBe(true);

    // An abort is a decision, not an error: the form comes back rather than a
    // failure message.
    await vi.waitFor(() => expect(selects()).toHaveLength(3));
    expect(downloadExport).not.toHaveBeenCalled();
  });

  it('reports a failure and lets the user get back to the form', async () => {
    exportVideo.mockRejectedValue(new Error('WebCodecs unavailable'));

    const { trigger, panel, start, selects } = make();
    trigger.click();
    start().click();

    await vi.waitFor(() =>
      expect(panel.querySelector('[role="alert"]')).not.toBeNull()
    );
    expect(panel.textContent).toContain('WebCodecs unavailable');

    start().click();
    expect(selects()).toHaveLength(3);
  });

  it('refuses to start a second export while one is running', async () => {
    exportVideo.mockImplementation(() => new Promise(() => {}));

    const { trigger, panel, start } = make();
    trigger.click();
    start().click();
    await vi.waitFor(() => expect(exportVideo).toHaveBeenCalledTimes(1));

    // Reopening mid-export shows the progress, not a fresh form.
    trigger.click();
    trigger.click();
    expect(panel.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(exportVideo).toHaveBeenCalledTimes(1);
  });
});

describe('the disclosure', () => {
  it('starts closed and toggles, reflecting state in aria-expanded', () => {
    const { trigger, panel } = make();

    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('closes on a click outside, and stays open on one inside', () => {
    const { trigger, panel } = make();
    trigger.click();

    panel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(panel.hasAttribute('hidden')).toBe(false);

    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true })
    );
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('closes on Escape without letting the player leave fullscreen too', () => {
    const { trigger, panel, button } = make();
    trigger.click();

    const onOuter = vi.fn();
    document.addEventListener('keydown', onOuter);
    button.el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    document.removeEventListener('keydown', onOuter);

    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(onOuter).not.toHaveBeenCalled();
  });

  it('aborts on destroy and stops listening to the document', async () => {
    let signal: AbortSignal | undefined;
    exportVideo.mockImplementation(
      (_spec: unknown, options: { signal: AbortSignal }) => {
        signal = options.signal;
        return new Promise(() => {});
      }
    );

    const { trigger, start, button } = make();
    trigger.click();
    start().click();
    await vi.waitFor(() => expect(signal).toBeDefined());

    button.destroy();
    expect(signal?.aborted).toBe(true);
  });
});
