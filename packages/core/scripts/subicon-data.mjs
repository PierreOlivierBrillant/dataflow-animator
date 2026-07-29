import { readFileSync } from 'fs';
import * as prettier from 'prettier';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Extracts the glyph geometry of the `subicon` tech badges out of react-icons.
 *
 * Why this exists: `packages/core` may not import react, and react-icons offers
 * no data-only export — every icon's geometry is inlined as a JSON literal
 * inside a generated React component body:
 *
 *   export function SiReact (props) {
 *     return GenIcon({"tag":"svg","attr":{…},"child":[…]})(props);
 *   };
 *
 * So the literal is lifted out at build time and committed as plain data. The
 * committed copy is guarded by `check:subicons`, which matters more than it
 * looks: a react-icons bump that changed a path would otherwise silently
 * desynchronise the vanilla renderer from the React one, and the A/B pixel gate
 * would report a mystery diff with no code change to blame.
 *
 * Shared by `generate-subicon-data.mjs` and `check-subicon-data-is-fresh.mjs`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');

/** The react-icons packs the catalogue draws from. */
const SETS = ['si', 'fa', 'di', 'vsc', 'md', 'tb'];

/**
 * react-icons stores React PROP names in its data (`strokeWidth`), which React
 * translates on the way to the DOM. The vanilla renderer calls `setAttribute`
 * directly, so the translation happens here — once, visibly, in the generated
 * output — rather than through a runtime guesser.
 *
 * Deliberately a closed list, not a camelCase→kebab rule: `viewBox` and
 * `version` must NOT be rewritten, and an unknown key is a hard error below
 * rather than a silent mangle.
 */
const ATTR_RENAMES = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  clipRule: 'clip-rule',
  fillRule: 'fill-rule',
};

/** Attribute names that reach the DOM unchanged. */
const ATTR_PASSTHROUGH = new Set([
  'viewBox',
  'version',
  'role',
  'fill',
  'stroke',
  'd',
  'opacity',
]);

function readSets() {
  const sources = {};
  for (const set of SETS) {
    // `import.meta.resolve` rather than `require.resolve`: react-icons' exports
    // map does not expose the file path (`./si/index.mjs` is not an entry), and
    // resolving under CJS conditions would hand back the `.js` build, whose
    // format this parser does not target.
    sources[set] = readFileSync(
      fileURLToPath(import.meta.resolve(`react-icons/${set}`)),
      'utf8'
    );
  }
  return sources;
}

/**
 * Lifts the `GenIcon({…})` argument out of one export's body.
 *
 * Brace counting rather than a regex: the argument is a JSON object whose path
 * strings can contain anything, so the scanner has to know when it is inside a
 * string literal.
 */
function extractTree(source, name) {
  const marker = `export function ${name} (props) {`;
  const at = source.indexOf(marker);
  if (at < 0) return null;

  const open = source.indexOf('GenIcon(', at);
  if (open < 0) return null;

  let i = open + 'GenIcon('.length;
  const start = i;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; i < source.length; i++) {
    const c = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return JSON.parse(source.slice(start, i));
}

function renameAttrs(attr, context) {
  const out = {};
  for (const [key, value] of Object.entries(attr)) {
    if (ATTR_PASSTHROUGH.has(key)) out[key] = value;
    else if (ATTR_RENAMES[key]) out[ATTR_RENAMES[key]] = value;
    else
      throw new Error(
        `${context}: unhandled react-icons attribute "${key}". Add it to ` +
          'ATTR_RENAMES or ATTR_PASSTHROUGH in scripts/subicon-data.mjs — ' +
          'guessing the DOM name would risk a silent rendering difference.'
      );
  }
  return out;
}

