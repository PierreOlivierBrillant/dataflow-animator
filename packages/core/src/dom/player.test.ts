/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPlayer } from './player';
import type { DataFlowSpec } from '../types';

const spec: DataFlowSpec = {
  nodes: [
    { id: 'a', type: 'server', text: 'A', lane: 1 },
    { id: 'b', type: 'database', text: 'B', lane: 2 },
  ],
  packets: [{ id: 'p', kind: 'http_packet' }],
  timeline: [
    { type: 'move', id: 'm1', object: 'p', from: 'a', to: 'b', duration: 1000 },
  ],
  connections: [{ from: 'a', to: 'b' }],
};

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const player = mountPlayer(container, spec, options);
  return { container, player };
}

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('mountPlayer — the root', () => {
  it('renders .rdfa-player carrying the theme and mode', () => {
    const { player } = mount({ theme: 'blueprint', mode: 'dark' });

    expect(player.el.className).toBe('rdfa-player');
    expect(player.el.getAttribute('data-theme')).toBe('blueprint');
    expect(player.el.getAttribute('data-mode')).toBe('dark');
  });

  it('appends a caller class after its own', () => {
    const { player } = mount({ className: 'mine' });

    expect(player.el.className).toBe('rdfa-player mine');
  });

  it('takes a number height as pixels and a string verbatim', () => {
    expect(mount({ height: 300 }).player.el.style.height).toBe('300px');
    expect(mount({ height: '50vh' }).player.el.style.height).toBe('50vh');
  });

  it('holds the stage, the control bar and the transcript, in that order', () => {
    const { player } = mount();

    expect([...player.el.children].map((c) => c.getAttribute('class'))).toEqual(
      [
        'rdfa-stage',
        'rdfa-controls',
        'rdfa-transcript rdfa-transcript--collapsed',
      ]
    );
  });

  it('is a named region, so it can be found and jumped to', () => {
    expect(mount().player.el.getAttribute('role')).toBe('region');
    expect(mount().player.el.getAttribute('aria-label')).toBe(
      'Data flow animation'
    );
  });

  it("names the region after the spec's own description when it has one", () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = mountPlayer(
      container,
      { ...spec, description: 'A request reaching the database' },
      {}
    );

    expect(player.el.getAttribute('aria-label')).toBe(
      'A request reaching the database'
    );
  });

  it('hides the stage from assistive technology and describes it instead', () => {
    // The stage's labels are absolutely positioned: read in DOM order they are
    // a bag of strings, and the animation itself is nowhere in them. The
    // transcript is what carries that information, so the stage is decor.
    const { player } = mount();

    expect(
      player.el.querySelector('.rdfa-stage')?.getAttribute('aria-hidden')
    ).toBe('true');
    const steps = player.el.querySelectorAll('.rdfa-transcript-step');
    expect(steps).toHaveLength(1);
    expect(steps[0].textContent).toBe('p travels from A to B.');
  });

  it('seeks the clock to the step a reader activates, paused', () => {
    const { player } = mount({ autoPlay: true });
    const step = player.el.querySelector(
      '.rdfa-transcript-step'
    ) as HTMLButtonElement;

    player.clock.seek(900);
    step.click();

    expect(player.clock.t).toBe(0);
    expect(player.clock.playing).toBe(false);
  });

  it('announces the step the playhead is on', () => {
    const { player } = mount();
    const live = player.el.querySelector('[aria-live]');

    expect(live?.textContent).toContain('Step 1 of 1');
  });

  it('leaves the transcript out entirely when asked to', () => {
    const { player } = mount({ transcript: 'none' });

    expect(player.el.querySelector('.rdfa-transcript')).toBeNull();
    // The stage stays hidden regardless: making it readable is not something
    // this option can do, which is exactly why the docs warn against 'none'.
    expect(
      player.el.querySelector('.rdfa-stage')?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('renders the transcript open when asked to be visible', () => {
    const { player } = mount({ transcript: 'visible' });

    expect(
      player.el
        .querySelector('.rdfa-transcript')
        ?.classList.contains('rdfa-transcript--collapsed')
    ).toBe(false);
  });

  it('takes up no visible room by default, so no existing player re-flows', () => {
    const { player } = mount();

    expect(
      player.el
        .querySelector('.rdfa-transcript')
        ?.classList.contains('rdfa-transcript--collapsed')
    ).toBe(true);
  });

  // The focus ring exists only when there is something to drive with the
  // keyboard — as in React.
  it('is focusable with controls and inert without them', () => {
    expect(mount().player.el.getAttribute('tabindex')).toBe('0');
    expect(mount({ controls: false }).player.el.hasAttribute('tabindex')).toBe(
      false
    );
    expect(
      mount({ controls: false }).player.el.querySelector('.rdfa-controls')
    ).toBeNull();
  });
});

describe('mountPlayer — the clock drives the stage', () => {
  it('mutates the stage on a clock notification instead of rebuilding it', () => {
    const { player } = mount();
    const nodesBefore = [...player.el.querySelectorAll('[data-node-id]')];

    player.clock.seek(500);

    expect([...player.el.querySelectorAll('[data-node-id]')]).toEqual(
      nodesBefore
    );
    // The packet's clip is live at 500ms, so the stage really did move.
    expect(player.el.querySelector('.rdfa-packet')).not.toBeNull();
  });

  it('keeps the control bar in step with the clock', () => {
    // The compiled timeline runs 1600ms (a move carries an appearance phase),
    // and the readout rounds to whole seconds.
    const { player } = mount();

    player.clock.seek(800);

    expect(player.el.querySelector('.rdfa-time')!.textContent).toBe('1s / 2s');
    expect(
      (player.el.querySelector('.rdfa-timeline-thumb') as HTMLElement).style
        .left
    ).toBe('50%');
  });
});

describe('mountPlayer — keyboard', () => {
  const press = (
    el: HTMLElement,
    key: string,
    bubbles = false
  ): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles,
      cancelable: true,
    });
    el.dispatchEvent(event);
    return event;
  };

  it('toggles playback on space, and swallows the page scroll', () => {
    const { player } = mount();
    const toggle = vi.spyOn(player.clock, 'toggle');

    const event = press(player.el, ' ');

    expect(toggle).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps Space a shortcut over the stage, where nothing is activatable', () => {
    const { player } = mount();
    const toggle = vi.spyOn(player.clock, 'toggle');

    press(player.el.querySelector<HTMLElement>('.rdfa-stage')!, ' ', true);

    expect(toggle).toHaveBeenCalled();
  });

  // The keyboard mirrors the buttons: ArrowRight plays to the next stop like
  // the "next" button, ArrowLeft jumps back like "prev".
  it('plays to the next stop on ArrowRight and jumps back on ArrowLeft', () => {
    const { player } = mount();
    const playTo = vi.spyOn(player.clock, 'playTo');
    const pause = vi.spyOn(player.clock, 'pause');
    const seek = vi.spyOn(player.clock, 'seek');

    // Compiled stops are [300, 1300].
    // ArrowRight mirrors the "next" button: it PLAYS to the next stop.
    press(player.el, 'ArrowRight');
    expect(playTo).toHaveBeenCalledWith(300);

    // ArrowLeft mirrors "prev": pause, then jump back.
    press(player.el, 'ArrowLeft');
    expect(pause).toHaveBeenCalled();
    expect(seek).toHaveBeenLastCalledWith(0);
  });

  it('ignores other keys', () => {
    const { player } = mount();

    expect(press(player.el, 'a').defaultPrevented).toBe(false);
  });

  // The shortcuts listen on the root, so anything focused inside the chrome
  // bubbles to them. Space is the one key that CONFLICTS: it activates the
  // focused button.
  it('leaves Space to the button it is pressed on', () => {
    const { player } = mount();
    const toggle = vi.spyOn(player.clock, 'toggle');
    const next = player.el.querySelector<HTMLElement>(
      'button[aria-label="Next step"]'
    )!;

    const event = press(next, ' ', true);

    expect(toggle).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  // The arrows stay global: they compete with no activation, and they mirror
  // the buttons a keyboard user is standing on.
  it('still steps the timeline from a focused button on the arrows', () => {
    const { player } = mount();
    const playTo = vi.spyOn(player.clock, 'playTo');
    const next = player.el.querySelector<HTMLElement>(
      'button[aria-label="Next step"]'
    )!;

    press(next, 'ArrowRight', true);

    expect(playTo).toHaveBeenCalledWith(300);
  });

  it('fires no shortcut from inside the JSON dialog', () => {
    const { player } = mount({ exportable: true });
    (
      player.el.querySelector(
        'button[aria-label="JSON specification"]'
      ) as HTMLElement
    ).click();
    const toggle = vi.spyOn(player.clock, 'toggle');
    const playTo = vi.spyOn(player.clock, 'playTo');
    const pre = player.el.querySelector<HTMLElement>('pre.rdfa-dialog-code')!;

    // The dialog is modal, and its code panel scrolls — the arrows belong to
    // that scroll, not to the timeline behind the modal.
    press(pre, ' ', true);
    press(pre, 'ArrowRight', true);

    expect(toggle).not.toHaveBeenCalled();
    expect(playTo).not.toHaveBeenCalled();
  });

  it('binds nothing when the controls are off', () => {
    const { player } = mount({ controls: false });
    const toggle = vi.spyOn(player.clock, 'toggle');

    press(player.el, ' ');

    expect(toggle).not.toHaveBeenCalled();
  });
});

describe('mountPlayer — the export slot', () => {
  it('is absent unless the player is exportable', () => {
    expect(
      mount().player.el.querySelector('[aria-label="JSON specification"]')
    ).toBeNull();
  });

  it('opens and closes the JSON dialog', () => {
    const { player } = mount({ exportable: true });
    const open = player.el.querySelector(
      'button[aria-label="JSON specification"]'
    ) as HTMLButtonElement;

    open.click();
    const dialog = player.el.querySelector('.rdfa-dialog-overlay')!;
    expect(dialog).not.toBeNull();

    (dialog.querySelector('button[aria-label="Close"]') as HTMLElement).click();
    expect(player.el.querySelector('.rdfa-dialog-overlay')).toBeNull();
  });

  it('does not stack dialogs when the button is pressed twice', () => {
    const { player } = mount({ exportable: true });
    const open = player.el.querySelector(
      'button[aria-label="JSON specification"]'
    ) as HTMLButtonElement;

    open.click();
    open.click();

    expect(player.el.querySelectorAll('.rdfa-dialog-overlay')).toHaveLength(1);
  });
});

describe('mountPlayer — labels', () => {
  const byLabel = (root: Element, label: string): HTMLButtonElement | null =>
    root.querySelector(`button[aria-label="${label}"]`);

  it('publishes English chrome by default', () => {
    const { player } = mount({ exportable: true });

    for (const label of [
      'Restart from the beginning',
      'Play',
      'Previous step',
      'Next step',
      'Progress bar',
      'JSON specification',
      'Fullscreen',
    ])
      expect(byLabel(player.el, label)).not.toBeNull();
  });

  it('overrides only the keys given, keeping the defaults for the rest', () => {
    const { player } = mount({
      exportable: true,
      labels: { nextStep: 'Étape suivante', jsonSpec: 'Spécification JSON' },
    });

    expect(byLabel(player.el, 'Étape suivante')).not.toBeNull();
    expect(byLabel(player.el, 'Next step')).toBeNull();
    // The JSON button carries the override in both attributes.
    const json = byLabel(player.el, 'Spécification JSON')!;
    expect(json.getAttribute('title')).toBe('Spécification JSON');
    // Untouched keys stay English.
    expect(byLabel(player.el, 'Restart from the beginning')).not.toBeNull();
  });

  it('relabels the clock-driven buttons with the overrides', () => {
    const { player } = mount({ labels: { play: 'Lecture', pause: 'Pause*' } });

    const playBtn = byLabel(player.el, 'Lecture')!;
    expect(playBtn).not.toBeNull();
    player.clock.play();
    expect(playBtn.getAttribute('aria-label')).toBe('Pause*');
  });

  it('reaches the JSON dialog — title, buttons and backdrop', () => {
    const { player } = mount({
      exportable: true,
      labels: {
        jsonSpec: 'Spécification JSON',
        download: 'Télécharger le JSON',
        closeDialog: 'Fermer la fenêtre',
      },
    });

    byLabel(player.el, 'Spécification JSON')!.click();

    const overlay = player.el.querySelector('.rdfa-dialog-overlay')!;
    expect(overlay.getAttribute('aria-label')).toBe('Spécification JSON');
    expect(player.el.querySelector('.rdfa-dialog-title')!.textContent).toBe(
      'Spécification JSON'
    );
    expect(byLabel(player.el, 'Télécharger le JSON')).not.toBeNull();
    expect(
      player.el
        .querySelector('.rdfa-dialog-backdrop')!
        .getAttribute('aria-label')
    ).toBe('Fermer la fenêtre');
    // An untouched dialog key keeps its English default.
    expect(byLabel(player.el, 'Close')).not.toBeNull();
  });
});

describe('mountPlayer — full screen', () => {
  it('requests full screen on the root, and exits only when the root itself is full screen', () => {
    const { player } = mount();
    const request = vi.fn();
    player.el.requestFullscreen = request;
    const exit = vi.fn();
    Object.defineProperty(document, 'exitFullscreen', {
      value: exit,
      configurable: true,
    });
    const btn = player.el.querySelector(
      'button[aria-label="Fullscreen"]'
    ) as HTMLButtonElement;

    // Nothing full screen → request it on the root.
    btn.click();
    expect(request).toHaveBeenCalledTimes(1);

    // ANOTHER element is full screen → not ours to collapse; request again.
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.createElement('div'),
      configurable: true,
    });
    btn.click();
    expect(exit).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(2);

    // THIS player is the full-screen element → now exit.
    Object.defineProperty(document, 'fullscreenElement', {
      value: player.el,
      configurable: true,
    });
    btn.click();
    expect(exit).toHaveBeenCalled();
  });

  it('relabels the button when the document enters full screen', () => {
    const { player } = mount();
    Object.defineProperty(document, 'fullscreenElement', {
      value: player.el,
      configurable: true,
    });

    document.dispatchEvent(new Event('fullscreenchange'));

    expect(
      player.el.querySelector('button[aria-label="Exit fullscreen"]')
    ).not.toBeNull();
  });
});

