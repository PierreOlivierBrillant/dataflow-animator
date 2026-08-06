/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DataFlowPlayer } from './DataFlowPlayer';
import type { DataFlowSpec } from './types';

afterEach(cleanup);

/**
 * The player mounts imperatively in an effect, and the core's stage
 * settles across `requestAnimationFrame`. Every DOM assertion therefore waits
 * rather than reading straight after `render` — `waitFor` rather than fake
 * timers, so the tests are not coupled to the settle budget.
 */

const spec: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'editor',
      type: 'laptop',
      text: 'IDE',
      icon: 'typescript',
      lane: 1,
    },
    {
      id: 'server',
      type: 'server',
      text: 'Serveur',
      icon: 'node',
      lane: 2,
    },
  ],
  packets: [
    {
      id: 'd',
      kind: 'http_packet',
      packet_content: { header: 'GET /' },
    },
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
    {
      type: 'move',
      object: 'd',
      from: 'editor',
      to: 'server',
      duration: 600,
    },
  ],
};

/**
 * The MOUNTED player, never the placeholder — which wears `.rdfa-player` too,
 * to reserve the box. The mount waits for a paint, so the placeholder is what a
 * bare `.rdfa-player` resolves to for the first couple of frames, which would
 * let every assertion below run against markup React owns.
 */
const player = (container: HTMLElement) =>
  container.querySelector('.rdfa-player:not([data-placeholder])');

describe('DataFlowPlayer (real mount)', () => {
  it('renders nodes, controls and highlighted content without crashing', async () => {
    const { container } = render(<DataFlowPlayer spec={spec} />);

    await waitFor(() => expect(screen.getByText('IDE')).toBeTruthy());
    expect(screen.getByText('Serveur')).toBeTruthy();

    // Controls (is_navigable).
    expect(screen.getByLabelText('Play')).toBeTruthy();
    expect(screen.getByLabelText('Next step')).toBeTruthy();

    // set_content active at t=0 -> code terminal with Prism highlighting.
    expect(container.querySelector('.rdfa-terminal')).toBeTruthy();
    expect(container.querySelector('.rdfa-code .token')).toBeTruthy();
  });

  it('honours controls=false', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} controls={false} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(container.querySelector('.rdfa-controls')).toBeNull();
  });

  it('does not show the JSON button by default', async () => {
    const { container } = render(<DataFlowPlayer spec={spec} />);

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(screen.queryByLabelText('JSON specification')).toBeNull();
  });

  it('opens the highlighted JSON dialog when exportable', async () => {
    render(<DataFlowPlayer spec={spec} exportable />);

    await waitFor(() =>
      expect(screen.getByLabelText('JSON specification')).toBeTruthy()
    );
    fireEvent.click(screen.getByLabelText('JSON specification'));

    const dialog = screen.getByRole('dialog');
    const code = dialog.querySelector('.rdfa-dialog-code');
    expect(code?.textContent).toContain('"nodes"');
    expect(code?.querySelector('.token')).toBeTruthy();
  });
});

describe('DataFlowPlayer — options forwarded to the core', () => {
  it('opens the player at initialT rather than at 0', async () => {
    // Past a whole second: the controls bar rounds, so a smaller instant would
    // still read "0s" and the assertion would prove nothing.
    const { container } = render(
      <DataFlowPlayer spec={spec} initialT={1200} controls />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    // The controls bar is written from the clock, so it shows the instant.
    expect(container.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  it('applies width and height to the root', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} width={480} height={320} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    const root = player(container) as HTMLElement;
    expect(root.style.width).toBe('480px');
    expect(root.style.height).toBe('320px');
  });

  it('converts camelCase style into CSS properties', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} style={{ backgroundColor: 'rgb(1, 2, 3)' }} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect((player(container) as HTMLElement).style.backgroundColor).toBe(
      'rgb(1, 2, 3)'
    );
  });

  it('forwards density down to the stage, spacious included', async () => {
    const scaleOf = async (density: 'compact' | 'spacious') => {
      const { container, unmount } = render(
        <DataFlowPlayer spec={spec} density={density} />
      );
      await waitFor(() => expect(player(container)).not.toBeNull());
      const value = container
        .querySelector<HTMLElement>('.rdfa-stage')
        ?.style.getPropertyValue('--rdfa-scale');
      unmount();
      return value;
    };

    expect(await scaleOf('spacious')).not.toBe(await scaleOf('compact'));
  });

  it('forwards labels to the chrome, keeping English for the rest', async () => {
    const { container } = render(
      <DataFlowPlayer
        spec={spec}
        exportable
        labels={{ nextStep: 'Étape suivante', jsonSpec: 'Spécification JSON' }}
      />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(screen.getByLabelText('Étape suivante')).toBeTruthy();
    expect(screen.getByLabelText('Spécification JSON')).toBeTruthy();
    // An untouched key keeps the core's English default.
    expect(screen.getByLabelText('Play')).toBeTruthy();
  });

  it('logs compilation warnings in debug mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <DataFlowPlayer
        spec={{
          ...spec,
          timeline: [
            {
              type: 'move',
              object: 'd',
              from: 'editor',
              to: 'server',
              keep_until: 'ghost',
            },
          ],
        }}
        debug
      />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(warn).toHaveBeenCalledWith(
      '[DataFlowAnimator]',
      expect.stringContaining('ghost')
    );
    expect(container.querySelector('.rdfa-debug')).not.toBeNull();
    warn.mockRestore();
  });
});

