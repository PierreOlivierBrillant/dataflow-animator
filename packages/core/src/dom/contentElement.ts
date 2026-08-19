import type { Highlighter, ObjectContent } from '../types';
import { h, pruneEmptyStyle, setStyle } from './el';

/**
 * `set_content` panel markup — the port of `ContentPanel.tsx` and its inner
 * `CodeBlock`.
 *
 * NO RICH TEXT HERE, deliberately. `content.value` is rendered as a plain text
 * node in every mode except `code` (which goes through the highlighter), so
 * `$…$` is NOT interpreted. Calling `appendRichText` would silently change that
 * for every existing spec whose content happens to contain a dollar sign — a
 * price, a shell variable. `packetElement.ts` carries the same rule.
 *
 * WHY THIS IS NOT AN OVERLAY — unlike packets, arrows and comment bubbles, this
 * panel lives INSIDE `.rdfa-node` and makes the node GROW. It is therefore part
 * of what the convergence loop measures, which is why it is built during the
 * initial node pass and only re-tuned (per-node ceilings, code font) on each
 * subsequent pass. See `mount.ts`.
 */

/** Safety margin (px) the React `CodeBlock` keeps when fitting code. */
const FIT_SAFETY = 2;

/** Fallback font size when the computed value is unreadable. `CodeBlock`'s. */
const FALLBACK_BASE_FONT = 12.5;

/**
 * The handle a code panel exposes to the convergence loop. Non-code panels
 * return `undefined`: they have nothing to fit.
 */
export interface CodeFitTarget {
  /** The `<pre>` whose font is scaled. */
  pre: HTMLPreElement;
  /**
   * Base (CSS) font size, discovered by the first measurement. `undefined`
   * until then — matching `CodeBlock`'s `baseFont` state, which starts unset and
   * therefore leaves the first render at the stylesheet's size.
   */
  baseFont?: number;
}

/**
 * Measures the shrink ratio this code block would need ON ITS OWN to fit, and
 * records its base font size — the port of `CodeBlock`'s layout effect.
 *
 * Reads at the BASE font (the inline size is cleared for the duration and
 * restored before returning), so `natural*` and `avail*` are both expressed in
 * the same units no matter what scale is currently applied. That is what makes
 * the fixed point stable rather than oscillating with its own output.
 */
export function measureCodeFit(target: CodeFitTarget): number {
  const el = target.pre;
  // The <pre> has its own padding (which does NOT depend on the font): we
  // subtract it to only reason about the TEXT area.
  const preCs = getComputedStyle(el);
  const padX =
    (parseFloat(preCs.paddingLeft) || 0) +
    (parseFloat(preCs.paddingRight) || 0);
  const padY =
    (parseFloat(preCs.paddingTop) || 0) +
    (parseFloat(preCs.paddingBottom) || 0);
  const applied = el.style.fontSize;
  el.style.removeProperty('font-size');
  const base = parseFloat(getComputedStyle(el).fontSize) || FALLBACK_BASE_FONT;
  const naturalW = el.scrollWidth - padX;
  const naturalH = el.scrollHeight - padY;
  const availW = el.clientWidth - padX;
  // Available height = body height (bounded by max-height), minus <pre> padding.
  const body = el.parentElement;
  const availH = (body ? body.clientHeight : el.clientHeight) - padY;
  // Restored through the CSSOM rather than by assigning back a possibly-empty
  // string: `el.style.fontSize = ''` materialises an empty `style=""` attribute
  // on a block that never had one, which is a DOM difference the mount-vs-update
  // gate would (rightly) report even though nothing renders differently.
  if (applied) el.style.setProperty('font-size', applied);
  else pruneEmptyStyle(el);

  const ratioW =
    availW > 0 && naturalW > availW ? (availW - FIT_SAFETY) / naturalW : 1;
  const ratioH =
    availH > 0 && naturalH > availH ? (availH - FIT_SAFETY) / naturalH : 1;
  target.baseFont = base;
  return Math.min(ratioW, ratioH, 1);
}

/**
 * Writes the COMMON font scale onto a code block, so every code panel in the
 * stage renders at exactly the same size.
 *
 * A scale of 1 (or a block not yet measured) REMOVES the inline size rather
 * than writing `1×base`: `CodeBlock` passes `undefined` there, and React drops
 * the declaration entirely. Leaving a rounded `12.5px` behind instead would
 * pin the size against a stylesheet that scales with the player.
 */
export function applyCodeFontScale(target: CodeFitTarget, scale: number): void {
  const { pre, baseFont } = target;
  if (baseFont == null || scale >= 1) {
    pre.style.removeProperty('font-size');
    pruneEmptyStyle(pre);
    return;
  }
  setStyle(pre, { 'font-size': `${Math.max(1, baseFont * scale)}px` });
}

export interface ContentPanelResult {
  el: HTMLElement;
  /** Present only for `code` panels — the target of the font-fit loop. */
  codeFit?: CodeFitTarget;
}

/** Port of `ContentPanel`. */
export function buildContentPanel(
  content: ObjectContent,
  highlight: Highlighter
): ContentPanelResult {
  const type = content.type ?? 'text';

  if (type === 'code') {
    const code = h('code');
    // The React side uses `dangerouslySetInnerHTML` here — the highlighter
    // returns markup by contract, so this is the literal equivalent.
    code.innerHTML = highlight(
      content.value ?? '',
      content.language ?? 'plaintext'
    );
    const pre = h('pre', undefined, [code]);
    return {
      el: h('div', { class: 'rdfa-content rdfa-terminal' }, [
        h('div', { class: 'rdfa-content-body rdfa-code' }, [pre]),
      ]),
      codeFit: { pre },
    };
  }

  const url = content.url ?? 'https://localhost';

  if (type === 'image') {
    const img = h('img', { src: content.value, alt: '' });
    return {
      el: h('div', { class: 'rdfa-content' }, [
        h('div', { class: 'rdfa-window-bar' }, [
          h('span', { class: 'rdfa-window-url' }, [url]),
        ]),
        h('div', { class: 'rdfa-content-body' }, [img]),
      ]),
    };
  }

  if (type === 'table') {
    const table = h('table', { class: 'rdfa-content-table' });
    if (content.columns) {
      const row = h(
        'tr',
        undefined,
        content.columns.map((col) => h('th', undefined, [col]))
      );
      table.appendChild(h('thead', undefined, [row]));
    }
    if (content.rows_data) {
      const body = h(
        'tbody',
        undefined,
        content.rows_data.map((cells) =>
          h(
            'tr',
            undefined,
            // A cell may be a number in the spec; React stringifies it the same way.
            cells.map((cell) => h('td', undefined, [String(cell)]))
          )
        )
      );
      table.appendChild(body);
    }
    return {
      el: h('div', { class: 'rdfa-content rdfa-content--table' }, [
        h('div', { class: 'rdfa-content-body rdfa-content-table-wrapper' }, [
          table,
        ]),
      ]),
    };
  }

  // text / UI: dummy browser window.
  return {
    el: h('div', { class: 'rdfa-content' }, [
      h('div', { class: 'rdfa-window-bar' }, [
        h('span', { class: 'rdfa-window-url' }, [url]),
      ]),
      h(
        'div',
        { class: 'rdfa-content-body' },
        content.value ? [content.value] : []
      ),
    ]),
  };
}