describe('mountPlayer — teardown', () => {
  it('detaches everything and stops driving the stage', () => {
    const { container, player } = mount({ exportable: true });
    (
      player.el.querySelector(
        'button[aria-label="JSON specification"]'
      ) as HTMLElement
    ).click();

    player.destroy();

    expect(container.children).toHaveLength(0);
    // A notification arriving after teardown must not reach the detached tree.
    expect(() => player.clock.seek(500)).not.toThrow();
  });

  it('removes its document-level listener', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { player } = mount();

    player.destroy();

    expect(remove).toHaveBeenCalledWith(
      'fullscreenchange',
      expect.any(Function)
    );
  });

  // Retained mode plus a live clock is the combination that leaks.
  it('leaves nothing behind over repeated mount/destroy cycles', () => {
    for (let i = 0; i < 20; i++) {
      const { container, player } = mount({ exportable: true });
      player.clock.seek(400);
      player.destroy();
      container.remove();
    }

    expect(document.body.children).toHaveLength(0);
  });
});

describe('mountPlayer — initialT', () => {
  it('opens at the instant asked for, stage and control bar together', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = mountPlayer(container, spec, { initialT: 800 });

    expect(player.clock.t).toBe(800);
    // The bar is written from the clock exactly once at construction, before
    // anything is subscribed — so a clock seeded late would leave it at 0.
    expect(player.el.querySelector('.rdfa-time')!.textContent).toBe('1s / 2s');
    expect(
      (player.el.querySelector('.rdfa-timeline-thumb') as HTMLElement).style
        .left
    ).toBe('50%');
  });

  // The regression this option exists for: mounting at 0 and seeking to `t`
  // captures the icon→panel anchor at 0 and walks there, which is a DIFFERENT
  // (and equally legitimate) rendering from opening at `t`. The A/B gate
  // compares against a React render at `t`, so the player has to open there.
  it('is not equivalent to mounting at 0 and seeking afterwards', () => {
    const direct = document.createElement('div');
    document.body.appendChild(direct);
    const a = mountPlayer(direct, spec, { initialT: 800 });

    const walked = document.createElement('div');
    document.body.appendChild(walked);
    const b = mountPlayer(walked, spec);
    b.clock.seek(800);

    // Both land on the same instant...
    expect(a.clock.t).toBe(b.clock.t);
    // ...and jsdom lays nothing out, so the two agree here. The distinction is
    // geometric and is asserted by compare.ab.spec.ts's chrome cells; this test
    // pins the API contract that makes it expressible at all.
    expect(a.el.querySelector('.rdfa-time')!.textContent).toBe(
      b.el.querySelector('.rdfa-time')!.textContent
    );
  });
});

