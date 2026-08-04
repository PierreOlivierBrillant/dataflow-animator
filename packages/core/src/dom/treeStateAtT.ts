import type { DataFlowSpec } from '../types';
import {
  easeInOutCubic,
  clamp,
  type ActiveClip,
  type ReflowClip,
  type SetVisibleClip,
} from '../engine/timeline';
import { treeEdges, type LayoutMap } from '../engine/layout';
import { lerp } from './stageConstants';

/**
 * Time it takes an auto-drawn tree edge to grow from its parent to its child,
 * once that child has finished appearing.
 */
const EDGE_DRAW_MS = 450;

/** One parent→child edge of the topology as it stands at `t`. */
interface TreeEdgeAtT {
  /** Parent node id. */
  from: string;
  /** Child node id — also the key `tree.edges[...]` styling is looked up by. */
  to: string;
  /** Draw-in fraction (0..1); 1 for an edge that is fully drawn. */
  progress: number;
}

export interface TreeStateAtT {
  /**
   * Layout the nodes are PLACED from at `t`. Equal to the static layout at rest;
   * interpolated between the pre- and post-rotation placements while a
   * `rotate_subtree` is in flight.
   */
  layout: LayoutMap;
  /** Parent→child edges to draw, in the topology reached at `t`. */
  edges: TreeEdgeAtT[];
  /** True while a rotation is animating — i.e. `layout` is NOT the static one. */
  reflowing: boolean;
}

/**
 * State of a `direction: 'tree'` stage at a frozen instant — the counterpart of
 * {@link computeNodeStateAtT} for the two things a tree adds to a stage: node
 * positions that MOVE, and the parent→child edges drawn between them.
 *
 * Pure: a function of `(spec, layout, active clips, t)` only, with no DOM and no
 * measurement, so it scrubs both ways like everything else on the frame path.
 *
 * Each `rotate_subtree` compiles to a reflow clip carrying the layouts on both
 * sides of the rotation plus the post-rotation edges. The most recent ACTIVE one
 * wins: clips are start-ordered, and each one's `fromLayout` is the previous
 * one's `toLayout`, so it already captures the cumulative state. Before any
 * rotation we fall back to the static layout and the spec's initial edges.
 */
export function computeTreeStateAtT(
  spec: DataFlowSpec,
  layout: LayoutMap,
  active: ActiveClip[],
  tMs: number
): TreeStateAtT {
  if (!spec.tree) return { layout, edges: [], reflowing: false };

  let lastReflow: ReflowClip | undefined;
  let lastProgress = 1;
  // End instant of the `set_visible` that revealed each node: an edge is drawn
  // AFTER its child has appeared (place the node, then connect it), instead of
  // popping in together with it.
  const revealEnd: Record<string, number> = {};
  for (const a of active) {
    if (a.clip.kind === 'reflow') {
      lastReflow = a.clip as ReflowClip;
      lastProgress = a.progress;
    } else if (a.clip.kind === 'set_visible') {
      const clip = a.clip as SetVisibleClip;
      if (clip.visible) revealEnd[clip.objectId] = clip.endMs;
      else delete revealEnd[clip.objectId];
    }
  }

  const pairs = lastReflow ? lastReflow.edges : treeEdges(spec.tree);
  const edges: TreeEdgeAtT[] = [];
  for (const [from, to] of pairs) {
    const re = revealEnd[to];
    edges.push({
      from,
      to,
      progress:
        re == null ? 1 : easeInOutCubic(clamp((tMs - re) / EDGE_DRAW_MS, 0, 1)),
    });
  }

  if (!lastReflow) return { layout, edges, reflowing: false };

  const f = easeInOutCubic(lastProgress);
  const moved: LayoutMap = {};
  for (const id of Object.keys(layout)) {
    const from = lastReflow.fromLayout[id] ?? layout[id];
    const to = lastReflow.toLayout[id] ?? layout[id];
    moved[id] = { cx: lerp(from.cx, to.cx, f), cy: lerp(from.cy, to.cy, f) };
  }
  // A settled rotation leaves the clip active (keepEnd) at progress 1, where the
  // interpolated layout IS the post-rotation one — but it is still not the
  // static layout, so the placements must keep coming from here.
  return { layout: moved, edges, reflowing: true };
}
