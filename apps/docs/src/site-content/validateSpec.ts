import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { dataFlowSchema } from '@dataflow-animator/react';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(dataFlowSchema);

export interface SpecError {
  path: string;
  message: string;
}

/**
 * The user-visible wording of a validation error. English lives here as the
 * default, and a caller overrides key by key — the same contract the player's
 * own `labels` option follows, for the same reason: the playground renders in
 * both locales, and a message hardcoded in one of them is wrong in the other.
 */
export interface SpecErrorMessages {
  oneOf: (values: string) => string;
  expected: (value: string) => string;
  oneOfTruncated: (values: string, rest: number) => string;
  missingField: (field: string) => string;
  wrongType: (type: string) => string;
  tooSmall: (limit: number) => string;
  mustBeInteger: string;
  mustBeMultipleOf: (factor: number) => string;
  unknownError: string;
  unknownId: (id: string, available: string) => string;
  unknownIdNoList: (id: string) => string;
}

const DEFAULT_MESSAGES: SpecErrorMessages = {
  oneOf: (values) => `invalid value — accepted values: ${values}`,
  expected: (value) => `invalid value — expected: "${value}"`,
  oneOfTruncated: (values, rest) =>
    `invalid value — accepted values: ${values}, … (+${rest} more)`,
  missingField: (field) => `required field missing: "${field}"`,
  wrongType: (type) => `wrong type — expected: ${type}`,
  tooSmall: (limit) => `value too small — minimum: ${limit}`,
  mustBeInteger: 'must be an integer',
  mustBeMultipleOf: (factor) => `must be a multiple of ${factor}`,
  unknownError: 'unknown error',
  unknownId: (id, available) =>
    `unknown ID: "${id}" — available IDs: ${available}`,
  unknownIdNoList: (id) => `unknown ID: "${id}"`,
};

export function validateSpec(
  input: unknown,
  messages: Partial<SpecErrorMessages> = {}
): SpecError[] {
  const m: SpecErrorMessages = { ...DEFAULT_MESSAGES, ...messages };
  return [...formatErrors(runSchema(input), m), ...checkRefs(input, m)];
}

// ─── Ajv schema validation ────────────────────────────────────────────────────

function runSchema(input: unknown): ErrorObject[] {
  validate(input);
  return validate.errors ?? [];
}

