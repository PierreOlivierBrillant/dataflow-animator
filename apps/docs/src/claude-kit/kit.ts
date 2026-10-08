import { schemaToReference } from './schemaReference';
import { pinsToReference, pinNames, type PinsMap } from './pinsReference';
import {
  buildExamples,
  examplesIndex,
  CORE_EXAMPLE_IDS,
  type KitExample,
} from './examples';
import { createZip } from './zip';

/**
 * Assembles everything the site publishes for language models, from ONE set of
 * sources:
 *
 * - the Claude skill (a zip to upload to claude.ai, or to unzip into
 *   `~/.claude/skills/`);
 * - `llms.txt` (an index, per llmstxt.org) and `llms-full.txt` (the whole
 *   authoring context in one file);
 * - `claude/prompt.md`, what the playground's "Ask Claude" button copies.
 *
 * Pure: the build script (`scripts/build-claude-kit.mjs`) reads the inputs and
 * writes the outputs, so this can be tested without touching the disk.
 */

export interface KitInputs {
  /** The generated JSON Schema (`schema.generated.json`), parsed. */
  schema: object;
  /** The core's `COMPONENT_PINS`. */
  componentPins: PinsMap;
  /** `claude-kit/SKILL.md`. */
  skill: string;
  /** `claude-kit/guide.md`. */
  guide: string;
  /** `claude-kit/scripts/*`, by file name. */
  scripts: Record<string, string>;
  /** Absolute site root, with its trailing slash (`https://…/dataflow-animator/`). */
  siteUrl: string;
}

export interface KitFile {
  /** Relative to the site's `static/` directory. */
  path: string;
  content: string | Uint8Array;
}

/** The folder name a skill installs under; also its `name:` in SKILL.md. */
export const SKILL_NAME = 'dataflow-animator';
export const SKILL_ZIP_PATH = `claude/${SKILL_NAME}-skill.zip`;
export const PROMPT_PATH = 'claude/prompt.md';

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function inlineExample(ex: KitExample): string {
  return [
    `### \`${ex.id}\` — ${ex.title}`,
    '',
    ex.description,
    '',
    '```json',
    JSON.stringify(ex.spec, null, 2),
    '```',
  ].join('\n');
}

function llmsTxt(siteUrl: string, examples: KitExample[]): string {
  const docs = (path: string) => `${siteUrl}${path}`;
  return [
    '# DataFlow Animator',
    '',
    '> Compiles a JSON specification into a deterministic, scrubbable animation of',
    '> data flows (client/server exchanges, protocols, algorithms on trees and',
    '> graphs, electrical and logic circuits), played in a media player with steps,',
    '> a timeline, a text transcript and video export.',
    '',
    'To author an animation, read the authoring guide, then the field reference;',
    'start from the closest example. A spec opens in the playground by pasting it,',
    `or through a link \`${docs('playground/')}#spec=<token>\` where the token is the`,
    'minified JSON, raw-DEFLATE-compressed, base64url-encoded.',
    '',
    '## Authoring',
    '',
    `- [Authoring guide](${docs('claude/guide.md')}): the model, the layouts, the actions, and the mistakes to avoid`,
    `- [Field reference](${docs('claude/types.md')}): every field of the spec, generated from the JSON Schema`,
    `- [Component terminals](${docs('claude/pins.md')}): the \`"node:pin"\` names of every circuit symbol`,
    `- [JSON Schema](${docs('schema.json')}): the machine-checkable source of truth`,
    `- [Everything in one file](${docs('llms-full.txt')}): guide, reference, terminals and seven examples`,
    '',
    '## Examples',
    '',
    ...examples.map(
      (ex) =>
        `- [${ex.title}](${docs(`claude/examples/${ex.id}.json`)}): ${ex.description} (\`${ex.direction}\`)`
    ),
    '',
    '## Tools',
    '',
    `- [Claude skill](${docs(SKILL_ZIP_PATH)}): upload to claude.ai (Settings → Capabilities → Skills) or unzip into \`~/.claude/skills/\``,
    `- [Playground](${docs('playground/')}): live editor and player`,
    '',
    '## Optional',
    '',
    `- [Documentation](${docs('docs/intro/')}): the human-facing docs`,
    `- [Generating with Claude](${docs('docs/claude/')}): how the skill, the prompt and these files fit together`,
    '',
  ].join('\n');
}

