/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataFlowSpec } from '@dataflow-animator/core';
import {
  DataFlowPlayerElement,
  DEFAULT_TAG_NAME,
  defineDataFlowPlayer,
  ERROR_EVENT,
  MOUNTED_EVENT,
} from './index';

/**
 * The element mounts the REAL core renderer — there is no stub here, because the
 * only thing worth asserting about a wrapper this thin is that the real player
 * comes out the other end.
 *
 * Two consequences shape every test below:
 *
 *  - mounting is deferred by a microtask, always, so nothing is read straight
 *    after `append`. Tests await `MOUNTED_EVENT`, which is exactly what the pixel
 *    gate does and exactly what the README tells a consumer to do — a timeout
 *    here would be the same flake, hidden.
 *  - the core's stage settles across `requestAnimationFrame`, so assertions on
 *    measured geometry go through `settle()`.
 */

const SPEC: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'editor', type: 'laptop', text: 'IDE', icon: 'typescript', lane: 1 },
    { id: 'server', type: 'server', text: 'Server', icon: 'node', lane: 2 },
  ],
  packets: [
    { id: 'd', kind: 'http_packet', packet_content: { header: 'GET /' } },
  ],
  timeline: [
    {
      type: 'set_content',
      object: 'editor',
      content: {
        type: 'code',
        language: 'javascript',
        value: 'const add = (a, b) => a + b;',
      },
    },
    { type: 'move', object: 'd', from: 'editor', to: 'server', duration: 600 },
  ],
};

/**
 * A ResizeObserver that jsdom does not provide.
 *
 * Installed for real rather than left absent: the core guards
 * `typeof ResizeObserver === 'undefined'` and skips observing entirely, so
 * without this the "nothing left observing after disconnect" assertion would pass
 * against an observer that was never created — a green test proving nothing.
 */
