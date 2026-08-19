import type { LineStyle, PathShape } from '../types';
import {
  connection,
  pathD,
  pathTip,
  visiblePath,
  type Connection,
  type NodeContour,
  type NodeGeom,
  type Point,
} from '../engine/geometry';
import type { ConnectionAxis } from '../engine/layout';
import { s, setAttrIfChanged, syncStyle } from './el';
import { ARROW_HEAD } from './stageConstants';
import { appendRichTextSvg } from './richtext';

/**
 * SVG arrow between two nodes.
 *
 * `progress` ∈ [0,1] animates the progressive drawing; a static connection
 * passes 1. Produces a `<g>` meant to live inside `<svg class="rdfa-arrow-svg">`.
 *
 * RETAINED MODE — the module is split in two, and the split is the pattern
 * every element module follows:
 *
 *  - {@link createArrowElement} builds the parts that exist no matter what `t`
 *    is: the `<g>` and its `<path>`.
 *  - {@link applyArrowElement} writes EVERY `t`-dependent value onto them.
 *
 * Creating an arrow is therefore `create` followed by `apply`, and updating one
 * is `apply` alone. That is what makes `mount(t₀) + update(t)` identical to
 * `mount(t)` BY CONSTRUCTION rather than by empirical agreement: both paths run
 * the same writer.
 *
 * The two arrowheads genuinely appear and disappear with `progress` (they exist
 * only above 0.02), so `apply` creates and removes them. They are re-inserted at
 * fixed positions — after the path, before the label — so the document order
 * never depends on the order updates arrived in.
 */

export interface ArrowDescriptor {
  from: NodeGeom;
  to: NodeGeom;
  startPortOffset?: number;
  endPortOffset?: number;
  style?: LineStyle;
  /** Path shape. Default: 'bezier'. */
  path?: PathShape;
  arrow_head?: 'forward' | 'backward' | 'both' | 'none';
  text?: string;
  /** 1 for a static arrow (decoration), interpolated for a dynamic arrow. */
  progress: number;
  highlighted?: boolean;
  /** Line colour (CSS string, possibly a `color-mix(...)` cross-fade). */
  color?: string;
  /** All stage nodes — to route around labels. */
  obstacles?: NodeGeom[];
  axis?: ConnectionAxis;
  fromContour?: NodeContour;
  toContour?: NodeContour;
  /** Precomputed orthogonal polyline (circuit schematics). When given, it fully
   *  replaces the per-wire `connection()` routing. */
  route?: Point[];
  /** Points of `route` where THIS wire steps over another net's wire. */
  hops?: Point[];
  hopRadius?: number;
}

/** Builds a {@link Connection} from a ready-made polyline (router output), so
 *  the arrowhead / progress animation traverse it exactly like a routed path. */
function connectionFromRoute(route: Point[]): Connection {
  const start = route[0];
  const end = route[route.length - 1];
  const prev = route[route.length - 2] ?? start;
  const angleDeg = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI;
  return {
    start,
    end,
    waypoints: route.length > 2 ? route.slice(1, -1) : undefined,
    angleDeg,
  };
}

function headPoints(tip: Point, angleRad: number): string {
  return (
    `${tip.x},${tip.y} ` +
    `${tip.x - ARROW_HEAD * Math.cos(angleRad - Math.PI / 6)},${tip.y - ARROW_HEAD * Math.sin(angleRad - Math.PI / 6)} ` +
    `${tip.x - ARROW_HEAD * Math.cos(angleRad + Math.PI / 6)},${tip.y - ARROW_HEAD * Math.sin(angleRad + Math.PI / 6)}`
  );
}

/**
 * A retained arrow: the `<g>` plus the child references `apply` mutates.
 *
 * `labelText` is cached because rebuilding rich text is the one write here that
 * is not a single attribute — re-running `appendRichTextSvg` every frame for a
 * label that never changes would be exactly the per-frame rebuild this step
 * exists to remove.
 */
export interface ArrowElement {
  readonly g: SVGGElement;
  path: SVGPathElement;
  forwardHead?: SVGPolygonElement;
  backwardHead?: SVGPolygonElement;
  label?: SVGTextElement;
  labelText?: string;
  colorStyleKeys?: string[];
}

/** Creates the `t`-independent skeleton. Not renderable until `apply` runs. */
export function createArrowElement(): ArrowElement {
  const g = s('g');
  const path = s('path');
  g.appendChild(path);
  return { g, path };
}

