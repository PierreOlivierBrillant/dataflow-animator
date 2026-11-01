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
 * How a code block is drawn: its font as a share of the base size, and whether
 * its lines wrap.
 */
export interface CodeFit {
  scale: number;
  wrap: boolean;
}

/** The fit of a block that needs nothing: base size, no wrapping. */
export const NATURAL_CODE_FIT: CodeFit = { scale: 1, wrap: false };

/**
 * The smallest share of the base size code is shrunk to — 8 design px out of
 * 12.5. Below it a block WRAPS instead.
 *
 * Shrinking without a floor is what made a long line unreadable: a 45-column
 * line in a panel squeezed between a node and the stage edge came out at a
 * third of its size, while the room under it stayed empty. Wrapping spends
 * that height on legibility. The floor is relative rather than in pixels
 * because everything else on the stage is: a thumbnail is small all over.
 */
export const CODE_LEGIBLE_SCALE = 0.64;

/** Halvings of the bracket a block whose wrapped lines still overflow is fit in. */
const WRAP_SEARCH_STEPS = 6;

/** Class that lets a `<pre>` wrap — see `.rdfa-code-wrap` in the stylesheet. */
const WRAP_CLASS = 'rdfa-code-wrap';

/**
 * Measures the fit this code block needs ON ITS OWN, and records its base font
 * size — the port of `CodeBlock`'s layout effect, plus the legibility floor.
 *
 * Reads at the BASE font and unwrapped (the inline size and the wrap class are
 * cleared for the duration and restored before returning), so `natural*` and
 * `avail*` are both expressed in the same units no matter what fit is currently
 * applied. That is what makes the fixed point stable rather than oscillating
 * with its own output.
 *
 * A block that would have to go below {@link CODE_LEGIBLE_SCALE} wraps at that
 * scale instead, or — if even its wrapped lines overflow the panel's height —
 * at the largest scale between its unwrapped fit and the floor that holds them.
 * Unwrapped fit is always a solution: at that size no line reaches the edge.
 */
export function measureCodeFit(target: CodeFitTarget): CodeFit {
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
  const wrapped = el.classList.contains(WRAP_CLASS);
  el.style.removeProperty('font-size');
  if (wrapped) el.classList.remove(WRAP_CLASS);
  const base = parseFloat(getComputedStyle(el).fontSize) || FALLBACK_BASE_FONT;
  const naturalW = el.scrollWidth - padX;
  const naturalH = el.scrollHeight - padY;
  const availW = el.clientWidth - padX;
  // Available height = body height (bounded by max-height), minus <pre> padding.
  const body = el.parentElement;
  const availH = (body ? body.clientHeight : el.clientHeight) - padY;

  const ratioW =
    availW > 0 && naturalW > availW ? (availW - FIT_SAFETY) / naturalW : 1;
  const ratioH =
    availH > 0 && naturalH > availH ? (availH - FIT_SAFETY) / naturalH : 1;
  const unwrapped = Math.min(ratioW, ratioH, 1);

  let fit: CodeFit = { scale: unwrapped, wrap: false };
  if (unwrapped < CODE_LEGIBLE_SCALE) {
    // Wrapped lines grow the body up to its ceiling, not just to the height it
    // has now — so the room is the max-height.
    const ceiling = body ? parseFloat(getComputedStyle(body).maxHeight) : NaN;
    const roomH = (Number.isFinite(ceiling) ? ceiling : availH) - padY;
    el.classList.add(WRAP_CLASS);
    const holds = (scale: number): boolean => {
      el.style.setProperty('font-size', `${base * scale}px`);
      return el.scrollHeight - padY <= roomH - FIT_SAFETY;
    };
    let scale = CODE_LEGIBLE_SCALE;
    if (!holds(scale)) {
      let low = unwrapped;
      let high = CODE_LEGIBLE_SCALE;
      for (let i = 0; i < WRAP_SEARCH_STEPS; i++) {
        const mid = (low + high) / 2;
        if (holds(mid)) low = mid;
        else high = mid;
      }
      scale = low;
    }
    el.classList.remove(WRAP_CLASS);
    el.style.removeProperty('font-size');
    fit = { scale, wrap: true };
  }

  // Restored through the CSSOM rather than by assigning back a possibly-empty
  // string: `el.style.fontSize = ''` materialises an empty `style=""` attribute
  // on a block that never had one, which is a DOM difference the mount-vs-update
  // gate would (rightly) report even though nothing renders differently. Same
  // for the class.
  if (applied) el.style.setProperty('font-size', applied);
  else pruneEmptyStyle(el);
  if (wrapped) el.classList.add(WRAP_CLASS);
  else pruneEmptyClass(el);

  target.baseFont = base;
  return fit;
}

/**
 * Writes a block's fit: its font scale and its wrapping.
 *
 * Each block gets its OWN fit. They used to share the smallest one, so that
 * every panel on the stage rendered at the same size — which let the most
 * cramped panel shrink a roomy one to the same unreadable size.
 *
 * A scale of 1 (or a block not yet measured) REMOVES the inline size rather
 * than writing `1×base`: `CodeBlock` passes `undefined` there, and React drops
 * the declaration entirely. Leaving a rounded `12.5px` behind instead would
 * pin the size against a stylesheet that scales with the player.
 */
export function applyCodeFontScale(target: CodeFitTarget, fit: CodeFit): void {
  const { pre, baseFont } = target;
  if (fit.wrap && baseFont != null) pre.classList.add(WRAP_CLASS);
  else if (pre.classList.contains(WRAP_CLASS)) {
    pre.classList.remove(WRAP_CLASS);
    pruneEmptyClass(pre);
  }
  if (baseFont == null || fit.scale >= 1) {
    pre.style.removeProperty('font-size');
    pruneEmptyStyle(pre);
    return;
  }
  setStyle(pre, { 'font-size': `${Math.max(1, baseFont * fit.scale)}px` });
}

/** `class=""` left behind by a removed token — see `pruneEmptyStyle`. */
function pruneEmptyClass(el: HTMLElement): void {
  if (el.getAttribute('class') === '') el.removeAttribute('class');
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
