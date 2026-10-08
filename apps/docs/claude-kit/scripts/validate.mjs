#!/usr/bin/env node
// Validates a DataFlow Animator spec: the JSON Schema, then every cross-reference
// the schema cannot express (an `object` that names no packet, a `"node:pin"`
// whose pin the component does not have, a duplicate id…).
//
// ZERO dependencies on purpose: it runs in whatever sandbox Claude has (Node 18+),
// with no network and no `npm install`. The schema validator therefore implements
// only the keywords the generated schema uses — `$ref`, `anyOf`, `type`, `enum`,
// `const`, `properties`, `required`, `additionalProperties`, `items`, `minimum`,
// `maximum`, `multipleOf` — and the docs site's tests prove it agrees with Ajv on
// every gallery demo and on a set of broken specs.
//
// Usage:
//   node scripts/validate.mjs spec.json        (or `-` to read stdin)
//   node scripts/validate.mjs spec.json --schema path/to/schema.json --pins path/to/pins.json
//
// Exit code 0 = valid (warnings may still be printed), 1 = errors.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── JSON Schema subset ──────────────────────────────────────────────────────

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v, t) {
  const actual = typeName(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

/** Optimal-string-alignment distance: a swapped pair of letters counts as one
 *  edit, which is the typo a fast writer makes most (`mvoe`). */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Names other diagram tools (or older versions of this one) use for a field
 *  that is spelled differently here — too far apart for an edit distance. */
const KNOWN_ALIASES = {
  subicon: 'icon',
  is_main: 'main',
  label: 'text',
  title: 'text',
  target: 'object',
  node: 'object',
  source: 'from',
  target_node: 'to',
  messages: 'packets',
  steps: 'timeline',
  actions: 'timeline',
  edges: 'connections',
  links: 'connections',
  groups: 'zones',
  kind: 'type',
  shape: 'type',
};

/** The closest candidate, when it is close enough to be a plausible typo. */
function suggest(value, candidates) {
  const text = String(value);
  const alias = KNOWN_ALIASES[text];
  if (alias !== undefined && candidates.includes(alias)) return alias;
  if (text.length < 2) return null;
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = editDistance(text.toLowerCase(), String(c).toLowerCase());
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best !== null && bestScore <= Math.max(1, Math.floor(text.length / 3))
    ? best
    : null;
}

function quoteList(values, max = 40) {
  const shown = values.slice(0, max).map((v) => JSON.stringify(v));
  return values.length > max
    ? `${shown.join(', ')}, … (+${values.length - max} more)`
    : shown.join(', ');
}

/**
 * Validates `value` against `schema`, returning `{ path, message, keyword }`
 * records. `root` resolves `$ref`s.
 */
export function validateSchema(schema, value, root = schema) {
  const errors = [];
  check(schema, value, '', errors, root);
  return errors;
}

function resolveRef(ref, root) {
  const parts = ref.replace(/^#\//, '').split('/').map(decodeURIComponent);
  let node = root;
  for (const p of parts) node = node?.[p];
  if (!node) throw new Error(`unresolvable $ref: ${ref}`);
  return node;
}

function check(s, v, path, out, root) {
  if (s.$ref) {
    check(resolveRef(s.$ref, root), v, path, out, root);
    return;
  }
  if (s.anyOf) {
    checkAnyOf(s.anyOf, v, path, out, root);
    return;
  }
  if (s.const !== undefined && v !== s.const) {
    out.push({
      path,
      keyword: 'const',
      expected: s.const,
      message: `must be ${JSON.stringify(s.const)}`,
    });
    return;
  }
  if (s.enum && !s.enum.includes(v)) {
    const close = suggest(v, s.enum);
    out.push({
      path,
      keyword: 'enum',
      message:
        `invalid value ${JSON.stringify(v)}` +
        (close !== null ? ` — did you mean ${JSON.stringify(close)}?` : '') +
        ` Accepted: ${quoteList(s.enum)}`,
    });
    return;
  }
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => matchesType(v, t))) {
      out.push({
        path,
        keyword: 'type',
        message: `wrong type — expected ${types.join(' | ')}, got ${typeName(v)}`,
      });
      return;
    }
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) {
      out.push({ path, keyword: 'minimum', message: `must be ≥ ${s.minimum}` });
    }
    if (s.maximum !== undefined && v > s.maximum) {
      out.push({ path, keyword: 'maximum', message: `must be ≤ ${s.maximum}` });
    }
    if (s.multipleOf !== undefined) {
      const q = v / s.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-9) {
        out.push({
          path,
          keyword: 'multipleOf',
          message:
            s.multipleOf === 1
              ? 'must be an integer'
              : `must be a multiple of ${s.multipleOf}`,
        });
      }
    }
  }
  if (Array.isArray(v) && s.items) {
    v.forEach((item, i) => check(s.items, item, `${path}/${i}`, out, root));
  }
  if (typeName(v) === 'object') {
    const props = s.properties ?? {};
    for (const field of s.required ?? []) {
      if (!(field in v)) {
        out.push({
          path,
          keyword: 'required',
          message: `required field missing: "${field}"`,
        });
      }
    }
    for (const [field, fieldValue] of Object.entries(v)) {
      const sub = `${path}/${field}`;
      if (props[field]) {
        check(props[field], fieldValue, sub, out, root);
      } else if (s.additionalProperties === false) {
        const close = suggest(field, Object.keys(props));
        out.push({
          path: sub,
          keyword: 'additionalProperties',
          message:
            `unknown field "${field}"` +
            (close ? ` — did you mean "${close}"?` : '') +
            ` Allowed here: ${Object.keys(props).join(', ')}`,
        });
      } else if (typeof s.additionalProperties === 'object') {
        check(s.additionalProperties, fieldValue, sub, out, root);
      }
    }
  }
}

