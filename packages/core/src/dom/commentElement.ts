import { nodeFootprint, type NodeGeom } from '../engine/geometry';
import {
  anchoredBox,
  anchorOf,
  planAnchored,
  planFree,
  type BubblePlan,
} from '../engine/overlayPlacement';
import { clamp } from '../engine/timeline';
import { h, px, setStyle } from './el';
import { appendRichText } from './richtext';

/**
 * Comment bubble markup — the port of `CommentBubble.tsx`.
 *
 * FIDELITY NOTE — the rich-text treatment is ASYMMETRIC in the React component,
 * and that asymmetry is reproduced here rather than tidied up: the OMNISCIENT
 * bubble renders `richText(text)`, the node-anchored one renders the raw string
 * plus a tail `<span>`. Normalising the two would change pixels for any spec
 * whose comment contains `$…$`.
 *
 * Like packets, this is an ABSOLUTE OVERLAY (`.rdfa-comment` is
 * `position: absolute`), so it cannot feed back into node measurement and is
 * built once, after the convergence loop.
 */

/** Half the tail's base (px) — the tail never leaves the bubble's rounded ends. */
const TAIL_INSET = 14;

export interface CommentElementOptions {
  /** Anchor node. Absent = omniscient bubble. */
  node?: NodeGeom;
  text: string;
  opacity: number;
  stageW: number;
  stageH: number;
  /**
   * Where `planBubbles` decided the bubble goes, clear of what else shares its
   * screen time. Absent, it is placed against its own node only: above it (or
   * below when there is no room above), or centred at the top of the stage.
   */
  plan?: BubblePlan;
}

/** A retained bubble: the element plus the tail `apply` repositions. */
export interface CommentElement {
  readonly el: HTMLElement;
  readonly tail?: HTMLElement;
  readonly omniscient: boolean;
}

/**
 * Builds the bubble itself — the `t`-independent half.
 *
 * `omniscient` is fixed for the lifetime of the element because it decides the
 * rich-text treatment (see the asymmetry note above) and whether a tail exists.
 * A clip either names a `nextToId` or does not; it never switches mid-flight, so
 * the reconciler creates a new element rather than mutating across that line.
 */
export function createCommentElement(
  text: string,
  omniscient: boolean
): CommentElement {
  const el = h('div', {
    class: omniscient
      ? 'rdfa-comment rdfa-comment--omniscient'
      : 'rdfa-comment',
  });
  // Omniscient bubbles interpret `$…$`; anchored ones do not — see the note above.
  if (omniscient) appendRichText(el, text);
  else el.appendChild(document.createTextNode(text));

  const tail = omniscient
    ? undefined
    : h('span', { class: 'rdfa-comment-tail' });
  if (tail) el.appendChild(tail);

  return { el, tail, omniscient };
}

/**
 * Measures the bubble and writes its placement.
 *
 * The measure-then-place shape is REQUIRED, not stylistic: the bubble's
 * placement is a function of its own rendered size, which is only knowable once
 * it is in the document. React discovers that size through a `ResizeObserver`
 * and re-renders; here the element is measured then placed — reaching the same
 * resting state in one synchronous step instead of two frames. The element must
 * therefore already be in `parent` when this runs.
 *
 * The size is re-read on every call rather than cached. It genuinely can change
 * without the text changing (`.rdfa-comment` is `max-width`-capped, so it
 * reflows when the player resizes), and a bubble is a rare, small element — a
 * cached size that silently went stale would cost a pixel, which is worse than
 * the layout read.
 *
 * `offsetWidth`/`offsetHeight` (not `getBoundingClientRect`) on purpose: React
 * stores those, and they are ROUNDED to integers. A fractional rect would place
 * the bubble a sub-pixel off and light up the diff.
 */
export function applyCommentElement(
  handle: CommentElement,
  options: CommentElementOptions
): void {
  const { node, opacity, stageW, stageH, plan } = options;
  const { el, tail, omniscient } = handle;

  const size = { w: el.offsetWidth, h: el.offsetHeight };
  const stage = { w: stageW, h: stageH };
  const degenerate = size.w === 0 || size.h === 0;
  const visibility = degenerate ? 'hidden' : 'visible';

  // `omniscient` and `node` are decided together at creation, but they are two
  // values as far as the type system is concerned — testing both narrows `node`
  // and keeps the pair honest if a caller ever mismatches them.
  if (omniscient || !node) {
    const free =
      plan && 'free' in plan ? plan.free : planFree(undefined, size, stage, []);
    setStyle(el, {
      left: px(free.left),
      top: px(free.top),
      opacity: String(opacity),
      visibility,
    });
    return;
  }

  // The plan is a SIDE and a distance, not a position: the box is rebuilt from
  // the node as it is this frame, so the bubble follows a node that moves.
  const anchor = anchorOf(node);
  const anchored =
    plan && 'anchored' in plan
      ? plan.anchored
      : planAnchored(anchor, size, stage, [nodeFootprint(node)]);
  const box = anchoredBox(anchor, anchored, size, stage);
  // The class is TOGGLED, not just added: in retained mode a bubble whose anchor
  // drifts back up must lose the modifier again, which a build-once path never
  // had to care about.
  el.classList.toggle('rdfa-comment--below', anchored.side === 'below');
  // The tail keeps pointing at the node even when the bubble is pushed off the
  // node's axis by an edge clamp.
  const tailX =
    size.w > 0
      ? clamp(node.x - box.x, TAIL_INSET, size.w - TAIL_INSET)
      : size.w / 2;

  setStyle(el, {
    left: px(box.x),
    top: px(box.y),
    opacity: String(opacity),
    visibility,
  });
  if (tail) setStyle(tail, { left: px(tailX) });
}

/**
 * Convenience for the reconciler's create path: builds the bubble, appends it to
 * `parent` (it must be in the document to be measurable) and places it.
 */
export function appendCommentElement(
  parent: HTMLElement,
  options: CommentElementOptions
): CommentElement {
  const handle = createCommentElement(options.text, !options.node);
  // Appended with no left/top yet: `.rdfa-comment` is absolutely positioned and
  // width-capped by `max-width`, so its size does NOT depend on where it ends
  // up — measuring before placing is safe.
  parent.appendChild(handle.el);
  applyCommentElement(handle, options);
  return handle;
}
