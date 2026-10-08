import { describe, it, expect } from 'vitest';
import { dataFlowSchema } from '@dataflow-animator/react';
// The core's terminal map, from source: the same reach the build script makes
// (scripts/build-claude-kit.mjs). The skill's validator checks `"node:pin"`
// against it, so it must be the REAL map — a fixture would let a demo that
// wires a real terminal fail in the skill with every test here green.
import { COMPONENT_PINS } from '../../../../packages/core/src/engine/pins';
import {
  validateSpec as skillValidate,
  checkReferences,
} from '../../claude-kit/scripts/validate.mjs';
import { validateSpec as siteValidate } from '../site-content/validateSpec';
import { demos, getSpec } from '../site-content/demos';
import { clientServer } from '../site-content/demos/clientServer';
import { pinNames } from './pinsReference';
import type { Locale } from '../i18n/translations';

/**
 * The skill ships its OWN schema validator (zero dependencies, so it runs in
 * any sandbox) next to the site's Ajv-based one. Two paths answering the same
 * question: these tests prove they agree, on every valid demo and on a set of
 * broken specs, so the skill never rejects what the playground accepts nor
 * waves through what it rejects.
 */

const pins = pinNames(COMPONENT_PINS);
const run = (spec: unknown) =>
  skillValidate(spec, { schema: dataFlowSchema, pinNames: pins });
const base = clientServer('en');
const locales: Locale[] = ['en', 'fr'];

describe('skill validator — every gallery demo is clean', () => {
  for (const demo of demos) {
    for (const locale of locales) {
      it(`${demo.id} (${locale})`, () => {
        const spec = getSpec(demo, locale);
        expect(siteValidate(spec)).toEqual([]);
        const { errors, warnings } = run(spec);
        expect(errors).toEqual([]);
        expect(warnings).toEqual([]);
      });
    }
  }
});

// Each mutation breaks the spec in one way; both validators must reject it.
const broken: [string, unknown][] = [
  ['unknown node type', { ...base, nodes: [{ id: 'a', type: 'sever' }] }],
  [
    'unknown action type',
    {
      ...base,
      timeline: [{ type: 'mvoe', object: 'req', from: 'browser', to: 'api' }],
    },
  ],
  ['missing node id', { ...base, nodes: [{ type: 'server' }] }],
  [
    'string duration',
    {
      ...base,
      timeline: [{ type: 'wait', duration: 'long' }],
    },
  ],
  [
    'unknown node field',
    {
      ...base,
      nodes: [...base.nodes, { id: 'x', type: 'server', subicon: 'react' }],
    },
  ],
  [
    'x out of range',
    { ...base, nodes: [...base.nodes, { id: 'x', type: 'server', x: 1.4 }] },
  ],
  ['negative delay', { ...base, timeline: [{ type: 'wait', delay_ms: -5 }] }],
  [
    'bad connection style',
    { ...base, connections: [{ from: 'browser', to: 'api', style: 'wavy' }] },
  ],
  ['bad packet kind', { ...base, packets: [{ id: 'p', kind: 'tcp_packet' }] }],
  ['missing timeline', { nodes: base.nodes, packets: base.packets }],
  [
    'move of an unknown packet',
    {
      ...base,
      timeline: [{ type: 'move', object: 'nope', from: 'browser', to: 'api' }],
    },
  ],
  [
    'connection to an unknown node',
    { ...base, connections: [{ from: 'browser', to: 'cache' }] },
  ],
  [
    'unknown wait_for',
    { ...base, timeline: [{ type: 'wait', wait_for: 'ghost' }] },
  ],
];

describe('skill validator — agrees with the site on broken specs', () => {
  for (const [name, spec] of broken) {
    it(name, () => {
      expect(siteValidate(spec).length).toBeGreaterThan(0);
      expect(run(spec).errors.length).toBeGreaterThan(0);
    });
  }
});

describe('skill validator — messages a model can act on', () => {
  const messages = (spec: unknown) =>
    run(spec).errors.map((e: { message: string }) => e.message);

  it('suggests the right enum value for a typo, transpositions included', () => {
    const spec = {
      ...base,
      timeline: [{ type: 'mvoe', object: 'req', from: 'browser', to: 'api' }],
    };
    expect(messages(spec).join('\n')).toContain('did you mean "move"?');
  });

  it('maps a field named after another tool to ours', () => {
    const spec = {
      ...base,
      nodes: [...base.nodes, { id: 'x', type: 'server', subicon: 'react' }],
    };
    expect(messages(spec).join('\n')).toContain('did you mean "icon"?');
  });

  it('names one error per bad action, not one per union branch', () => {
    const spec = {
      ...base,
      timeline: [{ type: 'comment', target: 'browser', text: 'hi' }],
    };
    const errors = run(spec).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('/timeline/0/target');
  });

  it('rejects a terminal the component does not have, listing the real ones', () => {
    const spec = {
      direction: 'circuit',
      nodes: [
        { id: 'b', type: 'battery' },
        { id: 'r', type: 'resistor' },
      ],
      packets: [],
      connections: [
        { from: 'b:+', to: 'r:c' },
        { from: 'r:b', to: 'b:-' },
      ],
      timeline: [],
    };
    const errors = run(spec).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('/connections/0/to');
    expect(errors[0].message).toContain('Terminals: a, b');
  });

  it("checks a block's terminals against its own `pins`", () => {
    const spec = {
      direction: 'circuit',
      nodes: [
        { id: 's', type: 'signal' },
        {
          id: 'm',
          type: 'block',
          pins: [{ name: 'in' }, { name: 'out', side: 'right' }],
        },
      ],
      packets: [],
      connections: [{ from: 's', to: 'm:inp' }],
      timeline: [],
    };
    expect(messages(spec).join('\n')).toContain('did you mean "in"?');
  });

  it('warns about what renders nothing: a packet never moved', () => {
    const { errors, warnings } = checkReferences(
      { ...base, timeline: [] },
      pins
    );
    expect(errors).toEqual([]);
    expect(
      warnings.map((w: { message: string }) => w.message).join('\n')
    ).toContain('never moved');
  });

  it('flags duplicate ids', () => {
    const spec = { ...base, nodes: [...base.nodes, { ...base.nodes[0] }] };
    expect(messages(spec).join('\n')).toContain('duplicate node id');
  });
});
