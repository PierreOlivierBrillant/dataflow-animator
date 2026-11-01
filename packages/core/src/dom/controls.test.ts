/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyControlsElement,
  createControlsElement,
  type ControlsElement,
} from './controls';
import { createPlayerClock, type PlayerClock } from './clock';
import { DEFAULT_PLAYER_LABELS } from './labels';
import type { Timeline } from '../engine/timeline';

const timeline = (stops: number[], durationMs = 1000): Timeline =>
  ({ clips: [], durationMs, stops }) as unknown as Timeline;

function make(over: { stops?: number[]; durationMs?: number } = {}) {
  const durationMs = over.durationMs ?? 1000;
  const clock = createPlayerClock({ durationMs });
  const tl = timeline(over.stops ?? [250, 500, 750], durationMs);
  const onToggleFullscreen = vi.fn();
  const ctl = createControlsElement({
    clock,
    timeline: tl,
    labels: DEFAULT_PLAYER_LABELS,
    onToggleFullscreen,
  });
  applyControlsElement(ctl, clock, false);
  document.body.appendChild(ctl.el);
  return { ctl, clock, onToggleFullscreen };
}

/**
 * jsdom implements neither `PointerEvent` nor pointer capture, so a pointer
 * event is a `MouseEvent` carrying the type, plus a `pointerId`.
 */
const pointer = (
  target: Element,
  type: string,
  clientX = 0,
  pointerId = 1
): void => {
  const event = new MouseEvent(type, { clientX, button: 0, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
};

/** The scrub bar, laid out 200px wide from x=0 and able to capture a pointer. */
const scrubOf = (ctl: ControlsElement): HTMLButtonElement => {
  vi.spyOn(ctl.scrub, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width: 200,
  } as DOMRect);
  ctl.scrub.setPointerCapture = vi.fn();
  return ctl.scrub;
};

const progress = (ctl: ControlsElement): string =>
  ctl.scrub.style.getPropertyValue('--rdfa-progress');

const buttons = (root: Element): HTMLButtonElement[] =>
  [...root.querySelectorAll('button')] as HTMLButtonElement[];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createControlsElement — accessibility surface', () => {
  // The pixel gates cannot see any of this, which is why it is asserted here.
  it('exposes the buttons in React`s focus order, with its labels', () => {
    const { ctl } = make();

    expect(buttons(ctl.el).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Restart from the beginning',
      'Play',
      'Previous step',
      'Next step',
      'Progress bar',
      'Fullscreen',
    ]);
  });

  it('places the action slots between the readout and full screen', () => {
    const clock = createPlayerClock({ durationMs: 1000 });
    const slot = document.createElement('button');
    slot.setAttribute('aria-label', 'JSON specification');
    const ctl = createControlsElement({
      clock,
      timeline: timeline([]),
      labels: DEFAULT_PLAYER_LABELS,
      onToggleFullscreen: () => {},
      actionSlots: [slot],
    });
    applyControlsElement(ctl, clock, false);

    const labels = buttons(ctl.el).map((b) => b.getAttribute('aria-label'));
    expect(labels.slice(-2)).toEqual(['JSON specification', 'Fullscreen']);
  });

  it('keeps several action slots in the order they were given', () => {
    const clock = createPlayerClock({ durationMs: 1000 });
    const make = (label: string): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', label);
      return btn;
    };
    const ctl = createControlsElement({
      clock,
      timeline: timeline([]),
      labels: DEFAULT_PLAYER_LABELS,
      onToggleFullscreen: () => {},
      actionSlots: [make('JSON specification'), make('Export the animation')],
    });
    applyControlsElement(ctl, clock, false);

    const labels = buttons(ctl.el).map((b) => b.getAttribute('aria-label'));
    expect(labels.slice(-3)).toEqual([
      'JSON specification',
      'Export the animation',
      'Fullscreen',
    ]);
  });

  it('mirrors every aria-label into a title, as React does', () => {
    const { ctl } = make();

    for (const btn of buttons(ctl.el)) {
      const label = btn.getAttribute('aria-label');
      // The scrub bar is the one control React gives no title.
      if (label === 'Progress bar') {
        expect(btn.hasAttribute('title')).toBe(false);
        continue;
      }
      expect(btn.getAttribute('title')).toBe(label);
    }
  });

  it('gives every button type=button so none submits a surrounding form', () => {
    const { ctl } = make();

    for (const btn of buttons(ctl.el)) expect(btn.type).toBe('button');
  });

  it('marks the icons aria-hidden so the label is the only announced text', () => {
    const { ctl } = make();

    for (const svg of ctl.el.querySelectorAll('svg'))
      expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  // A scrub bar, not a range input: swapping it would change the whole
  // accessibility tree and every pixel of the control.
  it('renders the scrub bar as a button with a track, fill, steps and thumb', () => {
    const { ctl } = make();
    const scrub = ctl.el.querySelector('.rdfa-timeline')!;

    expect(scrub.tagName).toBe('BUTTON');
    expect(scrub.querySelector('.rdfa-timeline-track')).not.toBeNull();
    expect(scrub.querySelector('.rdfa-timeline-fill')).not.toBeNull();
    expect(scrub.querySelector('.rdfa-timeline-thumb')).not.toBeNull();
    expect(scrub.querySelectorAll('.rdfa-timeline-step')).toHaveLength(3);
  });

  // A button that reports a position has to say so: bare, it announces none.
  it('gives the scrub bar slider semantics over its button markup', () => {
    const { ctl } = make({ durationMs: 12_000 });
    const scrub = ctl.el.querySelector('.rdfa-timeline')!;

    expect(scrub.getAttribute('role')).toBe('slider');
    expect(scrub.getAttribute('aria-valuemin')).toBe('0');
    expect(scrub.getAttribute('aria-valuemax')).toBe('12000');
    expect(scrub.getAttribute('aria-valuenow')).toBe('0');
  });

  it('filters step ticks strictly inside the timeline', () => {
    // A stop at 0 or at the very end would sit under the thumb's rest states.
    const { ctl } = make({ stops: [0, 500, 1000] });

    expect(ctl.el.querySelectorAll('.rdfa-timeline-step')).toHaveLength(1);
  });
});

