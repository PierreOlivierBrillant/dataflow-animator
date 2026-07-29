import {
  isPlainText,
  parseRichText,
  type RichSegment,
  type TexNode,
} from '../tex/parse';
import { h, s, type Child } from './el';

/**
 * DOM materialisation of the `$…$` subset — the port of
 * `packages/react/src/tex/RichText.tsx`.
 *
 * The two renderers exist as a pair because a spec's prose reaches the screen
 * through both: node labels are HTML, connection labels are an SVG `<text>`,
 * where `<sub>` does not exist.
 *
 * Both fast-path a string with no `$`, so the overwhelming majority of labels
 * cost one `indexOf` and produce a single text node.
 */

/** Baseline offset of one script level, in `em` of the surrounding text. */
const SHIFT_EM = { sub: 0.22, sup: -0.38 };
/** Font factor per script level, floored at depth 2 — LaTeX stops shrinking
 *  there too, past which a script is unreadable at label size. */
const SCRIPT_SCALE = 0.75;
const MAX_SCRIPT_DEPTH = 2;

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function renderHtml(nodes: TexNode[]): Child[] {
  const out: Child[] = [];
  for (const n of nodes) {
    switch (n.kind) {
      case 'text':
        out.push(n.value);
        break;
      case 'var':
        out.push(h('i', { class: 'rdfa-tex-var' }, [n.value]));
        break;
      case 'space': {
        const space = h('span', { class: 'rdfa-tex-space' });
        space.style.setProperty('margin-left', `${n.em}em`);
        out.push(space);
        break;
      }
      case 'sub':
        out.push(h('sub', undefined, renderHtml(n.children)));
        break;
      case 'sup':
        out.push(h('sup', undefined, renderHtml(n.children)));
        break;
      case 'over':
        out.push(h('span', { class: 'rdfa-tex-over' }, renderHtml(n.children)));
        break;
    }
  }
  return out;
}

/**
 * Appends a spec prose field to `parent`: `$…$` spans become math, the rest
 * stays literal. Nothing wraps text that holds no math.
 */
export function appendRichText(parent: Node, text: string): void {
  if (isPlainText(text)) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  for (const seg of parseRichText(text)) {
    if (seg.kind === 'literal') {
      parent.appendChild(document.createTextNode(seg.value));
    } else {
      parent.appendChild(
        h('span', { class: 'rdfa-tex' }, renderHtml(seg.nodes))
      );
    }
  }
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

/** A leaf of the flattened tree: one `<tspan>` worth of text. */
interface Run {
  value: string;
  italic: boolean;
  overline: boolean;
  /** Baseline offset in `em` of the base text (SVG y grows downwards). */
  shift: number;
  /** Font factor relative to the base text. */
  scale: number;
  /** Horizontal gap to insert BEFORE this run, in `em` of the base text. */
  gap: number;
}

function flattenRuns(segments: RichSegment[]): Run[] {
  const out: Run[] = [];
  let gap = 0;
  const push = (run: Omit<Run, 'gap'>): void => {
    out.push({ ...run, gap });
    gap = 0;
  };
  const walk = (
    nodes: TexNode[],
    depth: number,
    shift: number,
    overline: boolean
  ): void => {
    const scale = Math.pow(SCRIPT_SCALE, Math.min(depth, MAX_SCRIPT_DEPTH));
    for (const n of nodes) {
      switch (n.kind) {
        case 'text':
        case 'var':
          push({
            value: n.value,
            italic: n.kind === 'var',
            overline,
            shift,
            scale,
          });
          break;
        case 'space':
          gap += n.em * scale;
          break;
        case 'sub':
        case 'sup':
          walk(
            n.children,
            depth + 1,
            shift + SHIFT_EM[n.kind] * scale,
            overline
          );
          break;
        case 'over':
          walk(n.children, depth, shift, true);
          break;
      }
    }
  };
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      push({
        value: seg.value,
        italic: false,
        overline: false,
        shift: 0,
        scale: 1,
      });
    } else {
      walk(seg.nodes, 0, 0, false);
    }
  }
  return out;
}

/**
 * Appends a prose field inside an SVG `<text>`.
 *
 * SVG has no `<sub>`, so the tree is flattened into sibling `<tspan>`s carrying
 * an explicit `dy`. Three constraints shape this, and each one is why a naive
 * recursion fails:
 *  - `dy` is cumulative, so only the delta from the previous run is emitted;
 *  - `dy`/`dx` resolve against the tspan's OWN font-size, hence dividing by its
 *    scale to land a shift expressed in base `em`;
 *  - an empty tspan advances nothing, so a `\,` gap can't be its own element —
 *    it rides the next run as `dx`.
 */
export function appendRichTextSvg(parent: SVGElement, text: string): void {
  if (isPlainText(text)) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  let prevShift = 0;
  for (const run of flattenRuns(parseRichText(text))) {
    const dy = (run.shift - prevShift) / run.scale;
    prevShift = run.shift;
    parent.appendChild(
      s(
        'tspan',
        {
          dx:
            run.gap === 0 ? undefined : `${(run.gap / run.scale).toFixed(3)}em`,
          dy: dy === 0 ? undefined : `${dy.toFixed(3)}em`,
          'font-size': run.scale === 1 ? undefined : `${run.scale}em`,
          'font-style': run.italic ? 'italic' : undefined,
          'text-decoration': run.overline ? 'overline' : undefined,
        },
        [run.value]
      )
    );
  }
}
