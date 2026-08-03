import { describe, it, expect } from 'vitest';
import { validateSpec } from './validateSpec';
import { clientServer } from './demos/clientServer';
import { demos, getSpec } from './demos';
import type { Locale } from '../i18n/translations';

// Since the site went bilingual, a demo spec is a builder `(locale) => spec`,
// not a spec. validateSpec takes the RESOLVED spec — spreading the builder
// would silently yield `{}` and make every assertion below vacuous.
const baseSpec = clientServer('en');

const locales: Locale[] = ['en', 'fr'];

describe('validateSpec — schema validation', () => {
  it('returns an empty array for a valid spec', () => {
    expect(validateSpec(baseSpec)).toEqual([]);
  });

  it('reports an unknown action type with the list of accepted values', () => {
    const spec = {
      ...baseSpec,
      timeline: [{ type: 'mov', object: 'req', from: 'browser', to: 'api' }],
    };
    const errors = validateSpec(spec);
    expect(errors.length).toBeGreaterThan(0);
    const err = errors.find((e) => e.path.includes('type'));
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/valeurs acceptées/);
    expect(err!.message).toContain('"move"');
  });

  it('reports an invalid node type with the list of accepted values', () => {
    const spec = {
      ...baseSpec,
      nodes: [{ id: 'x', type: 'pc', lane: 1 }],
    };
    const errors = validateSpec(spec);
    const err = errors.find(
      (e) => e.path.includes('/nodes') && e.path.includes('type')
    );
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/valeurs acceptées/);
    expect(err!.message).toContain('"laptop"');
  });

  it('reports a missing required field with the field name', () => {
    const spec = {
      ...baseSpec,
      nodes: [{ type: 'laptop', lane: 1 }],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path.startsWith('/nodes'));
    expect(err).toBeDefined();
    expect(err!.message).toContain('"id"');
  });

  it('reports a wrong type with the expected type', () => {
    const spec = {
      ...baseSpec,
      nodes: [{ id: 'x', type: 'laptop', lane: '1' }],
    };
    const errors = validateSpec(spec);
    const err = errors.find(
      (e) => e.path.includes('/nodes') && e.path.includes('lane')
    );
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/type incorrect/);
    expect(err!.message).toContain('number');
  });
});

describe('validateSpec — every gallery demo is valid', () => {
  // Both locales: a translation can introduce its own invalid content.
  it.each(
    demos.flatMap((d) => locales.map((locale) => [d.id, locale, d] as const))
  )(
    'demo "%s" (%s) passes the schema and reference validation',
    (_id, locale, demo) => {
      expect(validateSpec(getSpec(demo, locale))).toEqual([]);
    }
  );
});

describe('validateSpec — duration, icon, language', () => {
  it('reports a negative duration', () => {
    const spec = {
      ...baseSpec,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          duration: -100,
        },
      ],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path.includes('duration'));
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/minimum/);
  });

  it('reports a zero duration', () => {
    const spec = {
      ...baseSpec,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          duration: 0,
        },
      ],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path.includes('duration'));
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/minimum/);
  });

  it('reports a non-integer duration', () => {
    const spec = {
      ...baseSpec,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          duration: 1.5,
        },
      ],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path.includes('duration'));
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/entier/);
  });

  it('emits no error for a positive integer duration', () => {
    const spec = {
      ...baseSpec,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          duration: 500,
        },
      ],
    };
    const errors = validateSpec(spec);
    expect(errors.filter((e) => e.path.includes('duration'))).toEqual([]);
  });

  it('reports an unknown language in packet_content', () => {
    const spec = {
      ...baseSpec,
      packets: [
        {
          id: 'req',
          kind: 'http_packet',
          packet_content: {
            body: { type: 'text', content: 'code', language: 'rust' },
          },
        },
      ],
    };
    const errors = validateSpec(spec);
    const err = errors.find(
      (e) => e.path.includes('language') || e.message.includes('rust')
    );
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/valeurs acceptées|valeur invalide/);
  });

  it('emits no error for a supported language', () => {
    const spec = {
      ...baseSpec,
      packets: [
        {
          id: 'req',
          kind: 'http_packet',
          packet_content: {
            body: {
              type: 'text',
              content: 'code',
              language: 'typescript',
            },
          },
        },
      ],
    };
    const errors = validateSpec(spec);
    expect(errors.filter((e) => e.path.includes('language'))).toEqual([]);
  });

  it('emits no error for a free-form (text) icon', () => {
    const spec = {
      ...baseSpec,
      nodes: [{ id: 'browser', type: 'laptop', lane: 1, icon: 'v2' }],
    };
    expect(validateSpec(spec).filter((e) => e.path.includes('icon'))).toEqual(
      []
    );
  });
});

describe('validateSpec — cross-reference validation', () => {
  it('reports an unknown dynamic ID in move.object with the available IDs', () => {
    const spec = {
      ...baseSpec,
      timeline: [{ type: 'move', object: 'ghost', from: 'browser', to: 'api' }],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path === '/timeline/0/object');
    expect(err).toBeDefined();
    expect(err!.message).toContain('"ghost"');
    expect(err!.message).toMatch(/IDs disponibles/);
    expect(err!.message).toContain('"req"');
  });

  it('reports an unknown static ID in move.from with the available IDs', () => {
    const spec = {
      ...baseSpec,
      timeline: [{ type: 'move', object: 'req', from: 'nowhere', to: 'api' }],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path === '/timeline/0/from');
    expect(err).toBeDefined();
    expect(err!.message).toContain('"nowhere"');
    expect(err!.message).toContain('"browser"');
  });

  it('reports an unknown ID in connections.from', () => {
    const spec = {
      ...baseSpec,
      connections: [{ from: 'ghost', to: 'api' }],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path === '/connections/0/from');
    expect(err).toBeDefined();
    expect(err!.message).toContain('"ghost"');
    expect(err!.message).toContain('"browser"');
  });

  it('reports a wait_for that points to a non-existent action ID', () => {
    const spec = {
      ...baseSpec,
      timeline: [
        {
          type: 'move',
          object: 'req',
          from: 'browser',
          to: 'api',
          wait_for: 'no_such_action',
        },
      ],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path === '/timeline/0/wait_for');
    expect(err).toBeDefined();
    expect(err!.message).toContain('"no_such_action"');
  });

  it('reports no reference error for the clientServer spec', () => {
    const refErrors = validateSpec(baseSpec).filter((e) =>
      e.message.startsWith('ID inconnu')
    );
    expect(refErrors).toEqual([]);
  });
});