describe('DataFlowPlayer — mount lifecycle', () => {
  /**
   * The regression this guards: callers routinely build the spec inline, so a
   * naive `useEffect(…, [spec])` would tear the player down and remeasure on
   * every render of the enclosing page.
   */
  it('does not remount when a structurally identical spec is passed again', async () => {
    const { container, rerender } = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(container)).not.toBeNull());
    const before = player(container);

    rerender(<DataFlowPlayer spec={{ ...spec, nodes: [...spec.nodes] }} />);

    expect(player(container)).toBe(before);
  });

  // Same hazard as the spec: `labels={{ … }}` is a fresh object every render.
  it('does not remount when a structurally identical labels object is passed again', async () => {
    const { container, rerender } = render(
      <DataFlowPlayer spec={spec} labels={{ play: 'Lecture' }} />
    );
    await waitFor(() => expect(player(container)).not.toBeNull());
    const before = player(container);

    rerender(<DataFlowPlayer spec={spec} labels={{ play: 'Lecture' }} />);

    expect(player(container)).toBe(before);
  });

  it('remounts and keeps the current instant when the spec really changes', async () => {
    const { container, rerender } = render(
      <DataFlowPlayer spec={spec} initialT={1200} />
    );
    await waitFor(() => expect(player(container)).not.toBeNull());
    const before = player(container);
    expect(container.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);

    // A genuinely different spec: this one DOES remount, and `initialT` is not
    // re-honoured — the resumed instant is.
    rerender(
      <DataFlowPlayer
        spec={{
          ...spec,
          nodes: [...spec.nodes, { id: 'db', type: 'database', lane: 3 }],
        }}
        initialT={1200}
      />
    );
    await waitFor(() =>
      expect(container.querySelector('[data-node-id="db"]')).not.toBeNull()
    );

    expect(player(container)).not.toBe(before);
    expect(container.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  /**
   * The regression this guards: mounting inside the effect replaces the
   * placeholder within the same task, so the browser never paints it. The
   * loading indicator is then unreachable for every client-side mount — a
   * gallery thumbnail, a modal, a spec edit — however long the mount takes.
   */
  it('leaves the placeholder on screen for a paint before mounting', async () => {
    const { container } = render(<DataFlowPlayer spec={spec} />);

    // Straight after the commit, with no waiting: the placeholder alone.
    expect(
      container.querySelector('.rdfa-player[data-placeholder]')
    ).not.toBeNull();
    expect(player(container)).toBeNull();

    await waitFor(() => expect(player(container)).not.toBeNull());
    await waitFor(() =>
      expect(container.querySelector('[data-placeholder]')).toBeNull()
    );
  });

  /**
   * The regression this guards: the placeholder is React's and the player is
   * the core's, so the two halves of one swap have different clocks. A plain
   * `setMounted` is committed in a task that runs after the frame the mount ran
   * in has painted — and that frame holds BOTH boxes, stacked in the same flow,
   * so the host doubles in height and everything around it jumps.
   *
   * The assertion is taken INSIDE the frame, right after the last `rAF`
   * callback returned, because that is where the browser paints. Reading after
   * `act` returns would prove nothing: act flushes the pending update itself,
   * so the stacked state it is meant to catch is already gone.
   */
  it('swaps the placeholder for the player within a single frame', async () => {
    const queue: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => queue.push(cb));
    const caf = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    const { container } = render(<DataFlowPlayer spec={spec} />);
    let painted: { placeholder: boolean; player: boolean } | null = null;

    // Two frames: the mount waits for the placeholder to be painted first.
    for (let i = 0; i < 2; i++)
      await act(async () => {
        for (const cb of queue.splice(0)) cb(performance.now());
        painted = {
          placeholder: !!container.querySelector('[data-placeholder]'),
          player: !!player(container),
        };
      });

    expect(painted).toEqual({ placeholder: false, player: true });

    raf.mockRestore();
    caf.mockRestore();
  });

  /** The other half of the rule above: only the FIRST mount waits for a paint. */
  it('remounts synchronously, so a live spec edit never blinks', async () => {
    const { container, rerender } = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(container)).not.toBeNull());
    const before = player(container);

    rerender(
      <DataFlowPlayer
        spec={{
          ...spec,
          nodes: [...spec.nodes, { id: 'db', type: 'database', lane: 3 }],
        }}
      />
    );

    // Read with no waiting: the old player was on screen until the cleanup, so
    // deferring here would trade a rendered player for two frames of empty box.
    const after = player(container);
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect(container.querySelector('[data-placeholder]')).toBeNull();
  });

  it('leaves nothing behind on unmount', async () => {
    const { container, unmount } = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(container)).not.toBeNull());

    unmount();

    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
  });

  // What StrictMode does to every consumer, twice.
  it('supports mount → unmount → remount', async () => {
    const first = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(first.container)).not.toBeNull());
    first.unmount();

    const second = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(second.container)).not.toBeNull());

    // Exactly one: the first mount left nothing behind for this one to join.
    // Placeholders excluded — this one's may not have been swept yet, and it is
    // not what the test is about.
    expect(
      document.querySelectorAll('.rdfa-player:not([data-placeholder])')
    ).toHaveLength(1);
  });
});
