import { stepIndexAt, type Timeline } from '../engine/timeline';
import { h } from './el';

/**
 * Framework-agnostic port of `components/DebugOverlay.tsx`.
 *
 * Retained-mode like the rest of `dom/`: the per-clip rows are built once, at
 * construction, and `update` only rewrites the two header lines and toggles
 * `is-active`. React rebuilt the whole list on every frame because reconciling
 * it was cheap; here mutating it is cheaper still, and the row count cannot
 * change — `timeline.clips` is fixed for a compiled spec.
 *
 * The French labels are hardcoded, exactly as React hardcodes them. Reproduced,
 * not repaired: this is a faithfulness port, and the localisation of the
 * player's chrome is a separate piece of work.
 */

export interface DebugOverlayElement {
  readonly el: HTMLElement;
  /** Moves the overlay to `t`. `activeCount` is the caller's `active.length`. */
  update(t: number, activeCount: number): void;
}

export function createDebugOverlay(timeline: Timeline): DebugOverlayElement {
  const el = h('div', { class: 'rdfa-debug' });

  // Two header lines, each `<b>label</b> value`. The text nodes are kept as
  // references so `update` can assign to `nodeValue` rather than rebuild.
  const tValue = document.createTextNode('');
  const timeLine = h('div', {}, [h('b', {}, ['t']), tValue]);

  const stepValue = document.createTextNode('');
  const activeValue = document.createTextNode('');
  const stepLine = h('div', {}, [
    h('b', {}, ['step']),
    stepValue,
    h('b', {}, ['clips actifs']),
    activeValue,
  ]);

  el.appendChild(timeLine);
  el.appendChild(stepLine);

  const rows = timeline.clips.map((clip) => {
    const row = h('div', { class: 'rdfa-debug-row' }, [
      `${clip.kind} #${clip.id} [${Math.round(clip.startMs)}–${Math.round(
        clip.endMs
      )}]`,
    ]);
    el.appendChild(row);
    return { clip, row };
  });

  const duration = Math.round(timeline.durationMs);

  return {
    el,
    update(t: number, activeCount: number) {
      tValue.nodeValue = ` ${Math.round(t)} / ${duration} ms`;
      stepValue.nodeValue = ` ${stepIndexAt(timeline, t) + 1} / ${
        timeline.steps.length
      } · `;
      activeValue.nodeValue = ` ${activeCount}`;
      for (const { clip, row } of rows) {
        const isActive = t >= clip.startMs && t <= clip.visibleUntilMs;
        row.className = `rdfa-debug-row${isActive ? ' is-active' : ''}`;
      }
    },
  };
}
