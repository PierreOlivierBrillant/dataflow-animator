import { s } from '../el';
import { SUB_ICON_CATALOG } from './subIconCatalog';
import { SUB_ICON_GLYPHS } from './subIconData.generated';
import { customSubIcon, registerSubIcon } from './registry';

/**
 * Framework-free `subicon` tech badges — the port of
 * `packages/react/src/components/nodes/subIcons.tsx`.
 *
 * The React version renders `<def.Icon color={…} title={name} />` from
 * react-icons. Core cannot: react-icons' `IconBase` imports React, and the
 * geometry is not exported as data. So the glyphs are lifted into
 * `subIconData.generated.ts` at build time, and this module reproduces what
 * `IconBase` would have emitted.
 */

/**
 * Rebuilds react-icons' `IconBase` output.
 *
 * The attribute order below mirrors `IconBase`'s spread order, which is what
 * decides precedence: the three defaults come first so an icon's own `attr` can
 * override them (several packs ship `fill="none"` or their own `stroke-width`).
 *
 * One easily-missed detail: `IconBase` excludes only `attr`, `size` and `title`
 * from the props it spreads onto the `<svg>`, so `color` lands as an ATTRIBUTE
 * in addition to being set in `style`. Both are reproduced — the style is what
 * actually paints, but dropping the attribute would leave a difference that is
 * invisible until someone diffs the markup.
 */
function renderGlyph(iconName: string, color: string, title: string) {
  const glyph = SUB_ICON_GLYPHS[iconName];
  const svg = s('svg', {
    stroke: 'currentColor',
    fill: 'currentColor',
    'stroke-width': '0',
    ...glyph.attr,
    color,
    height: '1em',
    width: '1em',
    xmlns: 'http://www.w3.org/2000/svg',
  });
  svg.style.setProperty('color', color);
  // `<title>` comes BEFORE the paths, as React renders it.
  svg.appendChild(s('title', undefined, [title]));
  for (const child of glyph.children) {
    svg.appendChild(s(child.tag as 'path', child.attr));
  }
  return svg;
}

/**
 * Free-text badge, for `subicon`s that are not known icons (a value like `5.7`,
 * an abbreviation like `API`). The digit fills the badge: the disc spans the
 * whole badge (class `rdfa-subicon-text`, see CSS) and the font is sized so the
 * text nearly touches its edge — no wasted inner ring.
 *
 * The `rdfa-subicon-text` class is load-bearing, not decorative:
 * `.rdfa-node-badge:has(.rdfa-subicon-text)` in `dataflow.css` keys the badge's
 * slate backdrop off it.
 */
function renderText(text: string) {
  const label = text.length > 4 ? text.slice(0, 4) : text;
  const fontSize =
    label.length >= 4
      ? 11
      : label.length === 3
        ? 14
        : label.length === 2
          ? 17
          : 21;
  return s(
    'svg',
    {
      viewBox: '0 0 24 24',
      class: 'rdfa-subicon-text',
      role: 'presentation',
      'aria-hidden': 'true',
    },
    [
      s('circle', { cx: '12', cy: '12', r: '12', fill: '#475569' }),
      s(
        'text',
        {
          x: '12',
          y: '12',
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-family': 'var(--rdfa-font)',
          'font-weight': '700',
          'font-size': String(fontSize),
          fill: '#ffffff',
        },
        [label]
      ),
    ]
  );
}

/**
 * Resolves a `subicon`: custom registration, then known tech glyph, otherwise a
 * free-text badge (e.g. 'v2', 'API', 'JWT') — the same order React resolved in.
 */
export function renderSubIcon(name: string): SVGElement {
  const custom = customSubIcon(name);
  if (custom) return custom;
  const def = SUB_ICON_CATALOG[name.toLowerCase()];
  if (def) return renderGlyph(def.icon, def.color, name);
  return renderText(name);
}

/** Every badge name the catalogue resolves to a tech glyph. */
export function subIconNames(): string[] {
  return Object.keys(SUB_ICON_CATALOG);
}

// See the note in `nodeIcons.ts`: one public module per icon kind.
export { registerSubIcon };