class StubResizeObserver {
  static instances: StubResizeObserver[] = [];
  observed = 0;
  disconnected = false;
  constructor() {
    StubResizeObserver.instances.push(this);
  }
  observe(): void {
    this.observed++;
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

let cancelRaf: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  StubResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  cancelRaf = vi.spyOn(globalThis, 'cancelAnimationFrame');
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function create(attrs: Record<string, string> = {}): DataFlowPlayerElement {
  const el = document.createElement(DEFAULT_TAG_NAME);
  for (const [name, value] of Object.entries(attrs))
    el.setAttribute(name, value);
  return el;
}

/** Resolves on the next successful mount. Attach BEFORE the change that triggers it. */
function whenMounted(el: DataFlowPlayerElement): Promise<readonly string[]> {
  return new Promise((resolve) => {
    el.addEventListener(
      MOUNTED_EVENT,
      (event) => resolve((event as CustomEvent).detail.warnings),
      { once: true }
    );
  });
}

/** The core's measurement budget: one synchronous pass plus three across rAF. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
}

async function mount(
  attrs: Record<string, string> = {},
  spec: DataFlowSpec | null = SPEC
): Promise<DataFlowPlayerElement> {
  const el = create(attrs);
  if (spec) el.spec = spec;
  const mounted = whenMounted(el);
  document.body.append(el);
  await mounted;
  return el;
}

const playerOf = (el: Element): HTMLElement | null =>
  el.querySelector('.rdfa-player');

describe('mounting', () => {
  it('mounts the core player as a direct child, in light DOM', async () => {
    const el = await mount();
    const player = playerOf(el);
    expect(player).not.toBeNull();
    // Light DOM: the element itself IS the container, so the player is reachable
    // from the document without piercing anything.
    expect(el.shadowRoot).toBeNull();
    expect(player!.parentElement).toBe(el);
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(1);
  });

  it('renders the nodes and the control bar', async () => {
    const el = await mount();
    await settle();
    expect(el.textContent).toContain('IDE');
    expect(el.textContent).toContain('Server');
    expect(el.querySelector('.rdfa-controls')).not.toBeNull();
    // set_content is active at t=0 → the code panel, highlighted by Prism.
    expect(el.querySelector('.rdfa-code .token')).not.toBeNull();
  });

  it('removes its own box with display:contents', async () => {
    // Same reason as the React binding's host div: an unstyled custom element is
    // `display: inline`, which breaks height="100%" and flex placement.
    const el = await mount();
    expect(el.style.display).toBe('contents');
  });

  it('leaves an author-specified inline display alone', async () => {
    const el = await mount({ style: 'display: block' });
    expect(el.style.display).toBe('block');
  });

  it('does nothing at all without a spec', async () => {
    const el = create();
    document.body.append(el);
    await Promise.resolve();
    expect(playerOf(el)).toBeNull();
  });
});

describe('the spec attribute', () => {
  it('parses JSON from the attribute', async () => {
    const el = create({ spec: JSON.stringify(SPEC) });
    const mounted = whenMounted(el);
    document.body.append(el);
    await mounted;
    await settle();
    expect(el.textContent).toContain('IDE');
    expect(el.spec).toEqual(SPEC);
  });

  it('reports invalid JSON and keeps the mounted player', async () => {
    const el = await mount();
    const before = playerOf(el);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const events: CustomEvent[] = [];
    el.addEventListener(ERROR_EVENT, (e) => events.push(e as CustomEvent));

    el.setAttribute('spec', '{ not json');
    await Promise.resolve();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('invalid `spec` attribute')
    );
    expect(events).toHaveLength(1);
    expect(events[0].detail.error).toBeInstanceOf(Error);
    // Not remounted, not blanked: a typo mid-edit must not destroy a working
    // player.
    expect(playerOf(el)).toBe(before);
  });

  it('rejects JSON that is not an object', async () => {
    const el = await mount();
    const before = playerOf(el);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    el.setAttribute('spec', '42');
    await Promise.resolve();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('expected a JSON object')
    );
    expect(playerOf(el)).toBe(before);
  });

  it('unmounts when the attribute is removed', async () => {
    const el = await mount({ spec: JSON.stringify(SPEC) });
    el.removeAttribute('spec');
    await Promise.resolve();
    expect(playerOf(el)).toBeNull();
  });

  it('treats a blank attribute as no spec, not as broken JSON', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = await mount({ spec: JSON.stringify(SPEC) });
    el.setAttribute('spec', '   ');
    await Promise.resolve();
    expect(playerOf(el)).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('attributes reach the core', () => {
  it('forwards theme and mode to the player root', async () => {
    const el = await mount({ theme: 'blueprint', mode: 'dark' });
    expect(playerOf(el)!.dataset.theme).toBe('blueprint');
    expect(playerOf(el)!.dataset.mode).toBe('dark');
  });

  it('forwards height and width, numeric or CSS', async () => {
    const el = await mount({ height: '320', width: '60vw' });
    expect(playerOf(el)!.style.height).toBe('320px');
    expect(playerOf(el)!.style.width).toBe('60vw');
  });

  it('forwards player-class onto the player root', async () => {
    const el = await mount({ 'player-class': 'mine' });
    expect(playerOf(el)!.classList.contains('mine')).toBe(true);
    // And it did NOT touch the element's own class list.
    expect(el.className).toBe('');
  });

  it('forwards density down to the stage scale', async () => {
    const scaleOf = async (density: string) => {
      const el = await mount({ density });
      await settle();
      const value = el
        .querySelector<HTMLElement>('.rdfa-stage')
        ?.style.getPropertyValue('--rdfa-scale');
      el.remove();
      return value;
    };
    expect(await scaleOf('spacious')).not.toBe(await scaleOf('compact'));
  });

  it('opens at initial-t rather than at 0', async () => {
    // Past a whole second: the control bar rounds, so a smaller instant would
    // still read "0s" and prove nothing.
    const el = await mount({ 'initial-t': '1200' });
    expect(el.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  it('adds the JSON dialog button when exportable', async () => {
    const el = await mount({ exportable: '' });
    expect(
      el.querySelector('[aria-label="Spécification JSON"]')
    ).not.toBeNull();
  });

  it('logs compile warnings and the debug overlay when debug', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = create({ debug: 'true' });
    el.spec = {
      ...SPEC,
      timeline: [
        {
          type: 'move',
          object: 'd',
          from: 'editor',
          to: 'server',
          keep_until: 'ghost',
        },
      ],
    } as DataFlowSpec;
    const mounted = whenMounted(el);
    document.body.append(el);
    const warnings = await mounted;

    expect(warnings.join(' ')).toContain('ghost');
    expect(warn).toHaveBeenCalledWith(
      '[dataflow-player]',
      expect.stringContaining('ghost')
    );
    expect(el.querySelector('.rdfa-debug')).not.toBeNull();
  });
});

describe('boolean attributes: absence is not false', () => {
  it('keeps the controls when the attribute is absent', async () => {
    // The rule that makes this element unlike <video controls>: the core defaults
    // `controls` to true, so saying nothing must not turn them off.
    const el = await mount();
    expect(el.querySelector('.rdfa-controls')).not.toBeNull();
  });

  it.each(['false', '0'])('hides them with controls="%s"', async (value) => {
    const el = await mount({ controls: value });
    expect(el.querySelector('.rdfa-controls')).toBeNull();
  });

  it.each(['', 'controls', 'true', '1'])(
    'keeps them with controls="%s"',
    async (value) => {
      const el = await mount({ controls: value });
      expect(el.querySelector('.rdfa-controls')).not.toBeNull();
    }
  );

  it('warns and falls back to the default on a nonsense value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount({ controls: 'nope' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('controls="nope"')
    );
    expect(el.querySelector('.rdfa-controls')).not.toBeNull();
  });

  it('writes "false" rather than removing the attribute', async () => {
    const el = await mount();
    el.controls = false;
    // Removal would mean "the core's default", which for controls is true.
    expect(el.getAttribute('controls')).toBe('false');
    expect(el.controls).toBe(false);

    el.controls = undefined;
    expect(el.hasAttribute('controls')).toBe(false);
    expect(el.controls).toBeUndefined();
  });

  it.each(['exportable', 'auto-play', 'loop', 'debug'] as const)(
    'applies the same rule to %s',
    async (name) => {
      const el = await mount({ [name]: 'false' });
      expect(el.getAttribute(name)).toBe('false');
    }
  );
});

/**
 * The properties are the surface Vue and Svelte bind to (both prefer a property
 * over an attribute when one exists on the element), so each pair is API, not
 * sugar — and each is asserted in both directions.
 */
describe('properties', () => {
  it('reads back as undefined while nothing is specified', async () => {
    const el = await mount();
    expect(el.theme).toBeUndefined();
    expect(el.mode).toBeUndefined();
    expect(el.density).toBeUndefined();
    expect(el.height).toBeUndefined();
    expect(el.width).toBeUndefined();
    expect(el.playerClass).toBeUndefined();
    expect(el.speed).toBeUndefined();
    expect(el.initialT).toBeUndefined();
    expect(el.controls).toBeUndefined();
    expect(el.exportable).toBeUndefined();
    expect(el.autoPlay).toBeUndefined();
    expect(el.loop).toBeUndefined();
    expect(el.debug).toBeUndefined();
    expect(el.highlight).toBeUndefined();
  });

  it('round-trips every serialisable property through its attribute', async () => {
    const el = await mount();
    el.theme = 'neon';
    el.mode = 'dark';
    el.density = 'compact';
    el.height = 320;
    el.width = '60vw';
    el.playerClass = 'mine';
    el.speed = 2;
    el.initialT = 100;
    el.controls = true;
    el.exportable = true;
    el.autoPlay = true;
    el.loop = true;
    el.debug = false;

    expect(el.getAttribute('theme')).toBe('neon');
    expect(el.getAttribute('mode')).toBe('dark');
    expect(el.getAttribute('density')).toBe('compact');
    expect(el.getAttribute('height')).toBe('320');
    expect(el.getAttribute('width')).toBe('60vw');
    expect(el.getAttribute('player-class')).toBe('mine');
    expect(el.getAttribute('speed')).toBe('2');
    expect(el.getAttribute('initial-t')).toBe('100');
    expect(el.getAttribute('auto-play')).toBe('true');
    expect(el.getAttribute('loop')).toBe('true');
    expect(el.getAttribute('debug')).toBe('false');

    expect(el.theme).toBe('neon');
    expect(el.mode).toBe('dark');
    expect(el.density).toBe('compact');
    expect(el.height).toBe(320);
    expect(el.width).toBe('60vw');
    expect(el.playerClass).toBe('mine');
    expect(el.speed).toBe(2);
    expect(el.initialT).toBe(100);
    expect(el.controls).toBe(true);
    expect(el.exportable).toBe(true);
    expect(el.autoPlay).toBe(true);
    expect(el.loop).toBe(true);
    expect(el.debug).toBe(false);
  });

  it('removes the attribute when a property is set back to undefined', async () => {
    const el = await mount({
      theme: 'neon',
      mode: 'dark',
      density: 'compact',
      height: '320',
      width: '60vw',
      'player-class': 'mine',
      speed: '2',
      'initial-t': '100',
      exportable: 'true',
      loop: 'true',
      debug: 'true',
    });
    el.theme = undefined;
    el.mode = undefined;
    el.density = undefined;
    el.height = undefined;
    el.width = undefined;
    el.playerClass = undefined;
    el.speed = undefined;
    el.initialT = undefined;
    el.exportable = undefined;
    el.loop = undefined;
    el.debug = undefined;
    for (const name of [
      'theme',
      'mode',
      'density',
      'height',
      'width',
      'player-class',
      'speed',
      'initial-t',
      'exportable',
      'loop',
      'debug',
    ])
      expect(el.hasAttribute(name)).toBe(false);
  });

  it('replaces Prism through the highlight property', async () => {
    // Property-only, because a function cannot be written in an attribute.
    const el = create();
    el.spec = SPEC;
    const highlight = (code: string, language: string) =>
      `<span class="mine">${language}:${code.length}</span>`;
    el.highlight = highlight;
    const mounted = whenMounted(el);
    document.body.append(el);
    await mounted;
    await settle();

    expect(el.highlight).toBe(highlight);
    expect(el.querySelector('.rdfa-code .mine')?.textContent).toBe(
      'javascript:28'
    );
  });

  it('clears the player when spec is set back to null', async () => {
    const el = await mount();
    el.spec = null;
    await Promise.resolve();
    expect(el.spec).toBeNull();
    expect(playerOf(el)).toBeNull();
  });
});

describe('remounting', () => {
  it('coalesces several synchronous changes into ONE remount', async () => {
    const el = await mount();
    const before = playerOf(el);
    let mounts = 0;
    el.addEventListener(MOUNTED_EVENT, () => mounts++);

    el.setAttribute('theme', 'neon');
    el.setAttribute('mode', 'dark');
    el.setAttribute('density', 'compact');
    el.setAttribute('height', '300');
    await Promise.resolve();

    expect(mounts).toBe(1);
    expect(playerOf(el)).not.toBe(before);
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(1);
    expect(playerOf(el)!.dataset.theme).toBe('neon');
  });

  it('does not remount when an attribute is set to its current value', async () => {
    const el = await mount({ theme: 'neon' });
    const before = playerOf(el);
    el.setAttribute('theme', 'neon');
    await Promise.resolve();
    expect(playerOf(el)).toBe(before);
  });

  it('reopens at the previous instant and stops honouring initial-t', async () => {
    const el = await mount({ 'initial-t': '1200' });
    expect(el.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);

    const mounted = whenMounted(el);
    el.setAttribute('initial-t', '0');
    await mounted;

    // The resumed instant wins over the freshly written attribute: only the
    // FIRST mount reads initial-t.
    expect(el.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  it('remounts on a spec property change', async () => {
    const el = await mount();
    const before = playerOf(el);
    const mounted = whenMounted(el);
    el.spec = {
      ...SPEC,
      nodes: [...SPEC.nodes, { id: 'db', type: 'database', lane: 3 }],
    };
    await mounted;
    await settle();
    expect(playerOf(el)).not.toBe(before);
    expect(el.querySelector('[data-node-id="db"]')).not.toBeNull();
  });
});

describe('teardown', () => {
  it('leaves nothing behind on disconnection', async () => {
    const el = await mount({ 'auto-play': 'true' });
    await settle();
    expect(StubResizeObserver.instances.length).toBeGreaterThan(0);

    el.remove();

    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
    expect(playerOf(el)).toBeNull();
    // The two things the retained renderer holds beyond the DOM: an rAF loop
    // (playing) and a ResizeObserver.
    expect(cancelRaf).toHaveBeenCalled();
    expect(StubResizeObserver.instances.every((ro) => ro.disconnected)).toBe(
      true
    );
  });

  it('survives connect → disconnect → connect', async () => {
    const el = await mount();
    el.remove();
    const mounted = whenMounted(el);
    document.body.append(el);
    await mounted;
    // Exactly one: the first mount left nothing for this one to join.
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(1);
  });

  it('treats a move in the DOM as one remount that keeps the instant', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const el = await mount({ 'initial-t': '1200' });

    let mounts = 0;
    el.addEventListener(MOUNTED_EVENT, () => mounts++);
    // Synchronous disconnect + connect: one flush, so one remount.
    host.append(el);
    await Promise.resolve();

    expect(mounts).toBe(1);
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(1);
    expect(el.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  it('is inert when disconnected before the pending mount runs', async () => {
    const el = create();
    el.spec = SPEC;
    document.body.append(el);
    el.remove();
    await Promise.resolve();
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
    // And the element is not stuck: reconnecting still mounts it, which is what
    // clearing the pending flag BEFORE the isConnected bail-out buys.
    const mounted = whenMounted(el);
    document.body.append(el);
    await mounted;
    expect(playerOf(el)).not.toBeNull();
  });
});

describe('defineDataFlowPlayer', () => {
  it('has already registered the default tag at import', () => {
    expect(customElements.get(DEFAULT_TAG_NAME)).toBe(DataFlowPlayerElement);
  });

  it('is idempotent', () => {
    expect(() => defineDataFlowPlayer()).not.toThrow();
    expect(customElements.get(DEFAULT_TAG_NAME)).toBe(DataFlowPlayerElement);
  });

  it('registers an extra tag as a subclass, and it works', async () => {
    // `customElements.define` throws if the CONSTRUCTOR is already registered, so
    // a second tag cannot reuse the class itself.
    defineDataFlowPlayer('my-player');
    const ctor = customElements.get('my-player');
    expect(ctor).not.toBe(DataFlowPlayerElement);
    expect(ctor!.prototype).toBeInstanceOf(DataFlowPlayerElement);

    const el = document.createElement('my-player') as DataFlowPlayerElement;
    el.spec = SPEC;
    const mounted = whenMounted(el);
    document.body.append(el);
    await mounted;
    expect(playerOf(el)).not.toBeNull();

    // Idempotent for an extra tag too: the second call recognises the SUBCLASS
    // as ours and leaves the registration alone.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    defineDataFlowPlayer('my-player');
    expect(customElements.get('my-player')).toBe(ctor);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns instead of hijacking a tag someone else defined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    customElements.define('foreign-player', class extends HTMLElement {});
    defineDataFlowPlayer('foreign-player');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('already defined by something else')
    );
  });
});
