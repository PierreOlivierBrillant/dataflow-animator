/**
 * The `type: 'html'` panel's security boundary — and its export boundary.
 *
 * A spec is DATA. It arrives from a `.json` file, a CMS, a database row, a
 * textarea; the player has no way to know which. So the markup an author writes
 * is never handed to `innerHTML`: it is parsed INERT (`DOMParser` runs no
 * script and fetches no resource), then a fresh tree is BUILT from an allow-list
 * — element by element, attribute by attribute, declaration by declaration.
 * Anything not on a list simply never reaches the document. A deny-list would
 * have to be right about every escape ever invented; an allow-list only has to
 * be right about what it lets through.
 *
 * The second boundary is less obvious and just as load-bearing: **a rasterised
 * frame is a `data:` SVG that can load nothing and inherits nothing**.
 * `export/video/rasterizer` serialises the player into a `<foreignObject>`, and
 * `export/video/css` keeps only the rules whose selector contains `rdfa`. Two
 * consequences shape the lists below:
 *
 *  - `class` is NOT an allowed attribute. A class the host page styles renders
 *    on screen and renders UNSTYLED in the exported video — the same spec,
 *    silently two different pictures. Inline `style` travels with the element,
 *    so it is what authors get instead.
 *  - `url(…)` is rejected in every declaration, and `src` is narrowed to
 *    `data:image/…` plus ordinary web URLs. A remote reference does not merely
 *    fail to load in a frame: a cross-origin fetch TAINTS the canvas, and the
 *    whole export dies with it. `data:` is the only form guaranteed to survive.
 *
 * Everything dropped is dropped SILENTLY. A panel that renders 90% of what was
 * written is far better than one that throws, and the console is not where an
 * author of a JSON spec is looking.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Elements removed WITH their children. Everything else that is not on an
 * allow-list is unwrapped instead (its text survives) — but unwrapping these
 * would paint a stylesheet or a script's source onto the stage as text.
 */
const DROPPED = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'base',
  'title',
  'canvas',
  'video',
  'audio',
  'source',
  'track',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'label',
  'math',
]);

/** Structural and inline HTML an explanatory panel is made of. */
const HTML_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'abbr',
  'cite',
  'q',
  'kbd',
  'samp',
  'var',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  'img',
  'figure',
  'figcaption',
]);

/**
 * The SVG subset: shapes, paths, text and grouping.
 *
 * Deliberately absent, and each for its own reason — `<script>` and `<foreign
 * Object>` re-open the door this module exists to close; `<use>`, gradients,
 * `<marker>` and `<filter>` all address a `<defs>` entry BY ID, and `id` is not
 * an allowed attribute (two panels in one page would collide on it); SMIL
 * (`<animate>`, `<set>`) runs on the wall clock, which is precisely the
 * determinism `frames` exists to avoid.
 */
const SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
]);

/** Allowed on any element, HTML or SVG. */
const GLOBAL_ATTRS = new Set(['style', 'title', 'lang', 'dir']);

/** Allowed on one HTML element only. `class` and `id` are on no list at all. */
const HTML_ATTRS: Record<string, string[]> = {
  img: ['src', 'alt', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'reversed'],
  col: ['span'],
  colgroup: ['span'],
  q: ['cite'],
  blockquote: ['cite'],
};

/**
 * Presentation attributes of the SVG subset. Compared lower-cased and written
 * back with the ORIGINAL spelling, because the HTML parser restores the
 * camel case of `viewBox` and `preserveAspectRatio` and SVG is case-sensitive.
 */
const SVG_ATTRS = new Set([
  'viewbox',
  'preserveaspectratio',
  'width',
  'height',
  'x',
  'y',
  'dx',
  'dy',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'paint-order',
  'shape-rendering',
  'vector-effect',
]);

/**
 * CSS properties an inline `style` may carry.
 *
 * `position` is the notable omission: `fixed` or `absolute` would let a panel's
 * content escape its node and float over the whole stage. Custom properties
 * (`--rdfa-…`) are absent for the same reason — redefining one reaches out of
 * the panel and repaints the player.
 */
const STYLE_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'opacity',
  'font',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'text-indent',
  'text-shadow',
  'vertical-align',
  'white-space',
  'word-break',
  'overflow-wrap',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'border-style',
  'border-width',
  'border-radius',
  'border-collapse',
  'border-spacing',
  'box-shadow',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'display',
  'flex',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'align-items',
  'align-self',
  'justify-content',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'list-style',
  'list-style-type',
  'list-style-position',
  'table-layout',
  'object-fit',
  'aspect-ratio',
  'overflow',
  'transform',
  'transform-origin',
]);

/**
 * Rejects a URL whose scheme is neither a plain web fetch nor an inline image.
 *
 * The shape of the check matters more than the list. A relative value is kept —
 * it cannot name `javascript:` and it resolves against the host document, which
 * is what an author writing `/img/logo.png` means — but ANY unrecognised colon
 * in scheme position is refused, rather than only the schemes someone thought
 * to enumerate. That is what closes `java\u0000script:` and every other
 * spelling a URL parser forgives and a deny-list does not.
 */