export function applyArrowElement(
  el: ArrowElement,
  desc: ArrowDescriptor
): void {
  const {
    from,
    to,
    startPortOffset = 0,
    endPortOffset = 0,
    style = 'solid',
    path,
    text,
    progress,
    highlighted,
    color,
    obstacles,
    arrow_head,
    axis,
    fromContour,
    toContour,
    route,
    hops,
    hopRadius,
  } = desc;

  const headStyle = arrow_head ?? 'forward';
  const renderForward = headStyle === 'forward' || headStyle === 'both';
  const renderBackward = headStyle === 'backward' || headStyle === 'both';

  // A precomputed orthogonal route (circuit schematics) fully replaces the
  // per-wire routing; otherwise `connection()` anchors + shapes the path,
  // taking obstacles (labels) into account.
  const conn =
    route && route.length >= 2
      ? connectionFromRoute(route)
      : connection(
          from,
          to,
          obstacles,
          startPortOffset,
          endPortOffset,
          path,
          axis,
          fromContour,
          toContour
        );

  // Position and angle of the tip at parameter `progress`.
  const tip = pathTip(conn, progress);
  const ang = (tip.angleDeg * Math.PI) / 180;
  const startTip = pathTip(conn, 0);
  const angStart = (startTip.angleDeg * Math.PI) / 180 + Math.PI;

  // Visible path (polyline) from start to tip. The ends are shortened to the
  // base of the arrow triangle so the stroke thickness does not protrude under
  // the tip.
  const pts = visiblePath(conn, progress);
  const ptsAdjusted = [...pts];
  if (renderForward && progress > 0.02 && ptsAdjusted.length >= 2) {
    ptsAdjusted[ptsAdjusted.length - 1] = {
      x: tip.x - ARROW_HEAD * Math.cos(ang),
      y: tip.y - ARROW_HEAD * Math.sin(ang),
    };
  }
  if (renderBackward && progress > 0.02 && ptsAdjusted.length >= 2) {
    ptsAdjusted[0] = {
      x: startTip.x - ARROW_HEAD * Math.cos(angStart),
      y: startTip.y - ARROW_HEAD * Math.sin(angStart),
    };
  }

  const lineCls = `rdfa-arrow-line${highlighted ? ' rdfa-arrow-line--highlight' : ''}`;
  const headCls = `rdfa-arrow-head${highlighted ? ' rdfa-arrow-head--highlight' : ''}`;

  const { g } = el;
  // A custom colour overrides the theme's neutral stroke variable that both the
  // line (stroke) and the head (fill) read; the `--highlight` classes paint
  // `--rdfa-accent` instead, so a highlighted connection keeps the accent.
  // Clearing it when the colour goes away matters in retained mode: React drops
  // the declaration on re-render, so a stale variable would outlive its clip.
  el.colorStyleKeys = syncStyle(
    g,
    color ? { '--rdfa-arrow': color } : {},
    el.colorStyleKeys
  );

  // `style` is destructured with a default, so `data-style` is ALWAYS emitted.
  setAttrIfChanged(el.path, 'class', lineCls);
  setAttrIfChanged(el.path, 'data-style', style);
  setAttrIfChanged(el.path, 'd', pathD(ptsAdjusted, hops, hopRadius));

  // Heads are inserted at fixed slots (after the path, before the label) so the
  // child order is a function of the descriptor alone, never of update history.
  const wantForward = renderForward && progress > 0.02;
  const wantBackward = renderBackward && progress > 0.02;

  if (wantForward) {
    if (!el.forwardHead) {
      el.forwardHead = s('polygon');
      g.insertBefore(el.forwardHead, el.path.nextSibling);
    }
    setAttrIfChanged(el.forwardHead, 'class', headCls);
    setAttrIfChanged(el.forwardHead, 'points', headPoints(tip, ang));
  } else if (el.forwardHead) {
    el.forwardHead.remove();
    el.forwardHead = undefined;
  }

  if (wantBackward) {
    if (!el.backwardHead) {
      el.backwardHead = s('polygon');
      g.insertBefore(el.backwardHead, (el.forwardHead ?? el.path).nextSibling);
    }
    setAttrIfChanged(el.backwardHead, 'class', headCls);
    setAttrIfChanged(el.backwardHead, 'points', headPoints(startTip, angStart));
  } else if (el.backwardHead) {
    el.backwardHead.remove();
    el.backwardHead = undefined;
  }

  if (text) {
    // Label position: the anchor offset if the middle of the path falls on an
    // interleaved node, otherwise the middle of the path.
    const mid = conn.labelAnchor ?? pathTip(conn, 0.5);
    if (!el.label) {
      el.label = s('text', {
        class: 'rdfa-arrow-label',
        'text-anchor': 'middle',
      });
      g.appendChild(el.label);
    }
    if (el.labelText !== text) {
      el.label.replaceChildren();
      appendRichTextSvg(el.label, text);
      el.labelText = text;
    }
    setAttrIfChanged(el.label, 'x', String(mid.x));
    setAttrIfChanged(el.label, 'y', String(mid.y - 6));
    setAttrIfChanged(el.label, 'opacity', String(progress));
  } else if (el.label) {
    el.label.remove();
    el.label = undefined;
    el.labelText = undefined;
  }
}

/** Convenience for the reconciler's create path: `create` then `apply`. */
export function buildArrowElement(desc: ArrowDescriptor): ArrowElement {
  const el = createArrowElement();
  applyArrowElement(el, desc);
  return el;
}
