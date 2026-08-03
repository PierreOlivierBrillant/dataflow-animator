import { describe, expect, it } from 'vitest';
import { buildStageSignature } from './stageSignature';
import type { DataFlowSpec } from '../types';

const base: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'server', lane: 1 },
    { id: 'b', type: 'server', lane: 2 },
  ],
  packets: [],
  timeline: [],
};

describe('buildStageSignature', () => {
  it('changes when only lane changes', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      nodes: [
        { id: 'a', type: 'server', lane: 3 },
        { id: 'b', type: 'server', lane: 2 },
      ],
    });
    expect(after).not.toBe(before);
  });

  it('changes when main changes', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      nodes: [
        { id: 'a', type: 'server', lane: 1, main: true },
        { id: 'b', type: 'server', lane: 2 },
      ],
    });
    expect(after).not.toBe(before);
  });

  it('changes when align_with changes', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      nodes: [
        { id: 'a', type: 'server', lane: 1 },
        { id: 'b', type: 'server', lane: 2, align_with: 'a' },
      ],
    });
    expect(after).not.toBe(before);
  });

  it('changes when background_color changes (affects borderOutset)', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      nodes: [
        { id: 'a', type: 'server', lane: 1, background_color: '#bfdbfe' },
        { id: 'b', type: 'server', lane: 2 },
      ],
    });
    expect(after).not.toBe(before);
  });

  it('changes when type changes', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      nodes: [
        { id: 'a', type: 'circle', lane: 1 },
        { id: 'b', type: 'server', lane: 2 },
      ],
    });
    expect(after).not.toBe(before);
  });

  it('changes when connections change in graph mode (auto-layout)', () => {
    const graphBase: DataFlowSpec = {
      direction: 'graph',
      nodes: [
        { id: 'a', type: 'circle' },
        { id: 'b', type: 'circle' },
        { id: 'c', type: 'circle' },
      ],
      connections: [{ from: 'a', to: 'b', arrow_head: 'none' }],
      packets: [],
      timeline: [],
    };
    const before = buildStageSignature(graphBase);
    const after = buildStageSignature({
      ...graphBase,
      connections: [{ from: 'a', to: 'c', arrow_head: 'none' }],
    });
    expect(after).not.toBe(before);
  });

  it('ignores connections outside graph mode (no unnecessary re-measure)', () => {
    const before = buildStageSignature(base);
    const after = buildStageSignature({
      ...base,
      connections: [{ from: 'a', to: 'b', arrow_head: 'none' }],
    });
    expect(after).toBe(before);
  });

  it('is stable for an identical spec', () => {
    expect(buildStageSignature(base)).toBe(buildStageSignature(base));
  });
});