function safeUrl(value: string): string | undefined {
  // Stripped BEFORE the scheme is read: a URL parser ignores control characters
  // and surrounding whitespace inside a scheme, so a regex that does not would
  // be reading a different string from the one the browser will fetch.
  // eslint-disable-next-line no-control-regex -- reading them out is the point.
  const url = value.replace(/[\u0000-\u0020\u007f]/g, '');
  if (/^https?:/i.test(url)) return value.trim();
  if (/^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(url))
    return value.trim();
  // A colon reached before any path, query or fragment separator is a scheme,
  // whatever it is spelled with.
  const separator = url.search(/[/?#]/);
  const colon = url.indexOf(':');
  if (colon !== -1 && (separator === -1 || colon < separator)) return undefined;
  return value.trim();
}

/**
 * Filters one inline `style` attribute down to the allowed declarations.
 *
 * Splitting on `;` is only safe because `url(` is refused outright — a
 * `data:` URI carries its own semicolon and would tear a declaration in half.
 * That refusal is not a parsing convenience, though: see the header.
 */
function safeStyle(value: string): string | undefined {
  const kept: string[] = [];
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    if (!STYLE_PROPS.has(prop)) continue;
    // `!important` is stripped rather than the declaration refused: the author
    // meant the value, and only the PRIORITY would have let it override the
    // panel's own ceilings.
    const raw = declaration.slice(colon + 1).replace(/!\s*important/gi, '');
    const val = raw.trim();
    if (val === '') continue;
    if (/url\s*\(|expression\s*\(|@import/i.test(val)) continue;
    kept.push(`${prop}:${val}`);
  }
  return kept.length > 0 ? kept.join(';') : undefined;
}

/** Copies the attributes `source` is allowed to keep onto `target`. */
function copyAttributes(source: Element, target: Element, svg: boolean): void {
  const perTag = svg ? undefined : HTML_ATTRS[target.localName];
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase();
    // `on*` never reaches a list, but naming it here says why out loud.
    if (name.startsWith('on') || name.startsWith('xmlns')) continue;
    const allowed = svg
      ? SVG_ATTRS.has(name) || GLOBAL_ATTRS.has(name)
      : GLOBAL_ATTRS.has(name) || (perTag?.includes(name) ?? false);
    if (!allowed) continue;

    let value: string | undefined = attr.value;
    if (name === 'style') value = safeStyle(value);
    else if (name === 'src' || name === 'cite') value = safeUrl(value);
    if (value === undefined) continue;
    // The ORIGINAL name, so `viewBox` survives; SVG elements do not lower-case
    // what `setAttribute` writes, unlike HTML ones.
    target.setAttribute(attr.name, value);
  }
}

/**
 * Rebuilds `nodes` into `out`, keeping only what the lists allow.
 *
 * `svg` is sticky: once inside an `<svg>`, every descendant is created in the
 * SVG namespace. It never turns back off, because the one element that would
 * re-enter HTML — `<foreignObject>` — is not in the subset.
 */
function convert(
  nodes: NodeListOf<ChildNode>,
  out: Node[],
  svg: boolean
): void {
  for (const node of Array.from(nodes)) {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      out.push(document.createTextNode(node.nodeValue ?? ''));
      continue;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;

    const source = node as Element;
    const tag = source.localName.toLowerCase();
    if (DROPPED.has(tag) && !(svg && tag === 'title')) continue;

    const intoSvg = svg || tag === 'svg';
    const known = intoSvg ? SVG_TAGS.has(tag) : HTML_TAGS.has(tag);
    if (!known) {
      // Unwrap: an unrecognised HTML wrapper (`<section>`, a custom element)
      // still has readable children. In SVG there is nothing readable to save,
      // so an unknown element takes its subtree with it.
      if (!intoSvg) convert(source.childNodes, out, false);
      continue;
    }

    const target = intoSvg
      ? document.createElementNS(SVG_NS, source.localName)
      : document.createElement(tag);
    copyAttributes(source, target, intoSvg);
    const children: Node[] = [];
    convert(source.childNodes, children, intoSvg);
    for (const child of children) target.appendChild(child);
    out.push(target);
  }
}

/**
 * Appends the safe rendering of `markup` to `parent`.
 *
 * Mirrors `dom/richtext`'s `appendRichText`: a spec's prose reaches the screen
 * through an append, never through an assignment to `innerHTML`.
 */
export function appendSanitizedHtml(parent: Node, markup: string): void {
  if (markup === '') return;
  // `DOMParser` builds a document that is NOT connected to the page: no script
  // runs, no `<img>` fetches, no `onerror` fires. `innerHTML` on a detached
  // element is very nearly as inert, but "very nearly" is not the standard this
  // module is held to.
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const out: Node[] = [];
  convert(parsed.body.childNodes, out, false);
  for (const child of out) parent.appendChild(child);
}
