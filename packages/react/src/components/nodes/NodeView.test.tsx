/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NodeView } from './NodeView';

afterEach(cleanup);

/**
 * Since v3 `NodeView` mounts the core's `renderNodeVisual` in an effect instead
 * of rendering JSX, so every assertion waits for the effect. The JSX path it
 * used to take is still covered, by `NodeVisual.test.tsx`.
 */

describe('NodeView — rendu isolé du cœur visuel', () => {
  it('type pictogramme : rend une icône, pas de panneau', async () => {
    const { container } = render(
      <NodeView node={{ id: 'srv', type: 'server' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon svg')).not.toBeNull()
    );
    expect(container.querySelector('.rdfa-node-panel')).toBeNull();
  });

  it('simple_node : rend un panneau avec le corps', async () => {
    const { container } = render(
      <NodeView node={{ id: 'w', type: 'simple_node', body: 'Worker' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-panel')).not.toBeNull()
    );
    expect(container.textContent).toContain('Worker');
  });

  it('échappe le code par défaut, sans coloration', async () => {
    const { container } = render(
      <NodeView
        node={{
          id: 'c',
          type: 'simple_node',
          body: '<b>x</b>',
          language: 'js',
        }}
      />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-code')).not.toBeNull()
    );
    expect(container.querySelector('.rdfa-code')?.innerHTML).toContain(
      '&lt;b&gt;'
    );
  });

  it('utilise le highlighter fourni', async () => {
    const highlight = vi.fn(() => '<em>hl</em>');
    const { container } = render(
      <NodeView
        node={{ id: 'c', type: 'simple_node', body: 'x', language: 'js' }}
        highlight={highlight}
      />
    );

    await waitFor(() => expect(highlight).toHaveBeenCalledWith('x', 'js'));
    expect(container.querySelector('.rdfa-code em')).not.toBeNull();
  });

  it('forme : rend le fond SVG de la forme', async () => {
    const { container } = render(
      <NodeView node={{ id: 'd', type: 'diamond', body: 'OK' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('svg.rdfa-shape-bg')).not.toBeNull()
    );
  });

  it('pad signal : affiche la valeur live plutôt que l’icône statique', async () => {
    const { container } = render(
      <NodeView node={{ id: 's', type: 'signal', icon: '0' }} signalValue="1" />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-signal-value')).not.toBeNull()
    );
  });

  it('ne réempile pas le visuel quand un nœud identique est repassé', async () => {
    const node = { id: 'srv', type: 'server' } as const;
    const { container, rerender } = render(<NodeView node={node} />);
    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon')).not.toBeNull()
    );

    rerender(<NodeView node={{ ...node }} />);

    expect(container.querySelectorAll('.rdfa-node-icon')).toHaveLength(1);
  });

  it('remplace le visuel quand le nœud change vraiment', async () => {
    const { container, rerender } = render(
      <NodeView node={{ id: 'a', type: 'server' }} />
    );
    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon')).not.toBeNull()
    );

    rerender(<NodeView node={{ id: 'a', type: 'diamond' }} />);

    await waitFor(() =>
      expect(container.querySelector('svg.rdfa-shape-bg')).not.toBeNull()
    );
    expect(container.querySelectorAll('.rdfa-node-icon')).toHaveLength(0);
  });

  it('nettoie derrière lui au démontage', async () => {
    const { container, unmount } = render(
      <NodeView node={{ id: 'srv', type: 'server' }} />
    );
    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon')).not.toBeNull()
    );

    unmount();

    expect(container.querySelector('.rdfa-node-icon')).toBeNull();
  });
});
