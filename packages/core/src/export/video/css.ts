/**
 * Collects the player's own CSS, so a rasterised frame is styled.
 *
 * A `<foreignObject>` renders in the image's OWN document: it inherits nothing
 * from the page. Whatever styles the frame needs have to travel inside the SVG,
 * which is why the stylesheet is gathered here and inlined per frame.
 *
 * Two decisions make this a filter rather than a dump of `document.styleSheets`:
 *
 *  - **`@font-face` is dropped.** A face pointing at another origin makes the
 *    SVG fetch it, and a cross-origin fetch TAINTS the canvas the frame is
 *    drawn on — after which `VideoFrame` refuses the source and the whole
 *    export dies. The player's own stack is system fonts (`--rdfa-font` is
 *    `ui-sans-serif, system-ui…`), so nothing is lost by dropping them.
 *  - **Only `rdfa`-bearing rules are kept.** The host page's CSS cannot reach
 *    inside the player anyway (everything is scoped under `.rdfa-player`), and
 *    a full dump would put tens of kilobytes of unrelated rules into every
 *    frame's data URI. A host that DOES restyle the player writes `.rdfa-…` in
 *    its selector, so its override is kept.
 */

/** Substring that marks a rule as belonging to the player. */
const SCOPE = 'rdfa';

function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return 'selectorText' in rule;
}

function isKeyframesRule(rule: CSSRule): rule is CSSKeyframesRule {
  // `CSSKeyframesRule` is not constructible to `instanceof` against in every
  // engine the tests run in (jsdom exposes a partial CSSOM), so the shape is
  // probed instead of the class.
  return 'name' in rule && 'cssRules' in rule && !('selectorText' in rule);
}

function isGroupingRule(rule: CSSRule): rule is CSSGroupingRule {
  return 'cssRules' in rule && !('name' in rule);
}

/** Appends every kept rule of `rules` to `out`. */
function collectRules(rules: CSSRuleList, out: string[]): void {
  for (const rule of Array.from(rules)) {
    if (isStyleRule(rule)) {
      if (rule.selectorText.includes(SCOPE)) out.push(rule.cssText);
      continue;
    }
    if (isKeyframesRule(rule)) {
      // Keyframes carry no selector, so they are matched on their NAME —
      // `rdfa-march`, `rdfa-pulse`, `rdfa-spin-corner`. Without them the
      // animation-bearing rules kept above would reference nothing.
      if (rule.name.includes(SCOPE)) out.push(rule.cssText);
      continue;
    }
    if (isGroupingRule(rule)) {
      // `@media` / `@supports` / `@layer`: keep the wrapper only if something
      // inside it survived the filter, so an empty `@media` never ships.
      const inner: string[] = [];
      collectRules(rule.cssRules, inner);
      if (inner.length > 0) {
        const condition = rule.cssText.slice(0, rule.cssText.indexOf('{'));
        out.push(`${condition}{${inner.join('')}}`);
      }
    }
    // Anything else (`@font-face`, `@import`, `@charset`) is deliberately
    // dropped — see the module header.
  }
}

/**
 * The player stylesheet, as one string ready to inline in a frame.
 *
 * Callers collect ONCE per export, never per frame: the result cannot change
 * while an export runs, and this walks every rule of every sheet in the
 * document.
 */
export function collectPlayerCss(doc: Document = document): string {
  const out: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      // Reading `cssRules` of a cross-origin sheet throws a SecurityError. Such
      // a sheet cannot be styling the player anyway (its rules are unreadable,
      // so they could not be inlined even if they did).
      const own = sheet.cssRules;
      if (!own) continue;
      rules = own;
    } catch {
      continue;
    }
    collectRules(rules, out);
  }
  return out.join('\n');
}

/**
 * Selectors of the collected CSS that actually declare an animation.
 *
 * Derived from the stylesheet rather than hard-coded, so the class names stay
 * in exactly one place — the stylesheet — and a new animation is picked up
 * without anyone remembering to list it here.
 */
export function animatedSelectors(css: string): string[] {
  const selectors: string[] = [];
  // Rules are emitted one per line by `collectPlayerCss`, or as `@media{...}`
  // groups; matching `selector { … animation… }` covers both.
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (!/(^|[;\s])animation(-name)?\s*:/.test(body)) continue;
    const trimmed = selector.trim();
    // Skip the `@keyframes` wrapper and its `from`/`to`/percentage steps.
    if (trimmed.startsWith('@') || /^(from|to|[\d.]+%)/.test(trimmed)) continue;
    selectors.push(trimmed);
  }
  return [...new Set(selectors)];
}

/**
 * A rule that freezes the given selectors' animations at the phase they hold
 * at `tMs`, or nothing at all when there are none.
 *
 * Three of the player's animations run on the BROWSER's clock rather than on
 * `t` — the corner spinner, the pulse, and the marching ants of an `animated`
 * arrow. A rasterised SVG captures a still, so without this they would all come
 * out stuck at their first frame, identically, on every frame of the export.
 *
 * One declaration covers all of them regardless of their individual durations:
 * a negative `animation-delay` of `t` puts each animation at `t % duration`,
 * and `paused` stops it from advancing while the image rasterises.
 *
 * The SELECTORS matter as much as the declaration. The obvious spelling —
 * `.rdfa-player *` plus both pseudo-elements — forces a style recalculation on
 * every node and measured 2.8 ms MORE per frame, around forty percent on top of
 * the cost of rasterising a frame at all. Naming only the handful of selectors
 * that declare an animation buys that back, and most scenes contain none of
 * them, in which case no rule is emitted at all.
 */
export function animationPhaseCss(tMs: number, selectors: string[]): string {
  if (selectors.length === 0) return '';
  const delay = Math.max(0, Math.round(tMs));
  return `${selectors.join(',')} {
  animation-delay: -${delay}ms !important;
  animation-play-state: paused !important;
}`;
}
