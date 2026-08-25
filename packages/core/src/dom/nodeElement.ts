import type { Highlighter, Node, ObjectContent } from '../types';
import { isPanelNode, isShapeType, type ShapeType } from '../render/nodeKinds';
import { nodeTint, type ColorOverride } from '../render/nodeColors';
import type { ContentLimit } from '../engine/placements';
import { blockGeometry } from '../engine/blockGeometry';
import { escapeHtml } from '../highlight/highlight';
import { h, pct, px, s, syncStyle, type Child } from './el';
import { buildContentPanel, type CodeFitTarget } from './contentElement';
import { renderNodeIcon } from './icons/nodeIcons';
import { renderSubIcon } from './icons/subIcons';
import { appendRichText } from './richtext';

/**
 * Static node markup — the port of `StaticNode` + `NodeView` + `NodePanel` +
 * `ShapeNode` + `ContentPanel`.
 *
 * A node carrying content (initial `node.content` or an active `set_content`)
 * replaces its whole visual with the panel — no pictogram, no corner badge — and
 * GROWS to fit it. That growth is why the panel is built here, inside the node,
 * rather than in an overlay: the convergence loop has to measure it.
 */

export interface NodeElementOptions {
  /** Placement at build time; rewritten each convergence pass. */
  placement: { cx: number; cy: number };
  /** Effective content: an active `set_content`, else the node's own. */
  content?: ObjectContent;
  /** Content opacity — the `set_content` crossfade. Defaults to 1. */
  contentOpacity?: number;
  /** Revealed fraction [0..1] during a `set_content` transition. The reveal runs
   *  TOP-DOWN via `clip-path`, which does NOT change the layout box — so the
   *  measurement always sees the full panel and never feeds back on itself. */
  reveal?: number;
  /** Per-node panel ceiling, so a panel shrinks rather than covering a
   *  neighbour. Rewritten each pass (it scales with the player). */
  contentLimit?: ContentLimit;
  /** Runtime badge override (`set_icon`); `''` clears it. */
  iconOverride?: string;
  /** Live contact state (0..1) for `switch` / `push_button`. */
  closed?: number;
  loading?: boolean;
  highlighted?: boolean;
  /** Global node opacity (`set_visible` fade). Omitted when >= 1. */
  opacity?: number;
  /** Clockwise rotation (deg) of the VISUAL. The label stays upright. */
  rotation?: number;
  labelSide?: 'left' | 'right';
  colorOverride?: ColorOverride;
  highlight: Highlighter;
}

/**
 * Text under the node: its `text`, its `value` (+`unit`), or both joined — the
 * label convenience for electrical components (`R1 · 10 kΩ`).
 */
function nodeLabel(o: Node): string | undefined {
  const valuePart =
    o.value != null && o.value !== ''
      ? `${o.value}${o.unit ? ` ${o.unit}` : ''}`
      : undefined;
  if (o.text && valuePart) return `${o.text} · ${valuePart}`;
  return o.text ?? valuePart;
}

/**
 * The subset of a node a text panel reads.
 *
 * Origin: `NodePanel.tsx` `PanelContent`.
 */
type PanelContent = Pick<Node, 'type' | 'header' | 'body' | 'language'>;

/** Port of `ShapeNode`'s geometry table. */
function shapeGeometry(type: ShapeType): SVGElement {
  switch (type) {
    case 'circle':
      return s('ellipse', { cx: '50', cy: '50', rx: '48', ry: '48' });
    case 'diamond':
      return s('polygon', { points: '50,2 98,50 50,98 2,50' });
    case 'triangle':
      return s('polygon', { points: '50,4 97,96 3,96' });
    case 'parallelogram':
      return s('polygon', { points: '24,8 98,8 76,92 2,92' });
    case 'star':
      return s('polygon', {
        points:
          '50,2 61.3,34.5 95.6,35.2 68.3,55.9 78.2,88.8 50,69.2 21.8,88.8 31.7,55.9 4.4,35.2 38.7,34.5',
      });
    // `square`, `width_rectangle` and `height_rectangle` — and anything a
    // future ShapeType adds — share the rounded box; the CSS class gives them
    // their proportions.
    default:
      return s('rect', { x: '2', y: '2', width: '96', height: '96', rx: '4' });
  }
}

/**
 * A `type: 'block'` node: a box that SIZES ITSELF from the terminals the spec
 * declares on it.
 *
 * Every coordinate here comes from {@link blockGeometry} — the same call
 * `resolvePin` answers the router with. The labels and the wires therefore
 * cannot disagree: there is no second formula to keep in step, only one result
 * read twice. The box is given its size in DESIGN px scaled by `--rdfa-scale`,
 * like every other node visual, so a thumbnail stays a strict reduction.
 */