describe('mountPlayer — options that reach the stage', () => {
  // `density` used to be declared here and dropped on the floor: the stage
  // hardcoded 'comfortable'. `'spacious'` was not even expressible.
  it('forwards density, including spacious', () => {
    const scale = (density: 'compact' | 'comfortable' | 'spacious') =>
      mount({ density })
        .player.el.querySelector<HTMLElement>('.rdfa-stage')
        ?.style.getPropertyValue('--rdfa-scale');

    expect(scale('spacious')).not.toBe(scale('compact'));
    expect(scale('spacious')).not.toBe(scale('comfortable'));
  });

  it('forwards the highlighter to panel content, not just the JSON dialog', () => {
    const highlight = vi.fn(() => '<em>x</em>');
    const container = document.createElement('div');
    document.body.appendChild(container);

    mountPlayer(
      container,
      {
        ...spec,
        nodes: [
          {
            id: 'a',
            type: 'simple_node',
            text: 'A',
            lane: 1,
            content: { type: 'code', value: 'SELECT 1', language: 'sql' },
          },
        ],
        packets: [],
        timeline: [],
        connections: [],
      },
      { highlight }
    );

    expect(highlight).toHaveBeenCalledWith('SELECT 1', 'sql');
  });

  it('renders the debug overlay only when asked', () => {
    expect(mount().player.el.querySelector('.rdfa-debug')).toBeNull();
    expect(
      mount({ debug: true }).player.el.querySelector('.rdfa-debug')
    ).not.toBeNull();
  });
});

describe('mountPlayer — style and warnings', () => {
  it('applies extra styles to the root', () => {
    const { player } = mount({ style: { border: '2px solid red' } });

    expect(player.el.style.border).toBe('2px solid red');
  });

  // `style` lands after height/width so a caller can override them, and before
  // the root is inserted so the first measurement sees the final box.
  it('lets style override height', () => {
    const { player } = mount({ height: 300, style: { height: '99px' } });

    expect(player.el.style.height).toBe('99px');
  });

  it('exposes the compile warnings rather than making the caller recompile', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // A `keep_until` pointing at an action that does not exist is one of the
    // things the compiler warns about.
    const player = mountPlayer(container, {
      ...spec,
      timeline: [
        {
          type: 'move',
          id: 'm1',
          object: 'p',
          from: 'a',
          to: 'b',
          keep_until: 'ghost',
        },
      ],
    });

    expect(player.warnings.length).toBeGreaterThan(0);
  });

  it('reports no warnings for a clean spec', () => {
    expect(mount().player.warnings).toEqual([]);
  });
});
