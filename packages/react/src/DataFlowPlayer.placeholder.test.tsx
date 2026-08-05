import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataFlowPlayer } from './DataFlowPlayer';
import type { DataFlowSpec } from './types';

/**
 * The placeholder — what the player is BEFORE it mounts.
 *
 * Rendered on the server, in the `node` environment, because that is the only
 * place it can be observed: under a client render the mount effect runs inside
 * `act`, so the placeholder is already gone by the time an assertion could look
 * at it. This is also the exact markup a consumer's static HTML holds.
 */

const spec: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'laptop', lane: 1 },
    { id: 'b', type: 'server', lane: 2 },
  ],
  packets: [{ id: 'd', kind: 'http_packet' }],
  timeline: [{ type: 'move', object: 'd', from: 'a', to: 'b' }],
};

describe('DataFlowPlayer — pre-mount placeholder', () => {
  it('renders the loading indicator, with the core default text', () => {
    const html = renderToStaticMarkup(<DataFlowPlayer spec={spec} />);

    expect(html).toContain('data-placeholder');
    expect(html).toContain('rdfa-loading');
    expect(html).toContain('rdfa-loading-ring');
    // Not a stage: `.rdfa-stage` stays the mark of a mounted one.
    expect(html).not.toContain('rdfa-stage');
    expect(html).toContain('Loading…');
    // Announced rather than merely drawn: the ring is decorative.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('localises the indicator through the labels prop', () => {
    const html = renderToStaticMarkup(
      <DataFlowPlayer spec={spec} labels={{ loading: 'Chargement…' }} />
    );

    expect(html).toContain('Chargement…');
    expect(html).not.toContain('Loading…');
  });

  it('lets a fallback replace the indicator entirely', () => {
    const html = renderToStaticMarkup(
      <DataFlowPlayer spec={spec} fallback={<p>Poster</p>} />
    );

    expect(html).toContain('rdfa-fallback');
    expect(html).toContain('Poster');
    expect(html).not.toContain('rdfa-loading');
  });

  it('reserves the player box either way, so nothing reflows on mount', () => {
    const html = renderToStaticMarkup(
      <DataFlowPlayer spec={spec} height={320} width={480} />
    );

    expect(html).toContain('height:320px');
    expect(html).toContain('width:480px');
  });
});
