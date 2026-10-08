import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { dataFlowSchema } from '@dataflow-animator/react';
import { COMPONENT_PINS } from '../../../../packages/core/src/engine/pins';
import {
  buildKit,
  PROMPT_PATH,
  SKILL_NAME,
  SKILL_ZIP_PATH,
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
const file = (path: string) => {
  const f = files.find((x) => x.path === path);
  if (!f) throw new Error(`no ${path} in the kit`);
  return f.content;
};
const text = (path: string) => {
  const content = file(path);
  if (typeof content !== 'string') throw new Error(`${path} is binary`);
  return content;
};

/** Reads a STORED zip back: its central directory, then each entry. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const dataStart = offset + 30 + view.getUint16(offset + 26, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    // An independent CRC (Node's zlib), not the writer's own table.
    expect(zlibCrc32(data)).toBe(crc);
    out.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return out;
}

describe('Claude kit', () => {
  const zip = file(SKILL_ZIP_PATH);
  if (!(zip instanceof Uint8Array)) throw new Error('the skill must be a zip');
  const entries = unzip(zip);

  it('packs the skill as ONE folder named after the skill', () => {
    for (const name of entries.keys()) {
      expect(name.startsWith(`${SKILL_NAME}/`)).toBe(true);
    }
    expect(entries.has(`${SKILL_NAME}/SKILL.md`)).toBe(true);
  });

  it('declares a SKILL.md frontmatter claude.ai accepts', () => {
    const skill = entries.get(`${SKILL_NAME}/SKILL.md`) ?? '';
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
    const name = /^name: (.+)$/m.exec(front)?.[1];
    const description = /^description: (.+)$/m.exec(front)?.[1] ?? '';
    expect(name).toBe(SKILL_NAME);
    expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('ships every file SKILL.md points at', () => {
    const skill = entries.get(`${SKILL_NAME}/SKILL.md`) ?? '';
    const referenced =
      skill.match(/`((?:reference|examples|scripts)\/[\w.-]+)`/g) ?? [];
    expect(referenced.length).toBeGreaterThan(0);
    for (const ref of referenced) {
      const path = ref.slice(1, -1);
      if (path.includes('<id>')) continue;
      expect(entries.has(`${SKILL_NAME}/${path}`), path).toBe(true);
    }
  });

  it('carries every gallery demo as a parseable example, and indexes it', () => {
    const index = entries.get(`${SKILL_NAME}/examples/INDEX.md`) ?? '';
    for (const demo of demos) {
      const json = entries.get(`${SKILL_NAME}/examples/${demo.id}.json`);
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

  it('is deterministic: the same inputs give the same zip, byte for byte', () => {
    const again = buildKit(inputs).find(
      (f) => f.path === SKILL_ZIP_PATH
    )?.content;
    expect(again).toEqual(zip);
  });
});
