import { describe, expect, it } from 'vitest';
import type { DataFlowSpec } from '../types';
import { compile } from '../engine/compiler';
import { DEFAULT_PLAYER_LABELS } from '../dom/labels';
import { describeAnimation } from './describe';

const labels = DEFAULT_PLAYER_LABELS;

/** Describes a spec the way the player does: compile once, describe that. */
function run(spec: DataFlowSpec) {
  return describeAnimation(spec, compile(spec).timeline, labels);
}

const base: Pick<DataFlowSpec, 'nodes' | 'packets'> = {
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Browser' },
    { id: 'api', type: 'server', text: 'Web server' },
    { id: 'db', type: 'database', text: 'Database' },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
  ],
};

describe('describeAnimation', () => {
  it('names the cast and counts the steps', () => {
    const result = run({
      ...base,
      timeline: [{ type: 'move', object: 'req', from: 'browser', to: 'api' }],
    });

    expect(result.summary).toContain('Browser, Web server, Database');
    expect(result.summary).toContain('1 steps');
  });

  it("opens with the spec's own description when it has one", () => {
    const result = run({
      ...base,
      description: 'How a page load reaches the database',
      timeline: [{ type: 'move', object: 'req', from: 'browser', to: 'api' }],
    });

    expect(
      result.summary.startsWith('How a page load reaches the database.')
    ).toBe(true);
  });

  it('describes a move by the packet and both endpoints', () => {
    const result = run({
      ...base,
      timeline: [{ type: 'move', object: 'req', from: 'browser', to: 'api' }],
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].text).toBe(
      'GET /users travels from Browser to Web server.'
    );
  });

  it('keeps one step per root action, aligned with the timeline', () => {
    const spec: DataFlowSpec = {
      ...base,
      timeline: [
        { type: 'comment', text: 'First' },
        { type: 'move', object: 'req', from: 'browser', to: 'api' },
        { type: 'move', object: 'req', from: 'api', to: 'db' },
      ],
    };
    const { timeline } = compile(spec);
    const result = describeAnimation(spec, timeline, labels);

    expect(result.steps.map((step) => step.index)).toEqual([0, 1, 2]);
    // The instants are the compiler's, not a recomputation: a step button seeks
    // to exactly where the control bar's "next" would land.
    expect(result.steps.map((step) => step.startMs)).toEqual(
      timeline.steps.map((step) => step.startMs)
    );
  });

  it("repeats an author's comment verbatim rather than paraphrasing it", () => {
    const result = run({
      ...base,
      timeline: [{ type: 'comment', text: 'The cache misses' }],
    });

    expect(result.steps[0].text).toBe('The cache misses.');
  });

  it('lets a per-action description win over the generated sentence', () => {
    const result = run({
      ...base,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          description: 'The cache missed, so the request goes on',
        },
      ],
    });

    expect(result.steps[0].text).toBe(
      'The cache missed, so the request goes on.'
    );
  });

  it('folds a parallel block into a single simultaneous clause', () => {
    const result = run({
      ...base,
      timeline: [
        {
          type: 'parallel',
          actions: [
            { type: 'move', object: 'req', from: 'browser', to: 'api' },
            { type: 'loading', object: 'browser' },
          ],
        },
      ],
    });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].text).toContain('At the same time:');
    expect(result.steps[0].text).toContain('GET /users travels');
    expect(result.steps[0].text).toContain('Browser is working');
  });

  it('falls back to ids when nothing carries a label', () => {
    const result = run({
      nodes: [
        { id: 'left', type: 'square' },
        { id: 'right', type: 'square' },
      ],
      packets: [{ id: 'blob', kind: 'simple_node' }],
      timeline: [{ type: 'move', object: 'blob', from: 'left', to: 'right' }],
    });

    expect(result.steps[0].text).toBe('blob travels from left to right.');
  });

  it('describes every action type without producing an empty step', () => {
    const result = run({
      nodes: [
        { id: 'a', type: 'square', text: 'A' },
        { id: 'b', type: 'square', text: 'B' },
        { id: 'sw', type: 'switch', text: 'S1' },
      ],
      packets: [{ id: 'p', kind: 'simple_node', body: 'payload' }],
      timeline: [
        { type: 'arrow', from: 'a', to: 'b' },
        { type: 'arrow', from: 'a', to: 'b', text: 'retry' },
        { type: 'loading', object: 'a' },
        {
          type: 'set_content',
          object: 'a',
          content: { type: 'code', value: 'const x = 1;' },
        },
        { type: 'comment', object: 'a', text: 'note' },
        { type: 'highlight', object: 'b' },
        { type: 'set_visible', object: 'b', visible: false },
        { type: 'set_visible', object: 'b', visible: true },
        { type: 'set_color', object: 'a', background_color: 'crimson' },
        { type: 'set_icon', object: 'a', icon: '7' },
        { type: 'set_icon', object: 'a', icon: '' },
        { type: 'rotate', object: 'a', to: 90 },
        { type: 'rotate', object: 'a', spin: 90 },
        { type: 'flow', route: ['a', 'b'] },
        { type: 'toggle', object: 'sw', closed: true },
        { type: 'toggle', object: 'sw', closed: false },
        { type: 'wait' },
      ],
    });

    expect(result.steps).toHaveLength(17);
    for (const step of result.steps) expect(step.text.trim()).not.toBe('');
    expect(result.steps[1].text).toContain('“retry”');
    expect(result.steps[9].text).toContain('“7”');
    expect(result.steps[13].text).toBe('Current flows along A → B.');
  });

  it('summarises a table instead of reading every cell', () => {
    const result = run({
      ...base,
      timeline: [
        {
          type: 'set_content',
          object: 'db',
          content: {
            type: 'table',
            columns: ['id', 'name'],
            rows_data: [
              [1, 'Alice'],
              [2, 'Bob'],
            ],
          },
        },
      ],
    });

    expect(result.steps[0].text).toBe(
      'Database now shows: a table of 2 rows, columns id, name.'
    );
  });

  it('clips overlong content to a readable clause', () => {
    const result = run({
      ...base,
      timeline: [
        {
          type: 'set_content',
          object: 'api',
          content: { type: 'code', value: 'x'.repeat(400) },
        },
      ],
    });

    expect(result.steps[0].text).toContain('…');
    expect(result.steps[0].text.length).toBeLessThan(140);
  });

  it('is a pure function of the spec', () => {
    const spec: DataFlowSpec = {
      ...base,
      timeline: [{ type: 'move', object: 'req', from: 'browser', to: 'api' }],
    };

    expect(run(spec)).toEqual(run(spec));
  });

  it('survives a spec with no timeline at all', () => {
    const result = run({ ...base, timeline: [] });

    expect(result.steps).toEqual([]);
    expect(result.summary).toContain('0 steps');
  });
});
