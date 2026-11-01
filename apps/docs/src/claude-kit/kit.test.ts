import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dataFlowSchema } from '@dataflow-animator/react';
import { COMPONENT_PINS } from '../../../../packages/core/src/engine/pins';
import {
  buildKit,
  buildSkill,
  PROMPT_PATH,
  SKILL_NAME,
  type KitInputs,
} from './kit';
import { CORE_EXAMPLE_IDS } from './examples';
import { demos } from '../site-content/demos';

const kitDir = new URL('../../claude-kit/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, kitDir), 'utf8');

const inputs: KitInputs = {
  schema: dataFlowSchema,
  componentPins: COMPONENT_PINS,
  skill: read('SKILL.md'),
  guide: read('guide.md'),
  scripts: Object.fromEntries(
    readdirSync(new URL('scripts/', kitDir)).map((n) => [
      n,
      read(`scripts/${n}`),
    ])
  ),
  siteUrl: 'https://example.test/site/',
};
const files = buildKit(inputs);
const text = (path: string) => {
  const f = files.find((x) => x.path === path);
  if (!f) throw new Error(`no ${path} in the kit`);
  return f.content;
};

describe('Claude kit', () => {
  const skillFiles = new Map(
    buildSkill(inputs).map((f) => [f.path, f.content])
  );

  it('declares a SKILL.md frontmatter claude.ai accepts', () => {
    const skill = skillFiles.get('SKILL.md') ?? '';
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
    const name = /^name: (.+)$/m.exec(front)?.[1];
    const description = /^description: (.+)$/m.exec(front)?.[1] ?? '';
    expect(name).toBe(SKILL_NAME);
    expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('ships every file SKILL.md points at', () => {
    const skill = skillFiles.get('SKILL.md') ?? '';
    const referenced =
      skill.match(/`((?:reference|examples|scripts)\/[\w.-]+)`/g) ?? [];
    expect(referenced.length).toBeGreaterThan(0);
    for (const ref of referenced) {
      const path = ref.slice(1, -1);
      if (path.includes('<id>')) continue;
      expect(skillFiles.has(path), path).toBe(true);
    }
  });

  it('carries every gallery demo as a parseable example, and indexes it', () => {
    const index = skillFiles.get('examples/INDEX.md') ?? '';
    for (const demo of demos) {
      const json = skillFiles.get(`examples/${demo.id}.json`);
      expect(json, demo.id).toBeDefined();
      expect(() => JSON.parse(json ?? '')).not.toThrow();
      expect(index).toContain(`\`${demo.id}\``);
    }
  });

  it('documents every definition and every root field of the schema', () => {
    const types = text('claude/types.md');
    const schema = dataFlowSchema as {
      definitions: Record<string, { properties?: Record<string, unknown> }>;
    };
    for (const field of Object.keys(
      schema.definitions.DataFlowSpec.properties ?? {}
    )) {
      expect(types).toContain(`\`${field}`);
    }
    for (const name of Object.keys(schema.definitions)) {
      if (name.startsWith('Record<')) continue;
      expect(types).toContain(`## ${name}`);
    }
    // No TSDoc tag survives into the prose.
    expect(types).not.toContain('{@link');
  });

  it('lists aliases of one terminal together', () => {
    const pins = text('claude/pins.md');
    expect(pins).toMatch(
      /\| `diode` \| `a` \/ `anode` \(left\); `b` \/ `cathode` \(right\) \|/
    );
  });

  it('inlines the core examples in llms-full.txt and the prompt', () => {
    const full = text('llms-full.txt');
    for (const id of CORE_EXAMPLE_IDS) expect(full).toContain(`### \`${id}\``);
    const prompt = text(PROMPT_PATH);
    expect(prompt).toContain(full.trim());
    // The playground appends the visitor's request right after this heading.
    expect(prompt.trimEnd().endsWith('# My request')).toBe(true);
  });

  it('links llms.txt to files the kit actually publishes', () => {
    const index = text('llms.txt');
    const published = new Set(files.map((f) => f.path));
    const links = Array.from(
      index.matchAll(/\]\(https:\/\/example\.test\/site\/([^)]+)\)/g)
    ).map((m) => m[1]);
    expect(links.length).toBeGreaterThan(demos.length);
    for (const link of links) {
      // Pages and the schema are served by the site itself, not by the kit.
      if (link.endsWith('/') || link === 'schema.json') continue;
      expect(published.has(link), link).toBe(true);
    }
  });
});
