import type { AnimationDescription } from '../a11y/describe';
import type { PlayerLabels } from './labels';
import { h } from './el';

/**
 * The animation's text description, as a control rather than a caption.
 *
 * Two things live here, and the second is the one that matters.
 *
 * The first is a SUMMARY plus an ordered list of steps — the animation as
 * prose, for a reader who cannot see the stage. That much is a transcript.
 *
 * The second is that each step is a BUTTON that seeks the clock to that step.
 * A transcript is something you read INSTEAD of watching; this is a way of
 * driving the same player, so a screen-reader user moves through the animation
 * at their own pace, in whichever order they like, and the picture a sighted
 * colleague is looking at follows along. That is the difference between an
 * accessible equivalent and an accommodation parked next to the real thing.
 *
 * Closed, the WHOLE section is visually hidden — the disclosure button
 * included. That is what keeps the visible layout of every existing player
 * byte-identical to what it was before this element existed: a button sitting
 * above the control bar would have re-flowed the stage of every player in the
 * wild. It is never `display: none`, which would take it out of the
 * accessibility tree, and it is never removed from the tab order either: a
 * keyboard user reaching it reveals it, exactly like a skip link.
 */

export interface TranscriptElement {
  readonly el: HTMLElement;
  /** Announces the step the playhead has entered. `-1` clears the region. */
  setCurrentStep(index: number): void;
  destroy(): void;
}

export interface TranscriptOptions {
  description: AnimationDescription;
  labels: PlayerLabels;
  /** Rendered open, for a caller that wants the description always visible. */
  visible: boolean;
  /** Seeks the player to a step the reader activated. */
  onSeek: (startMs: number) => void;
}

export function createTranscriptElement(
  options: TranscriptOptions
): TranscriptElement {
  const { description, labels, visible, onSeek } = options;
  const total = description.steps.length;

  const summary = h('p', { class: 'rdfa-transcript-summary' }, [
    description.summary,
  ]);

  const list = h('ol', { class: 'rdfa-transcript-steps' });
  const stepButtons: HTMLButtonElement[] = [];

  description.steps.forEach((step, position) => {
    const n = String(position + 1);
    const button = h(
      'button',
      {
        type: 'button',
        class: 'rdfa-transcript-step',
        // The visible text is the sentence alone; the accessible name adds the
        // position, which a sighted reader gets from the ordered list's own
        // numbering and a screen-reader user would otherwise have to count.
        'aria-label': labels.transcriptStep
          .replace('{n}', n)
          .replace('{total}', String(total))
          .replace('{text}', step.text),
      },
      [step.text]
    );
    button.addEventListener('click', () => onSeek(step.startMs));
    stepButtons.push(button);
    list.appendChild(h('li', undefined, [button]));
  });

  // `aria-live="polite"` and NOT `assertive`: playback crosses a step every
  // second or two, and an assertive region would interrupt the reader
  // mid-sentence every time. Polite queues behind whatever they are reading,
  // which is also why the region matters most during step-by-step navigation
  // rather than continuous playback.
  const liveRegion = h('p', {
    class: 'rdfa-sr-only',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  const body = h('div', { class: 'rdfa-transcript-body' }, [summary, list]);

  const toggle = h(
    'button',
    {
      type: 'button',
      class: 'rdfa-transcript-toggle',
      'aria-expanded': visible ? 'true' : 'false',
    },
    [visible ? labels.hideTranscript : labels.showTranscript]
  );

  let open = visible;
  const applyOpen = (): void => {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? labels.hideTranscript : labels.showTranscript;
    // A class, not `hidden`: closed means "clipped out of sight", which keeps
    // every step reachable by a screen reader and by the keyboard. Collapsing
    // them out of the accessibility tree is precisely what this element exists
    // to avoid.
    el.setAttribute(
      'class',
      open ? 'rdfa-transcript' : 'rdfa-transcript rdfa-transcript--collapsed'
    );
  };
  const onToggle = (): void => {
    open = !open;
    applyOpen();
  };
  toggle.addEventListener('click', onToggle);

  const el = h(
    'section',
    { class: 'rdfa-transcript', 'aria-label': labels.transcriptTitle },
    [toggle, body, liveRegion]
  );
  applyOpen();

  let announced = -1;

  return {
    el,

    setCurrentStep(index: number) {
      // Only the CROSSING is announced. `update(t)` runs every frame, and
      // rewriting the live region with the same sentence would make some
      // screen readers repeat it.
      if (index === announced) return;
      announced = index;

      for (const [position, button] of stepButtons.entries()) {
        // `aria-current`, not a class: "which step am I on" is state, and a
        // reader who cannot see the highlight still needs the answer.
        if (position === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      }

      const step = description.steps[index];
      liveRegion.textContent =
        step === undefined
          ? ''
          : labels.stepAnnouncement
              .replace('{n}', String(index + 1))
              .replace('{total}', String(total))
              .replace('{text}', step.text);
    },

    destroy() {
      toggle.removeEventListener('click', onToggle);
      el.remove();
    },
  };
}
