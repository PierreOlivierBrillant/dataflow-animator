import { contentFrameSrc } from '../engine/contentFrames';
import {
  screenBox,
  screenScale,
  type ScreenBox,
} from '../engine/contentScreen';
import type { ContentLimit } from '../engine/placements';
import { appendSanitizedHtml } from '../html/sanitize';
import type { Highlighter, ObjectContent } from '../types';
import { h, pruneEmptyStyle, setStyle } from './el';

/**
 * `set_content` panel markup — the port of `ContentPanel.tsx` and its inner
 * `CodeBlock`.
 *
 * NO RICH TEXT HERE, deliberately. `content.value` is rendered as a plain text
 * node in every mode except `code` (which goes through the highlighter) and
 * `html` (which goes through the sanitiser), so `$…$` is NOT interpreted.
 * Calling `appendRichText` would silently change that for every existing spec
 * whose content happens to contain a dollar sign — a price, a shell variable.
 * `packetElement.ts` carries the same rule.
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

/**
 * The handle an `image` panel carrying `frames` exposes, so `applyNodeElement`
 * can point it at the frame belonging to the current `t`.
 *
 * A retained `<img>` whose `src` moves is the whole mechanism: swapping the
 * attribute keeps ONE image in the DOM, which is what makes the exported
 * `<foreignObject>` (which inlines everything it can see) stay small.
 */
export interface FrameTarget {
  img: HTMLImageElement;
  /** The content the sources come from — read at apply time, never copied. */
  content: ObjectContent;
  /** Index currently written, so a steady frame costs no attribute write. */
  index?: number;
}

/**
 * The handle an `html` panel with a design space exposes, so the node's
 * allowance can be turned into a scale on every convergence pass.
 *
 * Two elements rather than one, because a `transform` does not change a layout
 * box: `inner` is drawn at the DESIGN size and scaled, `frame` is given the
 * SCALED size in real pixels. Without the frame the node would reserve room for
 * a 480px screen while painting a 300px one, and every neighbour would be
 * pushed away by space nothing occupies.
 */
export interface ScreenTarget {
  frame: HTMLElement;
  inner: HTMLElement;
  box: ScreenBox;
  /** Scale currently written, so a steady screen costs no style writes. */
  scale?: number;
}

export interface ContentPanelResult {
  el: HTMLElement;
  /** Present only for `code` panels — the target of the font-fit loop. */
  codeFit?: CodeFitTarget;
  /** Present only for an `image` panel with a `frames` sequence. */
  frames?: FrameTarget;
  /** Present only for an `html` panel declaring a `screen_width`. */
  screen?: ScreenTarget;
}

/** The fake browser chrome shared by the `text`, `image` and `html` modes. */
function windowBar(url: string): HTMLElement {
  return h('div', { class: 'rdfa-window-bar' }, [
    h('span', { class: 'rdfa-window-url' }, [url]),
  ]);
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
    // Built at the STILL (`value`), never at frame 0: `applyNodeElement` writes
    // the frame belonging to `t` immediately afterwards, on the create path as
    // much as on the update path, and the two must not disagree about which
    // src a freshly mounted node carries.
    const img = h('img', { src: contentFrameSrc(content, undefined), alt: '' });
    return {
      el: h('div', { class: 'rdfa-content' }, [
        windowBar(url),
        h('div', { class: 'rdfa-content-body' }, [img]),
      ]),
      frames: content.frames?.length ? { img, content } : undefined,
    };
  }

  if (type === 'html') {
    const page = h('div', { class: 'rdfa-content-html' });
    appendSanitizedHtml(page, content.value ?? '');
    // The address bar is OPT-IN here, unlike `text`: rich markup is as often a
    // legend or a card as it is a web page, and a browser frame around a legend
    // states something the author did not.
    const bar = content.url ? windowBar(content.url) : undefined;

    const box = screenBox(content);
    if (!box) {
      page.classList.add('rdfa-content-body');
      return {
        el: h('div', { class: 'rdfa-content' }, bar ? [bar, page] : [page]),
      };
    }

    // The chrome is INSIDE the screen, so it scales with the page instead of
    // sitting beside it at the player's own size: a simulated browser is one
    // picture, and its address bar is part of what is on the screen.
    const inner = h(
      'div',
      { class: 'rdfa-screen' },
      bar ? [bar, page] : [page]
    );
    // The design size is written once: it is what the markup is laid out
    // against and it never moves. Only the SCALE follows the player.
    setStyle(inner, {
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    const frame = h('div', { class: 'rdfa-content-body rdfa-screen-frame' }, [
      inner,
    ]);
    return {
      el: h('div', { class: 'rdfa-content rdfa-content--screen' }, [frame]),
      screen: { frame, inner, box },
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
      windowBar(url),
      h(
        'div',
        { class: 'rdfa-content-body' },
        content.value ? [content.value] : []
      ),
    ]),
  };
}

/**
 * Points an `image` panel's `<img>` at the frame belonging to the current `t`.
 *
 * `index` is memoised on the target rather than compared against the attribute:
 * a frame source is routinely a fifty-kilobyte `data:` URI, and string-comparing
 * one per node per frame is a real cost for a value the caller already knows.
 */
export function applyContentFrame(
  target: FrameTarget,
  index: number | undefined
): void {
  if (target.index === index) return;
  target.index = index;
  const src = contentFrameSrc(target.content, index);
  if (src === undefined) target.img.removeAttribute('src');
  else target.img.setAttribute('src', src);
}

/**
 * Sizes a screen for the room its node has.
 *
 * The frame takes the SCALED size so the layout — and therefore every
 * neighbour's clearance — is told the truth, while the inner keeps its design
 * size and is transformed. `transform-origin` is in the stylesheet, since it
 * never varies.
 */
export function applyContentScreen(
  target: ScreenTarget,
  limit: ContentLimit | undefined
): void {
  const scale = round(screenScale(target.box, limit));
  if (target.scale === scale) return;
  target.scale = scale;
  setStyle(target.frame, {
    width: `${round(target.box.width * scale)}px`,
    height: `${round(target.box.height * scale)}px`,
  });
  // Exactly 1 writes no transform at all: a `scale(1)` still creates a
  // containing block and a stacking context, and the mount-vs-update gate would
  // rightly report the difference against a path that never wrote it.
  if (scale === 1) target.inner.style.removeProperty('transform');
  else setStyle(target.inner, { transform: `scale(${scale})` });
}

/** Three decimals: far below a pixel, and never scientific notation. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
