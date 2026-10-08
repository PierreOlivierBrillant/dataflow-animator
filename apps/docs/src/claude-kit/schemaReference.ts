/**
 * Renders the JSON Schema as a compact Markdown reference, one section per
 * definition, for a language model to READ.
 *
 * The raw schema is the source of truth but a poor thing to read: ~100 KB of
 * nested `anyOf`/`$ref` in which the field list of a node is spread over a
 * dozen objects. This flattens each definition into a `field: type — doc`
 * list, so the reference costs a fraction of the tokens and is regenerated
 * from the schema on every build — it cannot drift from it.
 */

type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  description?: string;
  minimum?: number;
  maximum?: number;
  definitions?: Record<string, Schema>;
};

/** Definition names are kept as-is, except the generator's `Record<…>` ones. */
function refName(ref: string): string {
  const name = decodeURIComponent(ref.replace('#/definitions/', ''));
  const record = /^Record<string,(\w+)>$/.exec(name);
  return record ? `{ [id]: ${record[1]} }` : name;
}

function typeOf(s: Schema): string {
  if (s.$ref) return refName(s.$ref);
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  if (s.anyOf) return s.anyOf.map(typeOf).join(' | ');
  if (s.type === 'array')
    return `${s.items ? wrap(typeOf(s.items)) : 'unknown'}[]`;
  if (s.type === 'object' && s.properties) return 'object';
  if (s.type === 'object' && typeof s.additionalProperties === 'object') {
    return `{ [key]: ${typeOf(s.additionalProperties)} }`;
  }
  if (Array.isArray(s.type)) return s.type.join(' | ');
  return s.type ?? 'unknown';
}

function wrap(t: string): string {
  return t.includes(' | ') ? `(${t})` : t;
}

function range(s: Schema): string {
  if (s.minimum !== undefined && s.maximum !== undefined) {
    return ` (${s.minimum}..${s.maximum})`;
  }
  if (s.minimum !== undefined) return ` (≥ ${s.minimum})`;
  if (s.maximum !== undefined) return ` (≤ ${s.maximum})`;
  return '';
}

/** Descriptions are TSDoc prose with `{@link X}` tags and hard line wraps. */
function prose(text: string | undefined): string {
  if (!text) return '';
  return (
    text
      // The generator pads the tag (`{@link  TreeSpec }`), so whitespace is loose.
      .replace(
        /\{@link\s+([^}\s]+)\s*([^}]*)\}/g,
        (_, target: string, label: string) =>
          label.trim() ? label.trim() : `\`${target}\``
      )
      .replace(/\s*\n\s*/g, ' ')
      // …and the padding it leaves around the replaced tag.
      .replace(/ {2,}/g, ' ')
      .replace(/ ([.,;:)])/g, '$1')
      .trim()
  );
}

function fieldLine(field: string, prop: Schema, required: Set<string>): string {
  const opt = required.has(field) ? '' : '?';
  const desc = prose(prop.description);
  return `- \`${field}${opt}\`: \`${typeOf(prop)}\`${range(prop)}${desc ? ` — ${desc}` : ''}`;
}

function renderObject(name: string, s: Schema, shared: Set<string>): string {
  const required = new Set(s.required ?? []);
  const lines = [`## ${name}`, ''];
  const doc = prose(s.description);
  if (doc) lines.push(doc, '');
  for (const [field, prop] of Object.entries(s.properties ?? {})) {
    if (!shared.has(field)) lines.push(fieldLine(field, prop, required));
  }
  if (shared.size) lines.push('- …plus the common action fields.');
  return lines.join('\n');
}

/**
 * The fields every member of a union declares IDENTICALLY (an action's `id`,
 * `duration`, `wait_for`…). Listed once instead of in each of the sixteen
 * action sections, they would otherwise be half of the whole reference.
 */
function sharedFields(members: Schema[]): Map<string, Schema> {
  const shared = new Map<string, Schema>();
  const [first, ...rest] = members;
  for (const [field, prop] of Object.entries(first?.properties ?? {})) {
    const same = JSON.stringify(prop);
    const required = first.required?.includes(field) ?? false;
    if (
      rest.every(
        (m) =>
          m.properties?.[field] !== undefined &&
          JSON.stringify(m.properties[field]) === same &&
          (m.required?.includes(field) ?? false) === required
      )
    ) {
      shared.set(field, prop);
    }
  }
  return shared;
}

function renderAlias(name: string, s: Schema): string {
  const doc = prose(s.description);
  return [`## ${name}`, '', ...(doc ? [doc, ''] : []), `\`${typeOf(s)}\``].join(
    '\n'
  );
}

export function schemaToReference(input: object): string {
  // The generated schema is plain JSON; `Schema` names the subset read here.
  const schema = input as Schema;
  const defs = schema.definitions ?? {};
  // The root first, then every definition in schema order: the root is the
  // entry point a reader looks for, the rest is looked up by name.
  const root = schema.$ref ? refName(schema.$ref) : undefined;
  const names = Object.keys(defs).sort((a, b) =>
    a === root ? -1 : b === root ? 1 : 0
  );
  // `Action` is a union of $refs: its members share their timing fields.
  const actionRefs = (defs.Action?.anyOf ?? [])
    .map(
      (m) => m.$ref && decodeURIComponent(m.$ref.replace('#/definitions/', ''))
    )
    .filter((n): n is string => !!n && !!defs[n]);
  const actionMembers = new Set(actionRefs);
  const common = sharedFields(actionRefs.map((n) => defs[n]));
  const commonNames = new Set(common.keys());
  const none = new Set<string>();

  const sections = names.flatMap((raw) => {
    const s = defs[raw];
    const name = refName(`#/definitions/${raw}`);
    if (s.properties) {
      return [
        renderObject(name, s, actionMembers.has(raw) ? commonNames : none),
      ];
    }
    const alias = renderAlias(name, s);
    if (raw !== 'Action' || common.size === 0) return [alias];
    const required = new Set(defs[actionRefs[0]].required ?? []);
    return [
      alias,
      [
        '## Common action fields',
        '',
        'Every action accepts these, in addition to its own fields.',
        '',
        ...Array.from(common.entries()).map(([f, p]) =>
          fieldLine(f, p, required)
        ),
      ].join('\n'),
    ];
  });
  return [
    '# DataFlowSpec — field reference',
    '',
    'Generated from the JSON Schema. `field?` is optional; `A | B` is a union; a',
    'name in backticks refers to the section of the same name. `Action` is a',
    'discriminated union on `type`.',
    '',
    ...sections.flatMap((s) => [s, '']),
  ].join('\n');
}