/** Builds `{ [exportName]: { attr, children } }` for every catalogued icon. */
export function buildSubIconData(iconNames) {
  const sources = readSets();
  const data = {};

  for (const name of [...new Set(iconNames)].sort()) {
    const hits = SETS.filter((set) => extractTree(sources[set], name));
    if (hits.length === 0)
      throw new Error(
        `subicon "${name}" was not found in any of the react-icons packs ` +
          `(${SETS.join(', ')}). Fix the catalogue or add the pack.`
      );
    if (hits.length > 1)
      throw new Error(
        `subicon "${name}" is ambiguous — found in ${hits.join(' and ')}.`
      );

    const tree = extractTree(sources[hits[0]], name);
    if (tree.tag !== 'svg')
      throw new Error(`${name}: expected a root <svg>, got <${tree.tag}>.`);

    const children = (tree.child ?? []).map((child) => {
      if (child.child?.length)
        throw new Error(
          `${name}: nested children are not supported by the flat renderer.`
        );
      return {
        tag: child.tag,
        attr: renameAttrs(child.attr ?? {}, `${name} <${child.tag}>`),
      };
    });

    data[name] = { attr: renameAttrs(tree.attr ?? {}, `${name} <svg>`), children };
  }

  return data;
}

/**
 * Renders the data module, formatted with Prettier.
 *
 * Running the formatter here rather than leaving raw `JSON.stringify` output is
 * what keeps `format:check` and `check:subicons` from contradicting each other:
 * otherwise `format:write` would rewrite the committed file into a shape the
 * generator never produces, and the freshness check would fail forever.
 */
export async function renderSubIconDataModule(data) {
  return prettier.format(renderRaw(data), {
    parser: 'typescript',
    ...(await prettier.resolveConfig(
      join(packageRoot, 'src/dom/icons/subIconData.generated.ts')
    )),
  });
}

function renderRaw(data) {
  const header = `// GENERATED FILE — do not edit by hand.
//
// Produced by \`npm run generate:subicons\` from \`subIconCatalog.ts\` and the
// installed react-icons packs; verified fresh in CI by \`npm run check:subicons\`.
// See scripts/subicon-data.mjs for why the geometry has to be lifted out of
// react-icons rather than imported from it.
//
// LICENSE / ATTRIBUTION — this glyph geometry is extracted from the icon packs
// redistributed by react-icons (https://github.com/react-icons/react-icons,
// MIT wrapper) and remains under each pack's upstream license:
//   di  — Devicons (MIT)            si  — Simple Icons (CC0-1.0)
//   fa  — Font Awesome Free (icons: CC-BY-4.0)
//   vsc — VS Code Codicons (CC-BY-4.0)
//   md  — Material Design icons (Apache-2.0)
//   tb  — Tabler Icons (MIT)
// As of 3.0.0 this data ships inlined in the published bundle, so the
// attribution above ships with it — see the published package's LICENSE.

/** One SVG child element of an icon (react-icons trees are flat). */
interface SubIconChild {
  tag: string;
  attr: Record<string, string>;
}

export interface SubIconGlyph {
  /** Root <svg> attributes, already carrying DOM names (\`stroke-width\`, …). */
  attr: Record<string, string>;
  children: SubIconChild[];
}

export const SUB_ICON_GLYPHS: Record<string, SubIconGlyph> = `;
  return `${header}${JSON.stringify(data, null, 2)};\n`;
}

/**
 * Reads the react-icons export names out of `subIconCatalog.ts`.
 *
 * A regex rather than an import because this is a `.mjs` script and the
 * catalogue is TypeScript. The shape it matches is the one the file is written
 * in; a catalogue entry that stopped matching would drop its icon silently, so
 * the caller cross-checks the count.
 */
export function catalogIconNames(catalogSource) {
  const names = [...catalogSource.matchAll(/icon:\s*'(\w+)'/g)].map(
    (m) => m[1]
  );
  // Keys may be quoted — in EITHER quote style, since Prettier normalises them —
  // and may contain spaces (`'apple pay'`), so `\S+` alone is not enough. Both
  // omissions were caught by this very cross-check.
  const entries = (
    catalogSource.match(/^\s+(?:'[^']*'|"[^"]*"|\S+):\s*\{\s*icon:/gm) ?? []
  ).length;
  if (names.length !== entries)
    throw new Error(
      `subIconCatalog.ts: matched ${names.length} icon names for ${entries} ` +
        'entries. The catalogue formatting drifted from what this script parses.'
    );
  if (names.length === 0)
    throw new Error('subIconCatalog.ts: no entries found.');
  return names;
}

export { packageRoot };