function buildBlock(object: Node): HTMLElement {
  const geom = blockGeometry(object);
  const scaled = (v: number): string => `calc(${v}px * var(--rdfa-scale, 1))`;
  const children: Child[] = [
    s(
      'svg',
      {
        class: 'rdfa-block-bg',
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'none',
        role: 'presentation',
        'aria-hidden': 'true',
      },
      [s('rect', { x: '1', y: '1', width: '98', height: '98', rx: '3' })]
    ),
  ];
  for (const row of geom.rows) {
    const label = h('span', {
      class: `rdfa-block-pin rdfa-block-pin--${row.side}`,
    });
    // The along-face fraction IS the terminal's, so the printed name sits on the
    // wire that carries it however the box was sized.
    const at = pct(row.at);
    if (row.side === 'left' || row.side === 'right') label.style.top = at;
    else label.style.left = at;
    appendRichText(label, row.label);
    children.push(label);
  }
  if (object.body) {
    const body = h('span', { class: 'rdfa-block-body' });
    // Inset by the very bands the terminals were spread around, so the
    // designator centres on what is LEFT of the box rather than on the box —
    // which would print it straight over the pin names.
    // Longhands, not the `padding` shorthand: jsdom's CSS parser drops a
    // shorthand whose parts are `calc()`, so the whole inset would vanish in the
    // one environment the unit tests can see it in.
    body.style.paddingTop = scaled(geom.pad.top);
    body.style.paddingRight = scaled(geom.pad.right);
    body.style.paddingBottom = scaled(geom.pad.bottom);
    body.style.paddingLeft = scaled(geom.pad.left);
    appendRichText(body, object.body);
    children.push(body);
  }
  const el = h('div', { class: 'rdfa-block' }, children);
  el.style.width = scaled(geom.w);
  el.style.height = scaled(geom.h);
  return el;
}

/** Port of `ShapeNode`. */
function buildShape(object: Node): HTMLElement {
  const type = object.type as ShapeType;
  const children: Child[] = [
    s(
      'svg',
      {
        class: 'rdfa-shape-bg',
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'none',
        role: 'presentation',
        'aria-hidden': 'true',
      },
      [shapeGeometry(type)]
    ),
  ];
  if (object.body) {
    const text = h('span', { class: 'rdfa-shape-text' });
    appendRichText(text, object.body);
    children.push(text);
  }
  return h('div', { class: `rdfa-shape rdfa-shape--${type}` }, children);
}

/** Port of `NodePanel`. Also the body of a panel-kind packet (`PanelPacket`
 *  reuses `NodePanel` on the React side, so `buildPacketElement` reuses this). */
export function buildPanel(
  object: PanelContent,
  highlight: Highlighter
): HTMLElement {
  const isComplex = object.type === 'complex_node';
  const { header, body, language } = object;

  const zone = (text: string, className: string): HTMLElement => {
    if (!language) return h('div', { class: className }, [text]);
    const el = h('div', { class: `${className} rdfa-code` });
    // The React side uses `dangerouslySetInnerHTML` here — the highlighter
    // returns markup by contract, so this is the literal equivalent.
    el.innerHTML = highlight(text, language);
    return el;
  };

  const children: Child[] = [];
  // The header is only emitted for `complex_node`; `simple_node` is body-only.
  if (isComplex && header)
    children.push(zone(header, 'rdfa-node-panel-header'));
  if (body) children.push(zone(body, 'rdfa-node-panel-body'));

  return h(
    'div',
    {
      class: 'rdfa-node-panel' + (isComplex ? ' rdfa-node-panel--complex' : ''),
    },
    children
  );
}

/** Options accepted by {@link renderNodeVisual}. */
export interface NodeVisualOptions {
  /** Panel syntax highlighting. Default: `escapeHtml`, as in `NodeView`. */
  highlight?: Highlighter;
  /** Contact fraction (0..1) for `switch` / `push_button`. Default: `node.closed`. */
  closed?: number;
  /** Live value in a `signal` pad (`set_icon`); falls back to `node.icon`. */
  signalValue?: string;
}

/**
 * Visual core of a node — panel / shape / signal pad / pictogram — with no
 * positioning, corner badge, spinner or enclosing stage. The port of `NodeView`,
 * and the single dispatch both the retained renderer and the public isolated
 * view go through.
 *
 * `isSignal` and the icon override used to be parameters; they were already
 * derivable from the node plus `signalValue`, so they are derived here instead.
 */
