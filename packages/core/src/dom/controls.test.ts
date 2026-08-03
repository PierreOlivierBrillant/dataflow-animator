/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyControlsElement, createControlsElement } from './controls';
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

  it('places the export slot between the readout and full screen', () => {
    const clock = createPlayerClock({ durationMs: 1000 });
    const slot = document.createElement('button');
    slot.setAttribute('aria-label', 'JSON specification');
    const ctl = createControlsElement({
      clock,
      timeline: timeline([]),
      labels: DEFAULT_PLAYER_LABELS,
      onToggleFullscreen: () => {},
      exportSlot: slot,
    });
    applyControlsElement(ctl, clock, false);

    const labels = buttons(ctl.el).map((b) => b.getAttribute('aria-label'));
    expect(labels.slice(-2)).toEqual(['JSON specification', 'Fullscreen']);
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

  it('tracks the cursor with the fill and the thumb', () => {
    const { ctl, clock } = make();
    clock.seek(250);
    applyControlsElement(ctl, clock, false);

    expect(ctl.fill.style.width).toBe('25%');
    expect(ctl.thumb.style.left).toBe('25%');
  });

  it('leaves the ratio at 0 for a zero-length timeline', () => {
    const { ctl, clock } = make({ durationMs: 0 });
    applyControlsElement(ctl, clock, false);

    expect(ctl.fill.style.width).toBe('0%');
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

  it('seeks from the pointer position along the scrub bar', () => {
    const { ctl, clock } = make();
    const scrub = ctl.el.querySelector('.rdfa-timeline')!;
    vi.spyOn(scrub, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    const seek = vi.spyOn(clock, 'seek');

    scrub.dispatchEvent(new MouseEvent('click', { clientX: 50 }));

    expect(seek).toHaveBeenCalledWith(250);
  });

  it('clamps a pointer landing outside the bar', () => {
    const { ctl, clock } = make();
    const scrub = ctl.el.querySelector('.rdfa-timeline')!;
    vi.spyOn(scrub, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 200,
    } as DOMRect);
    const seek = vi.spyOn(clock, 'seek');

    scrub.dispatchEvent(new MouseEvent('click', { clientX: 400 }));

    expect(seek).toHaveBeenCalledWith(1000);
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

    expect(ctl.thumb.style.left).toBe('75%');
  });
});