function formatErrors(
  errors: ErrorObject[],
  m: SpecErrorMessages
): SpecError[] {
  // anyOf/oneOf parentes : bruit pur — les sous-erreurs de chaque branche
  // (const, required, type…) portent l'information utile.
  const useful = errors.filter(
    (e) => e.keyword !== 'anyOf' && e.keyword !== 'oneOf'
  );

  // Regrouper les erreurs "const" par chemin pour détecter les unions
  // discriminées (ex. : 7 branches anyOf avec type: { const: … }).
  const constByPath = new Map<string, string[]>();
  for (const e of useful) {
    if (e.keyword === 'const') {
      const path = e.instancePath || '/';
      const vals = constByPath.get(path) ?? [];
      vals.push(String((e.params as { allowedValue: unknown }).allowedValue));
      constByPath.set(path, vals);
    }
  }

  // Parent d'un discriminateur : les erreurs "required" sur ce parent sont
  // des faux positifs issus des branches non-sélectionnées de l'anyOf.
  const discriminatedParents = new Set<string>();
  for (const [path, vals] of constByPath) {
    if (vals.length > 1) {
      const lastSlash = path.lastIndexOf('/');
      discriminatedParents.add(lastSlash > 0 ? path.slice(0, lastSlash) : path);
    }
  }

  const seen = new Set<string>();
  const result: SpecError[] = [];

  for (const e of useful) {
    const path = e.instancePath || '/';

    if (e.keyword === 'const') {
      const key = `const:${path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const vals = constByPath.get(path) ?? [];
      result.push({
        path,
        message:
          vals.length > 1
            ? m.oneOf(vals.map((v) => `"${v}"`).join(', '))
            : m.expected(vals[0]),
      });
      continue;
    }

    if (e.keyword === 'required') {
      if (discriminatedParents.has(path)) continue;
      const { missingProperty } = e.params as { missingProperty: string };
      const key = `required:${path}:${missingProperty}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ path, message: m.missingField(missingProperty) });
      continue;
    }

    const formatted = formatSingle(e, m);
    const key = `${e.keyword}:${path}:${formatted.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(formatted);
  }

  return result;
}

function formatSingle(e: ErrorObject, m: SpecErrorMessages): SpecError {
  const path = e.instancePath || '/';
  switch (e.keyword) {
    case 'enum': {
      const { allowedValues } = e.params as { allowedValues: unknown[] };
      const shown = allowedValues.slice(0, 8);
      const rest = allowedValues.length - shown.length;
      const list = shown.map((v) => `"${v}"`).join(', ');
      return {
        path,
        message: rest > 0 ? m.oneOfTruncated(list, rest) : m.oneOf(list),
      };
    }
    case 'type': {
      const { type } = e.params as { type: string };
      return { path, message: m.wrongType(type) };
    }
    case 'minimum': {
      const { limit } = e.params as { comparison: string; limit: number };
      return { path, message: m.tooSmall(limit) };
    }
    case 'multipleOf': {
      const { multipleOf } = e.params as { multipleOf: number };
      return {
        path,
        message:
          multipleOf === 1 ? m.mustBeInteger : m.mustBeMultipleOf(multipleOf),
      };
    }
    default:
      return { path, message: e.message ?? m.unknownError };
  }
}

// ─── Cross-reference validation ───────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

/** Endpoint refs may target a named terminal with `"node:pin"` (circuit mode).
 *  Cross-reference checks only validate the NODE part, so drop any `:pin`. */
function refNodeId(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const i = value.indexOf(':');
  return i < 0 ? value : value.slice(0, i);
}

/** Everything the reference walk needs, in one place: the id sets it resolves
 *  against, the wording it reports with, and the sink it appends to. */
interface RefContext {
  staticIds: Set<string>;
  dynamicIds: Set<string>;
  connectionIds: Set<string>;
  actionIds: Set<string>;
  messages: SpecErrorMessages;
  errors: SpecError[];
}

function checkRefs(input: unknown, m: SpecErrorMessages): SpecError[] {
  if (!input || typeof input !== 'object') return [];
  const spec = input as AnyRecord;

  const ctx: RefContext = {
    staticIds: collectIds(spec.nodes),
    dynamicIds: collectIds(spec.packets),
    connectionIds: collectIds(spec.connections),
    actionIds: collectActionIds(spec.timeline),
    messages: m,
    errors: [],
  };

  // align_with référence un autre static_object
  if (Array.isArray(spec.nodes)) {
    for (let i = 0; i < spec.nodes.length; i++) {
      const obj = spec.nodes[i] as AnyRecord;
      checkRef(`/nodes/${i}/align_with`, obj.align_with, ctx.staticIds, ctx);
    }
  }

  // connections.from / .to référencent des nodes
  if (Array.isArray(spec.connections)) {
    for (let i = 0; i < spec.connections.length; i++) {
      const conn = spec.connections[i] as AnyRecord;
      checkRef(
        `/connections/${i}/from`,
        refNodeId(conn.from),
        ctx.staticIds,
        ctx
      );
      checkRef(`/connections/${i}/to`, refNodeId(conn.to), ctx.staticIds, ctx);
    }
  }

  if (Array.isArray(spec.timeline)) {
    walkActions(spec.timeline, '/timeline', ctx);
  }

  return ctx.errors;
}

function walkActions(
  actions: unknown[],
  basePath: string,
  ctx: RefContext
): void {
  for (let i = 0; i < actions.length; i++) {
    if (!actions[i] || typeof actions[i] !== 'object') continue;
    const a = actions[i] as AnyRecord;
    const p = `${basePath}/${i}`;

    // Ordonnancement inter-actions
    checkRef(`${p}/wait_for`, a.wait_for, ctx.actionIds, ctx);
    checkRef(`${p}/keep_until`, a.keep_until, ctx.actionIds, ctx);

    switch (a.type) {
      case 'move':
        checkRef(`${p}/object`, a.object, ctx.dynamicIds, ctx);
        checkRef(`${p}/from`, refNodeId(a.from), ctx.staticIds, ctx);
        checkRef(`${p}/to`, refNodeId(a.to), ctx.staticIds, ctx);
        break;
      case 'arrow':
        checkRef(`${p}/from`, refNodeId(a.from), ctx.staticIds, ctx);
        checkRef(`${p}/to`, refNodeId(a.to), ctx.staticIds, ctx);
        break;
      case 'loading':
      case 'set_content':
      case 'comment':
      case 'rotate':
      case 'toggle':
        checkRef(`${p}/object`, a.object, ctx.staticIds, ctx);
        break;
      case 'flow':
        if (Array.isArray(a.route)) {
          for (let j = 0; j < a.route.length; j++) {
            checkRef(
              `${p}/route/${j}`,
              refNodeId(a.route[j]),
              ctx.staticIds,
              ctx
            );
          }
        }
        break;
      case 'highlight': {
        // object peut être un static_object OU une connection (par ID)
        // Merge explicite pour éviter tout problème de transpilation Set spread
        const highlightIds = new Set<string>(Array.from(ctx.staticIds));
        for (const id of Array.from(ctx.connectionIds)) highlightIds.add(id);
        checkRef(`${p}/object`, a.object, highlightIds, ctx);
        break;
      }
      case 'parallel':
        if (Array.isArray(a.actions)) {
          walkActions(a.actions, `${p}/actions`, ctx);
        }
        break;
    }
  }
}

function checkRef(
  path: string,
  value: unknown,
  available: Set<string>,
  ctx: RefContext
): void {
  if (typeof value !== 'string' || available.has(value)) return;
  // Array.from évite les problèmes de transpilation babel avec [...]Set
  const list = Array.from(available)
    .map((id) => `"${id}"`)
    .join(', ');
  ctx.errors.push({
    path,
    message: list
      ? ctx.messages.unknownId(value, list)
      : ctx.messages.unknownIdNoList(value),
  });
}

function collectIds(arr: unknown): Set<string> {
  if (!Array.isArray(arr)) return new Set();
  const ids = new Set<string>();
  for (const item of arr) {
    if (item && typeof item === 'object') {
      const id = (item as AnyRecord).id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

function collectActionIds(actions: unknown): Set<string> {
  const ids = new Set<string>();
  function walk(arr: unknown): void {
    if (!Array.isArray(arr)) return;
    for (const a of arr) {
      if (!a || typeof a !== 'object') continue;
      const action = a as AnyRecord;
      if (typeof action.id === 'string') ids.add(action.id);
      if (action.type === 'parallel') walk(action.actions);
    }
  }
  walk(actions);
  return ids;
}
