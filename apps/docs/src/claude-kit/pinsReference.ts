/**
 * The named terminals of every component symbol, as a table a language model
 * can read and a validator can check `"node:pin"` references against.
 *
 * Generated from the core's own terminal map (`COMPONENT_PINS`), which the
 * build script passes in: pin names are exactly the thing an author cannot
 * guess, and a hand-written list would rot the first time a symbol gained an
 * alias.
 */

/** Structural copy of the core's `PinDef`: a terminal in the unrotated box. */
interface PinDef {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export type PinsMap = Partial<Record<string, Record<string, PinDef>>>;

function side(p: PinDef): string {
  if (Math.abs(p.nx) >= Math.abs(p.ny)) {
    const face = p.nx < 0 ? 'left' : 'right';
    return p.y < 0.45 ? `${face}, upper` : p.y > 0.55 ? `${face}, lower` : face;
  }
  return p.ny < 0 ? 'top' : 'bottom';
}

/** Aliases share one physical terminal: group them so a reader sees ONE pin. */
function groupTerminals(pins: Record<string, PinDef>): string[] {
  const groups = new Map<string, string[]>();
  for (const [name, def] of Object.entries(pins)) {
    const key = `${def.x},${def.y},${def.nx},${def.ny}`;
    const names = groups.get(key) ?? [];
    names.push(name);
    groups.set(key, names);
  }
  return Array.from(groups.entries()).map(([key, names]) => {
    const [x, y, nx, ny] = key.split(',').map(Number);
    return `${names.map((n) => `\`${n}\``).join(' / ')} (${side({ x, y, nx, ny })})`;
  });
}

export function pinsToReference(pins: PinsMap): string {
  const lines = [
    '# Component terminals',
    '',
    'In `direction: "circuit"`, a `connection` (or `arrow` / `move` / `flow` step)',
    'targets a terminal with `"node:pin"` — e.g. `"R1:a"`, `"batt:+"`. Names',
    'separated by `/` are aliases of the SAME terminal. Sides are given for the',
    'unrotated symbol; terminals rotate with `rotation`. A type absent from this',
    'table has no named terminals (wire it by its bare id). A `block` declares',
    'its own terminals in `pins`.',
    '',
    '| type | terminals |',
    '| --- | --- |',
  ];
  for (const [type, map] of Object.entries(pins)) {
    if (!map) continue;
    lines.push(`| \`${type}\` | ${groupTerminals(map).join('; ')} |`);
  }
  return lines.join('\n') + '\n';
}

/** Type → accepted terminal names, for the skill's validator. */
export function pinNames(pins: PinsMap): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [type, map] of Object.entries(pins)) {
    if (map) out[type] = Object.keys(map);
  }
  return out;
}