function llmsFull(
  guide: string,
  types: string,
  pins: string,
  core: KitExample[]
): string {
  return [
    guide.trim(),
    '',
    '---',
    '',
    types.trim(),
    '',
    '---',
    '',
    pins.trim(),
    '',
    '---',
    '',
    '# Examples',
    '',
    'Real gallery demos. Copy the idiom of the closest one rather than inventing a',
    'structure.',
    '',
    ...core.flatMap((ex) => [inlineExample(ex), '']),
  ].join('\n');
}

/**
 * The prompt the playground copies: a role, the whole context, then an open
 * "request" section the button appends the visitor's words to.
 */
function promptMd(siteUrl: string, full: string): string {
  return [
    'You are writing an animation for DataFlow Animator: a JSON spec that the',
    'library compiles into a step-by-step animated diagram. The complete',
    'authoring context follows, then my request at the very end.',
    '',
    'Answer with:',
    '',
    '1. one or two sentences on what the animation will show, step by step;',
    '2. the COMPLETE spec in a single ```json block — strict JSON, no comments,',
    '   no trailing commas, no ellipsis;',
    `3. a reminder that I can paste it into ${siteUrl}playground/ to play it.`,
    '',
    'Write every user-visible string (labels, comments, packet text) in the',
    'language of my request. If you can run code, validate the spec against the',
    `schema at ${siteUrl}schema.json before answering.`,
    '',
    '---',
    '',
    full.trim(),
    '',
    '---',
    '',
    '# My request',
    '',
  ].join('\n');
}

export function buildKit(inputs: KitInputs): KitFile[] {
  const examples = buildExamples();
  const types = schemaToReference(inputs.schema);
  const pins = pinsToReference(inputs.componentPins);
  const core = CORE_EXAMPLE_IDS.map((id) => {
    const ex = examples.find((e) => e.id === id);
    if (!ex) throw new Error(`CORE_EXAMPLE_IDS: no demo "${id}"`);
    return ex;
  });
  const full = llmsFull(inputs.guide, types, pins, core);

  const skillFiles: KitFile[] = [
    { path: 'SKILL.md', content: inputs.skill },
    { path: 'reference/guide.md', content: inputs.guide },
    { path: 'reference/types.md', content: types },
    { path: 'reference/pins.md', content: pins },
    {
      path: 'reference/pins.json',
      content: json(pinNames(inputs.componentPins)),
    },
    { path: 'reference/schema.json', content: json(inputs.schema) },
    { path: 'examples/INDEX.md', content: examplesIndex(examples) },
    ...examples.map((ex) => ({
      path: `examples/${ex.id}.json`,
      content: json(ex.spec),
    })),
    ...Object.entries(inputs.scripts).map(([name, content]) => ({
      path: `scripts/${name}`,
      content,
    })),
  ];
  const zip = createZip(
    skillFiles.map((f) => ({
      path: `${SKILL_NAME}/${f.path}`,
      content: f.content,
    }))
  );

  return [
    { path: 'llms.txt', content: llmsTxt(inputs.siteUrl, examples) },
    { path: 'llms-full.txt', content: full },
    { path: PROMPT_PATH, content: promptMd(inputs.siteUrl, full) },
    { path: 'claude/guide.md', content: inputs.guide },
    { path: 'claude/types.md', content: types },
    { path: 'claude/pins.md', content: pins },
    ...examples.map((ex) => ({
      path: `claude/examples/${ex.id}.json`,
      content: json(ex.spec),
    })),
    { path: SKILL_ZIP_PATH, content: zip },
  ];
}