/**
 * `anyOf` passes if ANY branch does. When none does, reporting every branch's
 * errors would bury the one useful message under a dozen irrelevant ones (an
 * action is a union of 16 shapes). So: a branch rejected by a DISCRIMINATOR
 * (`type` / `kind` const one level down) is discarded; of the rest, the branch
 * with the fewest errors is the one the author meant. If every branch is
 * rejected by its discriminator, the discriminator itself is what is wrong.
 */
function checkAnyOf(branches, v, path, out, root) {
  const results = branches.map((b) => {
    const errs = [];
    check(b, v, path, errs, root);
    return errs;
  });
  if (results.some((errs) => errs.length === 0)) return;

  const discriminated = (errs) =>
    errs.some(
      (e) =>
        e.keyword === 'const' &&
        e.path.startsWith(`${path}/`) &&
        !e.path.slice(path.length + 1).includes('/')
    );
  const candidates = results.filter((errs) => !discriminated(errs));
  // `string | number` given a boolean: every branch fails on its type alone,
  // and naming only the first branch's type would be wrong.
  const typeOnly = candidates.every(
    (errs) =>
      errs.length === 1 && errs[0].keyword === 'type' && errs[0].path === path
  );
  if (candidates.length > 1 && typeOnly) {
    const expected = candidates.map((errs) =>
      errs[0].message.replace(/^wrong type — expected (.*), got .*$/, '$1')
    );
    out.push({
      path,
      keyword: 'type',
      message: `wrong type — expected ${[...new Set(expected)].join(' | ')}, got ${typeName(v)}`,
    });
    return;
  }
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (b.length < a.length ? b : a));
    out.push(...best);
    return;
  }
  // Every branch disagrees on the discriminator: name the accepted values.
  const byPath = new Map();
  for (const errs of results) {
    for (const e of errs) {
      if (e.keyword !== 'const') continue;
      const list = byPath.get(e.path) ?? [];
      list.push(e.expected);
      byPath.set(e.path, list);
    }
  }
  const [discPath, values] = [...byPath.entries()].reduce((a, b) =>
    b[1].length > a[1].length ? b : a
  );
  const actual = discPath
    .slice(path.length + 1)
    .split('/')
    .reduce((o, k) => o?.[k], v);
  const close = suggest(actual, values);
  out.push({
    path: discPath,
    keyword: 'enum',
    message:
      `invalid value ${JSON.stringify(actual)}` +
      (close !== null ? ` — did you mean ${JSON.stringify(close)}?` : '') +
      ` Accepted: ${quoteList([...new Set(values)])}`,
  });
}

// ─── Cross-references ────────────────────────────────────────────────────────

function ids(list) {
  return new Set(
    (Array.isArray(list) ? list : [])
      .map((x) => x?.id)
      .filter((id) => typeof id === 'string')
  );
}