export function renderNodeVisual(
  node: Node,
  options: NodeVisualOptions = {}
): HTMLElement | SVGElement {
  if (isPanelNode(node.type))
    return buildPanel(node as PanelContent, options.highlight ?? escapeHtml);
  if (isShapeType(node.type)) return buildShape(node);
  if (node.type === 'block') return buildBlock(node);
  if (node.type === 'signal') {
    // A labelled I/O pad for logic diagrams: the bit value sits in the centre.
    const val = options.signalValue ?? node.icon ?? '';
    return h(
      'span',
      { class: 'rdfa-signal' },
      val
        ? [h('span', { class: 'rdfa-signal-value' }, [renderSubIcon(val)])]
        : []
    );
  }
  // Stateful contacts read `closed` (live from a `toggle`, else the static
  // `node.closed`); other component/pictogram types ignore it.
  const closedFrac = options.closed ?? (node.closed ? 1 : 0);
  return h('span', { class: 'rdfa-node-icon' }, [
    renderNodeIcon(node.type, { closed: closedFrac }),
  ]);
}

/**
 * What the node's VISUAL BODY is drawn from. When any of these changes, the body
 * subtree is genuinely a different shape and is rebuilt; when none does — the
 * overwhelmingly common case, a node just sitting there while packets fly past —
 * the body is left completely untouched.
 *
 * `closed` is in here because a `switch`/`push_button` contact redraws its SVG
 * geometry at every intermediate value, so a toggle in flight rebuilds this
 * subtree each frame. That is inherent to the drawing, not a shortcoming of the
 * retained mode: React re-renders the same icon component for the same reason.
 */
interface NodeBodyKey {
  content?: ObjectContent;
  effIcon?: string;
  closedFrac: number;
  loading: boolean;
}

/** A retained node: the element plus everything `apply` needs to mutate it. */
export interface NodeElement {
  readonly el: HTMLElement;
  readonly visual: HTMLElement;
  readonly label?: HTMLElement;
  /** Present when the node currently hosts a `code` panel. */
  codeFit?: CodeFitTarget;
  /** Memo of the last applied values, so a stable node costs no DOM writes. */
  cls?: string;
  labelCls?: string;
  body?: NodeBodyKey;
  elStyleKeys?: string[];
  visualStyleKeys?: string[];
}

function sameBodyKey(a: NodeBodyKey | undefined, b: NodeBodyKey): boolean {
  return (
    a != null &&
    // Content objects come from the compiled timeline and are stable across
    // `evaluate` calls, so identity is the right comparison — and the only one
    // that stays cheap for a table with hundreds of cells.
    a.content === b.content &&
    a.effIcon === b.effIcon &&
    a.closedFrac === b.closedFrac &&
    a.loading === b.loading
  );
}

/**
 * Creates the `t`-independent skeleton of one `.rdfa-node`: the element, its
 * optional link wrapper, the empty visual, and the label.
 *
 * The label is here rather than in `apply` because its TEXT is a pure function
 * of the spec node; only its side modifier moves, and `apply` rewrites that.
 */
