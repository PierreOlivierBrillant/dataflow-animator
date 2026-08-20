// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLAYER_LABELS } from './labels';
import { createTranscriptElement } from './transcriptElement';
import type { AnimationDescription } from '../a11y/describe';

const description: AnimationDescription = {
  summary: 'Elements: Browser, Web server. 2 steps.',
  steps: [
    {
      index: 0,
      startMs: 0,
      text: 'GET /users travels from Browser to Web server.',
    },
    { index: 1, startMs: 1200, text: 'Web server is working.' },
  ],
};

function build(visible = false, onSeek = vi.fn()) {
  const element = createTranscriptElement({
    description,
    labels: DEFAULT_PLAYER_LABELS,
    visible,
    onSeek,
  });
  return { element, onSeek };
}

describe('createTranscriptElement', () => {
  it('renders one activatable button per step', () => {
    const { element } = build();
    const buttons = element.el.querySelectorAll('button.rdfa-transcript-step');

    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe(description.steps[0].text);
  });

  it('names each step with its position, which the sentence alone lacks', () => {
    const { element } = build();
    const first = element.el.querySelector('button.rdfa-transcript-step');

    expect(first?.getAttribute('aria-label')).toBe(
      'Step 1 of 2: GET /users travels from Browser to Web server.'
    );
  });

  it('seeks to the step the reader activates', () => {
    const { element, onSeek } = build();
    const buttons = element.el.querySelectorAll<HTMLButtonElement>(
      '.rdfa-transcript-step'
    );

    buttons[1].click();

    expect(onSeek).toHaveBeenCalledWith(1200);
  });

  it('announces the current step and marks it with aria-current', () => {
    const { element } = build();
    const live = element.el.querySelector('[aria-live]');

    element.setCurrentStep(1);

    expect(live?.textContent).toBe('Step 2 of 2. Web server is working.');
    const marked = element.el.querySelectorAll('[aria-current="step"]');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe('Web server is working.');
  });

  it('rewrites the live region only when the step actually changes', () => {
    const { element } = build();
    const live = element.el.querySelector('[aria-live]') as HTMLElement;

    element.setCurrentStep(0);
    const first = live.textContent;
    live.textContent = 'sentinel';
    // `update(t)` runs every frame; re-announcing an unchanged step is what
    // makes some screen readers repeat the sentence over and over.
    element.setCurrentStep(0);

    expect(live.textContent).toBe('sentinel');
    expect(first).toContain('Step 1 of 2');
  });

  it('clears the announcement when the playhead is on no step', () => {
    const { element } = build();

    element.setCurrentStep(0);
    element.setCurrentStep(-1);

    expect(element.el.querySelector('[aria-live]')?.textContent).toBe('');
    expect(element.el.querySelectorAll('[aria-current="step"]')).toHaveLength(
      0
    );
  });

  it('clips the whole section when closed, button included', () => {
    // The disclosure button is hidden TOO: left visible it would sit above the
    // control bar of every player in the wild and re-flow its stage. Closed
    // means "occupies nothing", not "shows a small affordance".
    const { element } = build(false);

    expect(element.el.classList.contains('rdfa-transcript--collapsed')).toBe(
      true
    );
    expect(element.el.hasAttribute('hidden')).toBe(false);
    expect(
      element.el
        .querySelector('.rdfa-transcript-toggle')
        ?.hasAttribute('hidden')
    ).toBe(false);
  });

  it('keeps every step in the accessibility tree and the tab order while closed', () => {
    const { element } = build(false);

    // Clipped, not removed: `display: none` here would hide the description
    // from the readers it exists for.
    expect(
      element.el.querySelectorAll('button.rdfa-transcript-step')
    ).toHaveLength(2);
    expect(element.el.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(element.el.querySelector('[tabindex="-1"]')).toBeNull();
  });

  it('opens on demand and reports the state through aria-expanded', () => {
    const { element } = build(false);
    const toggle = element.el.querySelector(
      'button.rdfa-transcript-toggle'
    ) as HTMLButtonElement;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(element.el.classList.contains('rdfa-transcript--collapsed')).toBe(
      false
    );
  });

  it('renders open when asked to be visible', () => {
    const { element } = build(true);

    expect(element.el.classList.contains('rdfa-transcript--collapsed')).toBe(
      false
    );
    expect(
      element.el.querySelector('.rdfa-transcript-toggle')?.textContent
    ).toBe('Hide the text description');
  });
});