function walkActions(actions, base, visit) {
  if (!Array.isArray(actions)) return;
  actions.forEach((a, i) => {
    if (!a || typeof a !== 'object') return;
    const p = `${base}/${i}`;
    visit(a, p);
    if (a.type === 'parallel') walkActions(a.actions, `${p}/actions`, visit);
  });
}

/**
 * Checks what the schema cannot: that every id an action, a connection, a zone
 * or the tree NAMES exists, that ids are unique, and that every `"node:pin"`
 * names a terminal the component has. `pinNames` maps a component type to its
 * terminal names (`reference/pins.json`).
 */
export function checkReferences(spec, pinNames = {}) {
  const errors = [];
  const warnings = [];
  if (!spec || typeof spec !== 'object') return { errors, warnings };

  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const packets = Array.isArray(spec.packets) ? spec.packets : [];
  const connections = Array.isArray(spec.connections) ? spec.connections : [];
  const zones = Array.isArray(spec.zones) ? spec.zones : [];
  const nodeIds = ids(nodes);
  const packetIds = ids(packets);
  const connectionIds = ids(connections);
  const zoneIds = ids(zones);
  const actionIds = new Set();
  const nodesById = new Map(nodes.map((n) => [n?.id, n]));

  const dup = (list, label, base) => {
    const seen = new Set();
    list.forEach((x, i) => {
      if (typeof x?.id !== 'string') return;
      if (seen.has(x.id)) {
        errors.push({
          path: `${base}/${i}/id`,
          message: `duplicate ${label} id "${x.id}"`,
        });
      }
      seen.add(x.id);
    });
  };
  dup(nodes, 'node', '/nodes');
  dup(packets, 'packet', '/packets');
  const actionList = [];
  walkActions(spec.timeline, '/timeline', (a, p) => actionList.push([a, p]));
  for (const [a, p] of actionList) {
    if (typeof a.id !== 'string') continue;
    if (actionIds.has(a.id)) {
      errors.push({
        path: `${p}/id`,
        message: `duplicate action id "${a.id}"`,
      });
    }
    actionIds.add(a.id);
  }

  const ref = (path, value, available, what) => {
    if (typeof value !== 'string' || available.has(value)) return;
    const close = suggest(value, [...available]);
    errors.push({
      path,
      message:
        `unknown ${what} "${value}"` +
        (close ? ` — did you mean "${close}"?` : '') +
        (available.size ? ` Known: ${quoteList([...available], 30)}` : ''),
    });
  };

  // A `"node:pin"` endpoint: the node must exist, and the pin must be a
  // terminal of that node's type (or of the block's own `pins`).
  const endpoint = (path, value) => {
    if (typeof value !== 'string') return;
    const colon = value.indexOf(':');
    const nodeId = colon < 0 ? value : value.slice(0, colon);
    ref(path, nodeId, nodeIds, 'node');
    if (colon < 0 || !nodeIds.has(nodeId)) return;
    const pin = value.slice(colon + 1);
    const node = nodesById.get(nodeId);
    const names =
      node.type === 'block'
        ? (node.pins ?? []).map((p) => p?.name)
        : pinNames[node.type];
    if (!names) {
      warnings.push({
        path,
        message: `"${node.type}" has no named terminals — "${value}" anchors on the whole node; write "${nodeId}"`,
      });
    } else if (!names.includes(pin)) {
      const close = suggest(pin, names);
      errors.push({
        path,
        message:
          `"${nodeId}" (${node.type}) has no terminal "${pin}"` +
          (close ? ` — did you mean "${close}"?` : '') +
          ` Terminals: ${names.join(', ')}`,
      });
    }
  };

  nodes.forEach((n, i) =>
    ref(`/nodes/${i}/align_with`, n?.align_with, nodeIds, 'node')
  );
  connections.forEach((c, i) => {
    endpoint(`/connections/${i}/from`, c?.from);
    endpoint(`/connections/${i}/to`, c?.to);
  });
  const zoneTargets = new Set([...nodeIds, ...zoneIds]);
  zones.forEach((z, i) =>
    (Array.isArray(z?.contains) ? z.contains : []).forEach((id, j) =>
      ref(`/zones/${i}/contains/${j}`, id, zoneTargets, 'node or zone')
    )
  );

  if (spec.direction === 'tree' && !spec.tree) {
    errors.push({
      path: '/tree',
      message: 'direction "tree" requires a `tree` block',
    });
  }
  if (spec.tree && typeof spec.tree === 'object') {
    ref('/tree/root', spec.tree.root, nodeIds, 'node');
    for (const [parent, kids] of Object.entries(spec.tree.children ?? {})) {
      ref(`/tree/children/${parent}`, parent, nodeIds, 'node');
      ref(`/tree/children/${parent}/left`, kids?.left, nodeIds, 'node');
      ref(`/tree/children/${parent}/right`, kids?.right, nodeIds, 'node');
    }
  }

  const nodeOrConnection = new Set([...nodeIds, ...connectionIds]);
  const moved = new Set();
  for (const [a, p] of actionList) {
    ref(`${p}/wait_for`, a.wait_for, actionIds, 'action id');
    ref(`${p}/keep_until`, a.keep_until, actionIds, 'action id');
    switch (a.type) {
      case 'move':
        ref(`${p}/object`, a.object, packetIds, 'packet');
        moved.add(a.object);
        endpoint(`${p}/from`, a.from);
        endpoint(`${p}/to`, a.to);
        break;
      case 'arrow':
        endpoint(`${p}/from`, a.from);
        endpoint(`${p}/to`, a.to);
        break;
      case 'loading':
      case 'set_content':
      case 'comment':
      case 'rotate':
      case 'toggle':
      case 'set_visible':
      case 'set_icon':
      case 'rotate_subtree':
        ref(`${p}/object`, a.object, nodeIds, 'node');
        break;
      case 'highlight':
      case 'set_color':
        ref(`${p}/object`, a.object, nodeOrConnection, 'node or connection id');
        break;
      case 'flow':
        (Array.isArray(a.route) ? a.route : []).forEach((r, j) =>
          endpoint(`${p}/route/${j}`, r)
        );
        break;
    }
  }

  packets.forEach((pk, i) => {
    if (typeof pk?.id === 'string' && !moved.has(pk.id)) {
      warnings.push({
        path: `/packets/${i}`,
        message: `packet "${pk.id}" is never moved — a packet only appears during a \`move\``,
      });
    }
  });
  const positional = spec.direction === 'graph' || spec.direction === 'circuit';
  nodes.forEach((n, i) => {
    if (!positional && (n?.x !== undefined || n?.y !== undefined)) {
      warnings.push({
        path: `/nodes/${i}`,
        message: `x / y are ignored outside direction "graph" and "circuit"`,
      });
    }
  });

  return { errors, warnings };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/** Schema errors first (structure), then references (meaning). */
export function validateSpec(spec, { schema, pinNames = {} }) {
  const schemaErrors = validateSchema(schema, spec).map(
    ({ path, message }) => ({
      path: path || '/',
      message,
    })
  );
  const { errors, warnings } = checkReferences(spec, pinNames);
  return { errors: [...schemaErrors, ...errors], warnings };
}

function countSteps(timeline) {
  return Array.isArray(timeline) ? timeline.length : 0;
}

function main(argv) {
  const here = dirname(fileURLToPath(import.meta.url));
  const args = argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    if (i < 0) return fallback;
    const [value] = args.splice(i, 2).slice(1);
    return value;
  };
  const schemaPath = flag(
    '--schema',
    join(here, '..', 'reference', 'schema.json')
  );
  const pinsPath = flag('--pins', join(here, '..', 'reference', 'pins.json'));
  const file = args[0];
  if (!file) {
    console.error(
      'usage: node validate.mjs <spec.json | -> [--schema f] [--pins f]'
    );
    return 2;
  }
  let spec;
  try {
    spec = JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8'));
  } catch (err) {
    console.error(`✗ not valid JSON: ${err.message}`);
    return 1;
  }
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  let pinNames = {};
  try {
    pinNames = JSON.parse(readFileSync(pinsPath, 'utf8'));
  } catch {
    // Pins are an extra check; the schema alone still validates.
  }
  const { errors, warnings } = validateSpec(spec, { schema, pinNames });
  for (const w of warnings) console.log(`⚠ ${w.path} — ${w.message}`);
  if (errors.length) {
    console.log(`✗ ${errors.length} error${errors.length > 1 ? 's' : ''}`);
    for (const e of errors) console.log(`  ${e.path} — ${e.message}`);
    return 1;
  }
  console.log(
    `✓ valid — ${spec.nodes.length} nodes, ${spec.packets.length} packets, ${countSteps(spec.timeline)} steps`
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv);
}
