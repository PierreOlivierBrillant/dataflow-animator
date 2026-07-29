/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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
 * Since v3 the player mounts imperatively in an effect, and the core's stage
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

const player = (container: HTMLElement) =>
  container.querySelector('.rdfa-player');

describe('DataFlowPlayer (montage réel)', () => {
  it('rend les nœuds, les contrôles et le contenu coloré sans planter', async () => {
    const { container } = render(<DataFlowPlayer spec={spec} />);

    await waitFor(() => expect(screen.getByText('IDE')).toBeTruthy());
    expect(screen.getByText('Serveur')).toBeTruthy();

    // Controls (is_navigable).
    expect(screen.getByLabelText('Lecture')).toBeTruthy();
    expect(screen.getByLabelText('Étape suivante')).toBeTruthy();

    // set_content active at t=0 -> code terminal with Prism highlighting.
    expect(container.querySelector('.rdfa-terminal')).toBeTruthy();
    expect(container.querySelector('.rdfa-code .token')).toBeTruthy();
  });

  it('respecte controls=false', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} controls={false} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(container.querySelector('.rdfa-controls')).toBeNull();
  });

  it('n’affiche pas le bouton JSON par défaut', async () => {
    const { container } = render(<DataFlowPlayer spec={spec} />);

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect(screen.queryByLabelText('Spécification JSON')).toBeNull();
  });

  it('ouvre la fenêtre JSON colorée quand exportable', async () => {
    render(<DataFlowPlayer spec={spec} exportable />);

    await waitFor(() =>
      expect(screen.getByLabelText('Spécification JSON')).toBeTruthy()
    );
    fireEvent.click(screen.getByLabelText('Spécification JSON'));

    const dialog = screen.getByRole('dialog');
    const code = dialog.querySelector('.rdfa-dialog-code');
    expect(code?.textContent).toContain('"nodes"');
    expect(code?.querySelector('.token')).toBeTruthy();
  });
});

describe('DataFlowPlayer — options passées au cœur', () => {
  it('ouvre le player à initialT plutôt qu’à 0', async () => {
    // Past a whole second: the controls bar rounds, so a smaller instant would
    // still read "0s" and the assertion would prove nothing.
    const { container } = render(
      <DataFlowPlayer spec={spec} initialT={1200} controls />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    // The controls bar is written from the clock, so it shows the instant.
    expect(container.querySelector('.rdfa-time')?.textContent).toMatch(/^1s/);
  });

  it('applique width et height à la racine', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} width={480} height={320} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    const root = player(container) as HTMLElement;
    expect(root.style.width).toBe('480px');
    expect(root.style.height).toBe('320px');
  });

  it('convertit style camelCase en propriétés CSS', async () => {
    const { container } = render(
      <DataFlowPlayer spec={spec} style={{ backgroundColor: 'rgb(1, 2, 3)' }} />
    );

    await waitFor(() => expect(player(container)).not.toBeNull());
    expect((player(container) as HTMLElement).style.backgroundColor).toBe(
      'rgb(1, 2, 3)'
    );
  });

  it('fait descendre density jusqu’au stage, spacious compris', async () => {
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

  it('journalise les avertissements de compilation en mode debug', async () => {
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

describe('DataFlowPlayer — cycle de vie du montage', () => {
  /**
   * The regression this guards: callers routinely build the spec inline, so a
   * naive `useEffect(…, [spec])` would tear the player down and remeasure on
   * every render of the enclosing page.
   */
  it('ne remonte pas quand une spec structurellement identique est repassée', async () => {
    const { container, rerender } = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(container)).not.toBeNull());
    const before = player(container);

    rerender(<DataFlowPlayer spec={{ ...spec, nodes: [...spec.nodes] }} />);

    expect(player(container)).toBe(before);
  });

  it('remonte et conserve l’instant courant quand la spec change vraiment', async () => {
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

  it('ne laisse rien derrière lui au démontage', async () => {
    const { container, unmount } = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(container)).not.toBeNull());

    unmount();

    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(0);
  });

  // What StrictMode does to every consumer, twice.
  it('supporte montage → démontage → remontage', async () => {
    const first = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(first.container)).not.toBeNull());
    first.unmount();

    const second = render(<DataFlowPlayer spec={spec} />);
    await waitFor(() => expect(player(second.container)).not.toBeNull());

    // Exactly one: the first mount left nothing behind for this one to join.
    expect(document.querySelectorAll('.rdfa-player')).toHaveLength(1);
  });
});