describe('applyControlsElement — the clock-driven state', () => {
  it('renders the readout as three separate text nodes', () => {
    const { ctl } = make({ durationMs: 12_000 });
    const time = ctl.el.querySelector('.rdfa-time')!;

    expect([...time.childNodes].map((n) => n.nodeValue)).toEqual([
      '0s',
      ' / ',
      '12s',
    ]);
  });

  it('rounds the readout to whole seconds', () => {
    const { ctl, clock } = make({ durationMs: 12_000 });
    clock.seek(3400);
    applyControlsElement(ctl, clock, false);

    expect(ctl.el.querySelector('.rdfa-time')!.textContent).toBe('3s / 12s');
  });

  // The fill and the thumb are both derived from this one ratio by the
  // stylesheet — the thumb through a transform, which jsdom cannot lay out.
  it('tracks the cursor with the progress ratio', () => {
    const { ctl, clock } = make();
    clock.seek(250);
    applyControlsElement(ctl, clock, false);

    expect(progress(ctl)).toBe('0.25');
  });

  it('leaves the ratio at 0 for a zero-length timeline', () => {
    const { ctl, clock } = make({ durationMs: 0 });
    applyControlsElement(ctl, clock, false);

    expect(progress(ctl)).toBe('0');
  });

  it('swaps the play button label and icon with the clock state', () => {
    const { ctl, clock } = make();
    expect(ctl.playBtn.getAttribute('aria-label')).toBe('Play');
    const iconWhilePaused = ctl.playBtn.firstElementChild;

    clock.play();
    applyControlsElement(ctl, clock, false);

    expect(ctl.playBtn.getAttribute('aria-label')).toBe('Pause');
    expect(ctl.playBtn.getAttribute('title')).toBe('Pause');
    expect(ctl.playBtn.firstElementChild).not.toBe(iconWhilePaused);
  });

  it('swaps the full-screen label with the mode', () => {
    const { ctl, clock } = make();
    applyControlsElement(ctl, clock, true);

    expect(ctl.fullscreenBtn.getAttribute('aria-label')).toBe(
      'Exit fullscreen'
    );
  });

  it('keeps the slider value on the clock, in whole milliseconds', () => {
    const { ctl, clock } = make({ durationMs: 12_000 });
    clock.seek(3400.6);
    applyControlsElement(ctl, clock, false);

    expect(ctl.scrub.getAttribute('aria-valuenow')).toBe('3401');
  });

  it('leaves the swapped subtrees untouched when nothing changed', () => {
    const { ctl, clock } = make();
    const icon = ctl.playBtn.firstElementChild;

    applyControlsElement(ctl, clock, false);

    expect(ctl.playBtn.firstElementChild).toBe(icon);
  });
});

