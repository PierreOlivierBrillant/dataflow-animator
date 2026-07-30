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

describe('validateSpec — validation de schéma', () => {
  it('retourne un tableau vide pour une spec valide', () => {
    expect(validateSpec(baseSpec)).toEqual([]);
  });

  it("signale un type d'action inconnu avec la liste des valeurs acceptées", () => {
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

  it('signale un type de nœud invalide avec la liste des valeurs acceptées', () => {
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

  it('signale un champ required manquant avec le nom du champ', () => {
    const spec = {
      ...baseSpec,
      nodes: [{ type: 'laptop', lane: 1 }],
    };
    const errors = validateSpec(spec);
    const err = errors.find((e) => e.path.startsWith('/nodes'));
    expect(err).toBeDefined();
    expect(err!.message).toContain('"id"');
  });

  it('signale un type incorrect avec le type attendu', () => {
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

describe('validateSpec — toutes les démos de la galerie sont valides', () => {
  // Both locales: a translation can introduce its own invalid content.
  it.each(
    demos.flatMap((d) => locales.map((locale) => [d.id, locale, d] as const))
  )(
    'la démo « %s » (%s) passe le schéma et la validation des références',
    (_id, locale, demo) => {
      expect(validateSpec(getSpec(demo, locale))).toEqual([]);
    }
  );
});

describe('validateSpec — duration, icon, language', () => {
  it('signale une duration négative', () => {
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

  it('signale une duration nulle', () => {
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

  it('signale une duration non entière', () => {
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

  it("n'émet pas d'erreur pour une duration entière positive", () => {
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

  it('signale un language inconnu dans packet_content', () => {
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

  it("n'émet pas d'erreur pour un language supporté", () => {
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

  it("n'émet pas d'erreur pour une icône libre (texte)", () => {
    const spec = {
      ...baseSpec,
      nodes: [{ id: 'browser', type: 'laptop', lane: 1, icon: 'v2' }],
    };
    expect(validateSpec(spec).filter((e) => e.path.includes('icon'))).toEqual(
      []
    );
  });
});

describe('validateSpec — validation des références croisées', () => {
  it('signale un ID dynamique inconnu dans move.object avec les IDs disponibles', () => {
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

  it('signale un ID statique inconnu dans move.from avec les IDs disponibles', () => {
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

  it('signale un ID inconnu dans connections.from', () => {
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

  it("signale un wait_for qui pointe vers un ID d'action inexistant", () => {
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

  it('ne signale aucune erreur de référence pour la spec clientServer', () => {
    const refErrors = validateSpec(baseSpec).filter((e) =>
      e.message.startsWith('ID inconnu')
    );
    expect(refErrors).toEqual([]);
  });
});
