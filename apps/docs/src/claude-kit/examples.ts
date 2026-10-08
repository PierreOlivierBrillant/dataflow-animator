import type { DataFlowSpec } from '@dataflow-animator/react';
import { demos, getSpec, pickLocale, type Demo } from '../site-content/demos';

/**
 * The demo gallery, turned into worked examples for a language model.
 *
 * Every example is a REAL gallery demo resolved in English: it renders on the
 * site, it validates against the schema (the docs tests prove it for every
 * demo), and it is regenerated on each build — so an example can never teach a
 * field the engine no longer accepts.
 */

export interface KitExample {
  id: string;
  title: string;
  description: string;
  category: string;
  direction: string;
  /** Action `type`s the timeline uses, nested `parallel` children included. */
  actions: string[];
  /** Node `type`s the scene uses. */
  nodeTypes: string[];
  /** Notable root-level features (zones, tree, connections, packet kinds…). */
  features: string[];
  spec: DataFlowSpec;
}

/**
 * The few examples inlined in the single-file context (`llms-full.txt`, the
 * "copy for Claude" prompt). One per layout family, the smallest that still
 * shows the family's idiom: everything else stays one lookup away in the
 * index, and inlining all 47 would cost ~200 KB of context for little gain.
 */
export const CORE_EXAMPLE_IDS = [
  'clientServer', // flow layout, http/sql packets, set_content, comments
  'loadBalancer', // parallel, stacked lanes
  'signalr', // circular, main node
  'bstInsert', // tree block
  'mst', // graph layout, set_color on edges
  'circuit', // circuit loop, flow, toggle
  'halfAdder', // circuit feed-forward logic, signals
] as const;

function collectActions(actions: unknown, into: Set<string>): void {
  if (!Array.isArray(actions)) return;
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    const action = a as { type?: unknown; actions?: unknown };
    if (typeof action.type === 'string') into.add(action.type);
    if (action.type === 'parallel') collectActions(action.actions, into);
  }
}

function featuresOf(spec: DataFlowSpec): string[] {
  const features: string[] = [];
  const kinds = new Set(spec.packets.map((p) => p.kind));
  if (kinds.size)
    features.push(`packets: ${Array.from(kinds).sort().join(', ')}`);
  if (spec.connections?.length) features.push('connections');
  if (spec.zones?.length) features.push('zones');
  if (spec.tree) features.push('tree');
  if (spec.diagonal_wires) features.push('diagonal_wires');
  if (spec.nodes.some((n) => n.content)) features.push('node content');
  if (spec.nodes.some((n) => n.x !== undefined)) features.push('x/y pinned');
  if (spec.nodes.some((n) => n.visible === false))
    features.push('hidden nodes');
  return features;
}

function toExample(demo: Demo): KitExample {
  const spec = getSpec(demo, 'en');
  const actions = new Set<string>();
  collectActions(spec.timeline, actions);
  return {
    id: demo.id,
    title: pickLocale(demo.title, 'en'),
    description: pickLocale(demo.description, 'en'),
    category: demo.category,
    direction: spec.direction ?? 'left-to-right',
    actions: Array.from(actions).sort(),
    nodeTypes: Array.from(new Set(spec.nodes.map((n) => n.type))).sort(),
    features: featuresOf(spec),
    spec,
  };
}

export function buildExamples(): KitExample[] {
  return demos.map(toExample);
}

/** Pipes would end the table cell they sit in. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

/**
 * One row per example, grouped by layout direction: the direction is the first
 * decision an author makes, and the one that most changes the spec's shape.
 */
export function examplesIndex(examples: KitExample[]): string {
  const byDirection = new Map<string, KitExample[]>();
  for (const ex of examples) {
    const list = byDirection.get(ex.direction) ?? [];
    list.push(ex);
    byDirection.set(ex.direction, list);
  }
  const lines = [
    '# Examples index',
    '',
    'Every gallery demo of the DataFlow Animator site, as a spec that renders and',
    'validates. Open `<id>.json` in this folder. Pick the one or two closest to the',
    'request by layout first, then by the actions they use.',
    '',
  ];
  for (const [direction, list] of byDirection) {
    lines.push(
      `## \`${direction}\``,
      '',
      '| id | title | what it shows | actions | node types | features |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const ex of list) {
      lines.push(
        `| \`${ex.id}\` | ${cell(ex.title)} | ${cell(ex.description)} | ${ex.actions.join(', ')} | ${ex.nodeTypes.join(', ')} | ${ex.features.join('; ')} |`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