describe('createControlsElement — wiring', () => {
  const click = (root: Element, label: string): void => {
    buttons(root)
      .find((b) => b.getAttribute('aria-label') === label)!
      .click();
  };

  it('restarts, toggles and steps the clock', () => {
    const { ctl, clock } = make();
    const restart = vi.spyOn(clock, 'restart');
    const toggle = vi.spyOn(clock, 'toggle');

    click(ctl.el, 'Restart from the beginning');
    // Paused at rest, so the toggle is still labelled "Play".
    click(ctl.el, 'Play');
    expect(restart).toHaveBeenCalled();
    expect(toggle).toHaveBeenCalled();
  });

  it('JUMPS to the previous stop but PLAYS to the next one', () => {
    // Reproduced from React rather than harmonised — see the module header.
    const { ctl, clock } = make();
    const seek = vi.spyOn(clock, 'seek');
    const playTo = vi.spyOn(clock, 'playTo');

    clock.seek(600);
    seek.mockClear();
    click(ctl.el, 'Previous step');
    expect(seek).toHaveBeenCalledWith(500);

    click(ctl.el, 'Next step');
    expect(playTo).toHaveBeenCalledWith(750);
  });

  it('seeks from the pointer position as soon as the bar is pressed', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);
    const seek = vi.spyOn(clock, 'seek');

    pointer(scrub, 'pointerdown', 50);

    expect(seek).toHaveBeenCalledWith(250);
    expect(scrub.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('drags the playhead while the pointer is held, and only then', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);

    pointer(scrub, 'pointerdown', 50);
    pointer(scrub, 'pointermove', 120);
    expect(clock.t).toBe(600);

    // Clamped: a captured drag keeps reporting once it leaves the bar.
    pointer(scrub, 'pointermove', 400);
    expect(clock.t).toBe(1000);

    pointer(scrub, 'pointerup', 400);
    pointer(scrub, 'pointermove', 20);
    expect(clock.t).toBe(1000);
  });

  it('ignores the moves of another pointer during a drag', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);

    pointer(scrub, 'pointerdown', 50, 1);
    pointer(scrub, 'pointermove', 150, 2);

    expect(clock.t).toBe(250);
  });

  it('suspends playback during a drag and resumes it on release', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);
    clock.play();

    pointer(scrub, 'pointerdown', 50);
    expect(clock.playing).toBe(false);

    pointer(scrub, 'pointermove', 100);
    pointer(scrub, 'pointerup', 100);
    expect(clock.playing).toBe(true);
    expect(clock.t).toBe(500);
  });

  it('leaves a paused clock paused after a drag', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);

    pointer(scrub, 'pointerdown', 50);
    pointer(scrub, 'pointerup', 50);

    expect(clock.playing).toBe(false);
  });

  // `play()` from the end rewinds to 0, which would undo the drag.
  it('does not resume a drag dropped at the very end', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);
    clock.play();

    pointer(scrub, 'pointerdown', 400);
    pointer(scrub, 'pointercancel', 400);

    expect(clock.playing).toBe(false);
    expect(clock.t).toBe(1000);
  });

  it('ends a drag whose capture is taken away', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);

    pointer(scrub, 'pointerdown', 50);
    pointer(scrub, 'lostpointercapture', 50);
    pointer(scrub, 'pointermove', 150);
    expect(clock.t).toBe(250);

    // …and a fresh press starts a new one, rather than meeting a stale guard.
    pointer(scrub, 'pointerdown', 150);
    expect(clock.t).toBe(750);
  });

  it('starts no drag from a secondary button', () => {
    const { ctl, clock } = make();
    const scrub = scrubOf(ctl);
    const seek = vi.spyOn(clock, 'seek');

    scrub.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: 50, button: 2 })
    );

    expect(seek).not.toHaveBeenCalled();
  });

  it('hands the focus to its host instead of keeping it', () => {
    const clock = createPlayerClock({ durationMs: 1000 });
    const host = document.createElement('div');
    host.tabIndex = 0;
    const ctl = createControlsElement({
      clock,
      timeline: timeline([]),
      labels: DEFAULT_PLAYER_LABELS,
      onToggleFullscreen: () => {},
      focusHost: host,
    });
    host.appendChild(ctl.el);
    document.body.appendChild(host);
    const scrub = scrubOf(ctl);
    const mousedown = new MouseEvent('mousedown', { cancelable: true });

    pointer(scrub, 'pointerdown', 50);
    scrub.dispatchEvent(mousedown);

    expect(document.activeElement).toBe(host);
    // The default action of `mousedown` is what would focus the bar.
    expect(mousedown.defaultPrevented).toBe(true);
  });

  // The bar is a <button>, so Enter and Space on it synthesise a click that
  // carries no pointer: clientX is 0, which would read as "seek to the very
  // start" — seeking listens to pointer events only.
  it('does NOT seek from a keyboard activation of the scrub bar', () => {
    const { ctl, clock } = make();
    clock.seek(600);
    const seek = vi.spyOn(clock, 'seek');

    ctl.scrub.dispatchEvent(new MouseEvent('click', { detail: 0 }));

    expect(seek).not.toHaveBeenCalled();
    expect(clock.t).toBe(600);
  });

  it('reports a full-screen request to its caller', () => {
    const { ctl, onToggleFullscreen } = make();

    click(ctl.el, 'Fullscreen');

    expect(onToggleFullscreen).toHaveBeenCalled();
  });
});

// Kept honest against the module's own claim.
describe('controls — the clock is the single source of truth', () => {
  it('reflects a seek performed outside the bar', () => {
    const { ctl, clock } = make();
    const advance = (c: PlayerClock) => c.seek(750);

    advance(clock);
    applyControlsElement(ctl, clock, false);

    expect(progress(ctl)).toBe('0.75');
  });
});
