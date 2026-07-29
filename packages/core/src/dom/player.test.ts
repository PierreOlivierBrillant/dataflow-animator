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

  it('holds the stage and the control bar, in that order', () => {
    const { player } = mount();

    expect([...player.el.children].map((c) => c.getAttribute('class'))).toEqual(
      ['rdfa-stage', 'rdfa-controls']
    );
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
  const press = (el: HTMLElement, key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
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

  // The arrows JUMP, where the "next" BUTTON plays to the stop. React's
  // asymmetry, reproduced deliberately.
  it('jumps between stops on the arrows, pausing first', () => {
    const { player } = mount();
    const pause = vi.spyOn(player.clock, 'pause');
    const seek = vi.spyOn(player.clock, 'seek');

    // Compiled stops are [300, 1300].
    press(player.el, 'ArrowRight');
    expect(pause).toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(300);

    press(player.el, 'ArrowLeft');
    expect(seek).toHaveBeenLastCalledWith(0);
  });

  it('ignores other keys', () => {
    const { player } = mount();

    expect(press(player.el, 'a').defaultPrevented).toBe(false);
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
      mount().player.el.querySelector('[aria-label="Spécification JSON"]')
    ).toBeNull();
  });

  it('opens and closes the JSON dialog', () => {
    const { player } = mount({ exportable: true });
    const open = player.el.querySelector(
      'button[aria-label="Spécification JSON"]'
    ) as HTMLButtonElement;

    open.click();
    const dialog = player.el.querySelector('.rdfa-dialog-overlay')!;
    expect(dialog).not.toBeNull();

    (
      dialog.querySelector('button[aria-label="Fermer"]') as HTMLElement
    ).click();
    expect(player.el.querySelector('.rdfa-dialog-overlay')).toBeNull();
  });

  it('does not stack dialogs when the button is pressed twice', () => {
    const { player } = mount({ exportable: true });
    const open = player.el.querySelector(
      'button[aria-label="Spécification JSON"]'
    ) as HTMLButtonElement;

    open.click();
    open.click();

    expect(player.el.querySelectorAll('.rdfa-dialog-overlay')).toHaveLength(1);
  });
});

describe('mountPlayer — full screen', () => {
  it('requests full screen on the root, and exits from anywhere', () => {
    const { player } = mount();
    const request = vi.fn();
    player.el.requestFullscreen = request;
    const exit = vi.fn();
    Object.defineProperty(document, 'exitFullscreen', {
      value: exit,
      configurable: true,
    });
    const btn = player.el.querySelector(
      'button[aria-label="Plein écran"]'
    ) as HTMLButtonElement;

    btn.click();
    expect(request).toHaveBeenCalled();

    // Reproduced from React: ANY full-screen element makes the button exit,
    // not only this player's own.
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.createElement('div'),
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
      player.el.querySelector('button[aria-label="Quitter le plein écran"]')
    ).not.toBeNull();
  });
});

describe('mountPlayer — teardown', () => {
  it('detaches everything and stops driving the stage', () => {
    const { container, player } = mount({ exportable: true });
    (
      player.el.querySelector(
        'button[aria-label="Spécification JSON"]'
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
