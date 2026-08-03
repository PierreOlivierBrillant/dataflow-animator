/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { NodeView } from './NodeView';

afterEach(cleanup);

/**
 * `NodeView` mounts the core's `renderNodeVisual` in an effect instead
 * of rendering JSX, so every assertion waits for the effect. The JSX path it
 * used to take is still covered, by `NodeVisual.test.tsx`.
 */

describe('NodeView — isolated rendering of the core visual', () => {
  it('pictogram type: renders an icon, no panel', async () => {
    const { container } = render(
      <NodeView node={{ id: 'srv', type: 'server' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon svg')).not.toBeNull()
    );
    expect(container.querySelector('.rdfa-node-panel')).toBeNull();
  });

  it('simple_node: renders a panel with the body', async () => {
    const { container } = render(
      <NodeView node={{ id: 'w', type: 'simple_node', body: 'Worker' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-panel')).not.toBeNull()
    );
    expect(container.textContent).toContain('Worker');
  });

  it('escapes the code by default, with no highlighting', async () => {
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

  it('uses the provided highlighter', async () => {
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

  it('shape: renders the shape SVG background', async () => {
    const { container } = render(
      <NodeView node={{ id: 'd', type: 'diamond', body: 'OK' }} />
    );

    await waitFor(() =>
      expect(container.querySelector('svg.rdfa-shape-bg')).not.toBeNull()
    );
  });

  it('signal pad: shows the live value instead of the static icon', async () => {
    const { container } = render(
      <NodeView node={{ id: 's', type: 'signal', icon: '0' }} signalValue="1" />
    );

    await waitFor(() =>
      expect(container.querySelector('.rdfa-signal-value')).not.toBeNull()
    );
  });

  it('does not remount the visual when an identical node is passed again', async () => {
    const node = { id: 'srv', type: 'server' } as const;
    const { container, rerender } = render(<NodeView node={node} />);
    await waitFor(() =>
      expect(container.querySelector('.rdfa-node-icon')).not.toBeNull()
    );

    rerender(<NodeView node={{ ...node }} />);

    expect(container.querySelectorAll('.rdfa-node-icon')).toHaveLength(1);
  });

  it('replaces the visual when the node actually changes', async () => {
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

  it('cleans up after itself on unmount', async () => {
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