export function createNodeElement(object: Node): NodeElement {
  const visual = h('span', { class: 'rdfa-node-visual' });

  // A node with a `url` wraps its visual in a link. The wrapper sits BETWEEN
  // `.rdfa-node` and `.rdfa-node-visual`, so `measure()` still finds the visual
  // via `querySelector` and the geometry is unaffected.
  const inner = object.url
    ? h(
        'a',
        {
          class: 'rdfa-node-link',
          href: object.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        [visual]
      )
    : visual;

  const el = h('div', { class: 'rdfa-node', 'data-node-id': object.id }, [
    inner,
  ]);

  const labelText = nodeLabel(object);
  let label: HTMLElement | undefined;
  if (labelText) {
    label = h('span', { class: 'rdfa-node-label' });
    appendRichText(label, labelText);
    el.appendChild(label);
  }

  return { el, visual, label };
}

/**
 * Writes every `t`-dependent value onto a node.
 *
 * The class-name CONCATENATION ORDER is reproduced exactly from `StaticNode`:
 * the CSS has no order-sensitive selectors today, but a diff against the React
 * markup is the main review tool here and gratuitous reordering would hide real
 * changes in noise.
 */
export function applyNodeElement(
  handle: NodeElement,
  object: Node,
  options: NodeElementOptions
): void {
  // Runtime set_icon wins over the static badge; '' clears it (nullish
  // coalescing keeps '' distinct from "no override").
  const effIcon = options.iconOverride ?? object.icon;
  const content = options.content;
  const isPanel = isPanelNode(object.type);
  const isShape = isShapeType(object.type);
  // A `signal` I/O pad shows its value IN the pad (not as a corner badge).
  const isSignal = object.type === 'signal';
  const tinted = !isSignal
    ? (options.colorOverride?.background_color ?? object.background_color)
    : undefined;

  // Content SUPPRESSES every kind modifier: the panel replaces the visual, so
  // `--panel` / `--shape` / `--signal` / `--tinted` would style something that
  // is no longer drawn.
  const cls =
    'rdfa-node' +
    (content ? ' rdfa-node--content' : '') +
    (!content && isPanel ? ' rdfa-node--panel' : '') +
    (!content && isShape ? ' rdfa-node--shape' : '') +
    (!content && isSignal ? ' rdfa-node--signal' : '') +
    (!content && tinted ? ' rdfa-node--tinted' : '') +
    (options.highlighted ? ' rdfa-node--highlight' : '');
  if (handle.cls !== cls) {
    handle.el.setAttribute('class', cls);
    handle.cls = cls;
  }

  // ─── Visual body, rebuilt only when its shape actually changes ─────────────
  const closedFrac = options.closed ?? (object.closed ? 1 : 0);
  const bodyKey: NodeBodyKey = {
    content,
    effIcon,
    closedFrac,
    loading: !!options.loading,
  };
  if (!sameBodyKey(handle.body, bodyKey)) {
    const panel = content
      ? buildContentPanel(content, options.highlight)
      : undefined;
    handle.visual.replaceChildren(
      panel
        ? panel.el
        : renderNodeVisual(object, {
            highlight: options.highlight,
            closed: options.closed,
            signalValue: effIcon,
          })
    );

    // Unique corner badge: the subicon (tech) and the loading ring share the
    // same positioned container, so they always remain concentric. A signal pad
    // shows its value inside instead, so it carries no corner badge. A content
    // panel carries none either — it replaced the visual outright.
    if (!content && !isSignal && (effIcon || options.loading)) {
      const badge = h('span', { class: 'rdfa-node-badge' });
      if (effIcon)
        badge.appendChild(
          h('span', { class: 'rdfa-node-subicon' }, [renderSubIcon(effIcon)])
        );
      if (options.loading)
        badge.appendChild(
          h('span', { class: 'rdfa-spinner', 'aria-hidden': 'true' })
        );
      handle.visual.appendChild(badge);
    }

    handle.codeFit = panel?.codeFit;
    handle.body = bodyKey;
  }

  // Rotation lives on the VISUAL, never on `.rdfa-node`: the label must stay
  // upright, and the layout box arrows anchor to must not change. The reveal's
  // `clip-path` shares the same element — again without touching the box.
  const contentOpacity = options.contentOpacity ?? 1;
  const reveal = options.reveal;
  handle.visualStyleKeys = syncStyle(
    handle.visual,
    {
      ...(content ? { opacity: String(contentOpacity) } : {}),
      ...(content && reveal != null && reveal < 1
        ? { 'clip-path': `inset(0 0 ${((1 - reveal) * 100).toFixed(2)}% 0)` }
        : {}),
      ...(options.rotation != null && options.rotation !== 0
        ? { transform: `rotate(${options.rotation}deg)` }
        : {}),
    },
    handle.visualStyleKeys
  );

  handle.elStyleKeys = syncStyle(
    handle.el,
    {
      left: pct(options.placement.cx),
      top: pct(options.placement.cy),
      opacity:
        options.opacity != null && options.opacity < 1
          ? String(options.opacity)
          : undefined,
      ...nodeTint(object, options.colorOverride),
      ...(content && options.contentLimit
        ? {
            '--rdfa-content-maxw': px(options.contentLimit.maxW),
            '--rdfa-content-maxh': px(options.contentLimit.maxH),
          }
        : {}),
    },
    handle.elStyleKeys
  );

  if (handle.label) {
    const labelCls =
      'rdfa-node-label' +
      (options.labelSide ? ` rdfa-node-label--${options.labelSide}` : '');
    if (handle.labelCls !== labelCls) {
      handle.label.setAttribute('class', labelCls);
      handle.labelCls = labelCls;
    }
  }
}

/** Convenience for the reconciler's create path: `create` then `apply`. */
export function buildNodeElement(
  object: Node,
  options: NodeElementOptions
): NodeElement {
  const handle = createNodeElement(object);
  applyNodeElement(handle, object, options);
  return handle;
}

// NOTE — there is deliberately no narrow `applyNodePlacement` /
// `applyContentLimit` pair any more. Both used to be called out-of-band by the
// convergence loop, which meant two writers touched `.rdfa-node`'s inline style
// while only one of them tracked what it had written. `syncStyle` can only
// remove a stale declaration if it knows it wrote it, so the placement and the
// panel ceilings now go through `applyNodeElement` like everything else: ONE
// writer, one key set, no declaration able to outlive the state that produced
// it. The convergence loop calls the full `apply`, which is memoised and writes
// nothing when nothing changed.
