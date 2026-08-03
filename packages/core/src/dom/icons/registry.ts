/**
 * Custom icon registries — the framework-free replacement for the React
 * `registerNodeIcon` / `registerSubIcon`, whose extension point took a
 * `ReactNode` and therefore could not live in core.
 *
 * An icon is either **SVG markup** (the common case, and what the README's
 * examples already looked like) or a **factory** returning a fresh `SVGElement`
 * (for anything that has to vary).
 *
 * SSR-safe: registering never touches the DOM. A consumer may legitimately call
 * `registerNodeIcon` at module scope in a bundle that also runs on the server,
 * so markup is parsed lazily, on the first resolution — which only happens
 * while rendering, and rendering only happens in the browser.
 */

export type IconSource = string | (() => SVGElement);

interface Entry {
  source: IconSource;
  /** Parsed once from markup, then cloned per resolution. */
  proto?: SVGElement;
}

// `Map` rather than a plain object: a sub-icon legitimately named `constructor`
// or `__proto__` would otherwise collide with `Object.prototype` and resolve to
// a function. The React implementation used a `Record` and has that latent bug.
const nodeIcons = new Map<string, Entry>();
const subIcons = new Map<string, Entry>();

/**
 * Parses SVG markup into an element owned by THIS document.
 *
 * `<template>` rather than `DOMParser`: the HTML parser's foreign-content rules
 * namespace the element correctly and in the current document, so there is no
 * `importNode` step. `DOMParser` with `image/svg+xml` returns a node owned by a
 * foreign document and signals failure by injecting a `<parsererror>` element
 * rather than throwing, which would have to be sniffed for.
 */
function parseSvgMarkup(markup: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const el = template.content.firstElementChild;
  if (!(el instanceof SVGElement))
    throw new TypeError(
      `Icon markup must be a single <svg> element, got: ${markup.slice(0, 40)}`
    );
  return el;
}

function resolve(entry: Entry): SVGElement {
  if (typeof entry.source === 'function') {
    // Called on EVERY resolution and never cached: the factory is the
    // consumer's, and caching one result would silently break a factory that
    // means to vary its output.
    const el = entry.source();
    if (!(el instanceof SVGElement))
      throw new TypeError('An icon factory must return an SVGElement.');
    return el;
  }
  entry.proto ??= parseSvgMarkup(entry.source);
  // A fresh node per call: the same icon appears on many nodes, and a DOM node
  // cannot be in two places at once.
  return entry.proto.cloneNode(true) as SVGElement;
}

/**
 * Registers a pictogram for a node `type`, overriding the built-in one.
 *
 * Takes precedence over every built-in, including the stateful `switch` /
 * `push_button` geometry. (The legacy React renderer tested those two first, so
 * registering over them was silently ignored — an accident of ordering, not a
 * contract; "what you register wins" is the rule here.)
 */
export function registerNodeIcon(type: string, icon: IconSource): void {
  nodeIcons.set(type, { source: icon });
}

/** Registers a `subicon` badge glyph. Names are case-insensitive. */
export function registerSubIcon(name: string, icon: IconSource): void {
  subIcons.set(name.toLowerCase(), { source: icon });
}

/** A fresh custom pictogram for `type`, or undefined if none is registered. */
export function customNodeIcon(type: string): SVGElement | undefined {
  const entry = nodeIcons.get(type);
  return entry ? resolve(entry) : undefined;
}

/** A fresh custom badge glyph for `name`, or undefined if none is registered. */
export function customSubIcon(name: string): SVGElement | undefined {
  const entry = subIcons.get(name.toLowerCase());
  return entry ? resolve(entry) : undefined;
}
