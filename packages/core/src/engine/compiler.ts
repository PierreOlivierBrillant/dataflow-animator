import type {
  Action,
  ActionType,
  DataFlowSpec,
  LineStyle,
  PathShape,
  TreeSpec,
} from '../types';
import { derivedDuration } from './readingTime';
import {
  appearHold,
  arriveHold,
  derivedMoveDuration,
  moveDistance,
  REFERENCE_ASPECT,
} from './motionTime';
import { refNode } from './pins';
import type {
  ArrowClip,
  Clip,
  CommentClip,
  FlowClip,
  HighlightClip,
  LoadingClip,
  MoveClip,
  ReflowClip,
  RotateClip,
  SetColorClip,
  SetContentClip,
  SetIconClip,
  SetVisibleClip,
  Step,
  Timeline,
  ToggleClip,
} from './timeline';
import { computeLayout, treeEdges, treeLayout, type LayoutMap } from './layout';

/**
 * Compiler: `spec.timeline` -> `Timeline` (deterministic IR).
 *
 * Manages: default sequential ordering, `parallel` blocks (same timestamp),
 * relative synchronization `wait_for`, lifecycle `keep_until`/`keep_until_next`,
 * and splitting into root steps.
 */

export interface CompileResult {
  timeline: Timeline;
  /** Non-blocking warnings (missing references, etc.). */
  warnings: string[];
}

/** Pause (ms) inserted between two root steps, for clear stops in navigation. */
export const STEP_GAP = 250;

const DEFAULT_DURATION: Record<ActionType, number> = {
  move: 500,
  arrow: 500,
  loading: 1200,
  set_content: 500,
  comment: 500,
  highlight: 600,
  parallel: 0,
  set_visible: 300,
  set_color: 400,
  set_icon: 300,
  rotate: 600,
  rotate_subtree: 700,
  // One full lap of the current; slow enough to read a charge crossing a wire.
  flow: 3000,
  toggle: 400,
  wait: 1000,
};

// Default for `keep_until_next` by action type (see schema).
const DEFAULT_KEEP_NEXT: Partial<Record<ActionType, boolean>> = {
  move: false,
  arrow: true,
  comment: true,
  set_content: true,
  highlight: true,
  loading: false,
  set_visible: false,
  set_color: false,
  set_icon: false,
  rotate: false,
  rotate_subtree: false,
  // A current keeps circulating for the whole step (like a decor arrow); a
  // toggle latches its reached state (handled via keepEnd in the clip).
  flow: true,
  toggle: false,
};

/** Normalizes line style (accepts historical alias `full`). */
function normalizeStyle(style: string | undefined): LineStyle {
  if (style === 'dotted' || style === 'dashed' || style === 'animated')
    return style;
  return 'solid'; // 'solid', 'full' (alias) or missing
}

/** Normalizes path shape (bezier by default, including unknown value). */
function normalizePath(path: string | undefined): PathShape {
  if (
    path === 'straight' ||
    path === 'step' ||
    path === 'smoothstep' ||
    path === 'simplebezier'
  )
    return path;
  return 'bezier';
}

/** Deep copy of a tree topology, so rotations mutate a local working state. */
function cloneTree(tree: TreeSpec): TreeSpec {
  const children: TreeSpec['children'] = {};
  for (const [id, ch] of Object.entries(tree.children)) {
    children[id] = { left: ch.left, right: ch.right };
  }
  return { root: tree.root, children };
}

function setChild(
  tree: TreeSpec,
  node: string,
  side: 'left' | 'right',
  child: string | undefined
): void {
  const ch = (tree.children[node] ??= {});
  if (child === undefined) delete ch[side];
  else ch[side] = child;
}

/**
 * Applies a standard binary-tree rotation in place. A LEFT rotation around
 * `pivot` lifts its right child; a RIGHT rotation lifts its left child. The
 * pivot's parent link is rewired so the lifted child takes the pivot's place
 * (or becomes the new root). Returns false if the required child is missing.
 */
function rotateSubtree(
  tree: TreeSpec,
  pivot: string,
  dir: 'left' | 'right'
): boolean {
  const isLeft = dir === 'left';
  const px = tree.children[pivot];
  const lifted = isLeft ? px?.right : px?.left;
  if (!lifted) return false;

  // Locate the pivot's parent BEFORE mutating (afterwards the pivot hangs
  // under `lifted`, which would make the scan find the wrong parent).
  let parentId: string | undefined;
  let parentSide: 'left' | 'right' = 'left';
  for (const [pid, ch] of Object.entries(tree.children)) {
    if (ch.left === pivot) {
      parentId = pid;
      parentSide = 'left';
      break;
    }
    if (ch.right === pivot) {
      parentId = pid;
      parentSide = 'right';
      break;
    }
  }

  const liftedCh = tree.children[lifted];
  // The lifted child's inner subtree moves under the pivot.
  const inner = isLeft ? liftedCh?.left : liftedCh?.right;
  setChild(tree, pivot, isLeft ? 'right' : 'left', inner);
  setChild(tree, lifted, isLeft ? 'left' : 'right', pivot);
  if (parentId === undefined) tree.root = lifted;
  else setChild(tree, parentId, parentSide, lifted);
  return true;
}

interface PendingClip {
  clip: Clip;
  keepUntil?: string;
  keepNext: boolean;
  keepEnd: boolean;
  stepIndex: number;
  /**
   * True when this clip is emitted by a `parallel` child. Such clips do NOT
   * contribute their own navigation stops: a `parallel` is atomic for stepping
   * (a single stop at the group's end), so its children are never stepped into.
   */
  inParallel?: boolean;
  /**
   * Continuous-spin speed (deg/s) for a `rotate` spin. When set, pass 2 resolves
   * the clip's spin-stop instant (`endMs`) and final `toDeg` from the timing
   * fields (`duration` / `keep_until` / `keep_until_end`).
   */
  spinDegPerSec?: number;
}

interface Ctx {
  pending: PendingClip[];
  timingById: Map<string, { startMs: number; endMs: number }>;
  warnings: string[];
  counter: number;
  /**
   * Navigation stops contributed by top-level `parallel` groups (their end
   * instant). A parallel is a single logical action for stepping, so it yields
   * one stop for the whole group instead of one per child clip.
   */
  parallelStops: number[];
  /**
   * Running rotation angle (deg) per node, seeded from `node.rotation`.
   * Each `rotate` action reads it as the interpolation start, then updates it
   * to its target — so chained rotations accumulate in declaration order.
   */
  rotationById: Map<string, number>;
  /**
   * Tree mode working state (only when `direction: 'tree'`). `state` is the
   * current topology, `layout` its current placements; each `rotate_subtree`
   * mutates `state`, recomputes `layout`, and emits the before→after reflow.
   */
  tree?: { state: TreeSpec; nodeIds: string[]; layout: LayoutMap };
  /** {@link DataFlowSpec.pace}, resolved once — scales every derived duration. */
  pace: number;
  /**
   * Node placements in the reference frame, for deriving a move's duration from
   * its length. LAZY: a `graph` layout runs a 400-iteration force-directed pass,
   * and the mount computes its own layout anyway — so a spec whose moves all
   * declare a `duration` must not pay for a second one. `null` = not yet asked.
   */
  referenceLayout: LayoutMap | null;
  /** Resolves {@link Ctx.referenceLayout} on first use. */
  layoutOf: () => LayoutMap;
}

function makeId(ctx: Ctx, action: Action): string {
  return action.id ?? `${action.type}-${ctx.counter++}`;
}

interface Window {
  startMs: number;
  /** Animation end (arrival). Serves as target for wait_for. */
  animEndMs: number;
  /** End of time footprint (anim + arrival hold), for sequencing. */
  occupiedEndMs: number;
}

/**
 * Compiles an action and returns its time window.
 *
 * @param minStartMs — floor for startMs (used for root actions so
 *   that wait_for can only delay, never go back before step start).
 *   Not passed to parallel children, which keep strict semantics.
 * @param inParallel — true when compiling inside a `parallel` group. Emitted
 *   clips are then flagged so they don't produce individual navigation stops.
 */
function compileAction(
  action: Action,
  baseStart: number,
  stepIndex: number,
  ctx: Ctx,
  minStartMs = 0,
  inParallel = false
): Window {
  // wait_for resolution (reference to an already compiled action).
  let startMs = baseStart;
  if (action.wait_for) {
    const ref = ctx.timingById.get(action.wait_for);
    if (ref) startMs = ref.endMs;
    else
      ctx.warnings.push(
        `wait_for: action "${action.wait_for}" not found (or defined later).`
      );
  }
  // Lower bound: a root action cannot start before its step,
  // even if wait_for points to a much earlier action.
  if (startMs < minStartMs) startMs = minStartMs;
  // Explicit offset (delay_ms), applied after clamp: always additive.
  if (action.delay_ms) startMs += action.delay_ms;

  if (action.type === 'parallel') {
    const children = action.actions ?? [];
    let animEndMs = startMs;
    let occupiedEndMs = startMs;
    for (const child of children) {
      // minStartMs not passed: children keep strict semantics.
      // inParallel = true: child clips won't emit their own stops.
      const r = compileAction(child, startMs, stepIndex, ctx, 0, true);
      if (r.animEndMs > animEndMs) animEndMs = r.animEndMs;
      if (r.occupiedEndMs > occupiedEndMs) occupiedEndMs = r.occupiedEndMs;
    }
    // A parallel is atomic for stepping: only the OUTERMOST group contributes a
    // single stop (its end). Nested parallels are absorbed by the outer one.
    if (!inParallel && animEndMs > startMs) ctx.parallelStops.push(animEndMs);
    if (action.id) ctx.timingById.set(action.id, { startMs, endMs: animEndMs });
    return { startMs, animEndMs, occupiedEndMs };
  }

  if (action.type === 'wait') {
    // Dead time: no clip emitted, we only occupy the time window
    // so the next step starts later. Clips kept by
    // previous steps (keep_until_next) stay visible during wait.
    const endMs = startMs + (action.duration ?? DEFAULT_DURATION.wait);
    if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
    return { startMs, animEndMs: endMs, occupiedEndMs: endMs };
  }

  // Clips emitted below (leaf action) all share this action's `inParallel`
  // flag: mark them in one place before returning rather than at each of the
  // scattered push sites (single source, no per-site drift).
  const pendingStart = ctx.pending.length;

  // An explicit `duration` always wins: it is the author's intent, and keeping
  // it ahead of the estimate is what makes the derivation safe to switch on for
  // specs that already exist.
  const isMove = action.type === 'move';
  // `from` / `to` are required by the type, but the compiler deliberately
  // tolerates an incomplete action (it warns and moves on), so they can be
  // missing here — reading them unguarded would turn a warning into a crash.
  const travelMs =
    isMove && action.duration == null && action.from && action.to
      ? derivedMoveDuration(
          moveDistance(
            ctx.layoutOf(),
            refNode(action.from),
            refNode(action.to)
          ) ?? 0,
          ctx.pace
        )
      : undefined;
  const duration =
    action.duration ??
    travelMs ??
    derivedDuration(action, ctx.pace) ??
    DEFAULT_DURATION[action.type];
  // A move is held at its origin before leaving and at its destination before
  // fading, which creates two rest instances: appearance and arrival. Both are
  // fractions of the trip they frame — see `motionTime.ts`.
  const animStartMs = startMs + (isMove ? appearHold(duration) : 0);
  const endMs = animStartMs + duration; // animation end (arrival)
  const occupiedEndMs = endMs + (isMove ? arriveHold(duration) : 0);
  const id = makeId(ctx, action);
  const keepNext =
    action.keep_until_next ?? DEFAULT_KEEP_NEXT[action.type] ?? false;

  const push = (clip: Clip) => {
    ctx.pending.push({
      clip,
      keepUntil: action.keep_until,
      keepNext,
      keepEnd: action.keep_until_end ?? false,
      stepIndex,
    });
    if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
  };

  // visibleUntilMs default = footprint end (includes arrival hold).
  const keepEnd = action.keep_until_end ?? false;
  const base = {
    id,
    startMs,
    animStartMs,
    endMs,
    visibleUntilMs: occupiedEndMs,
    stepIndex,
    keepEnd,
    fadeInMs: action.fade_in_ms,
    fadeOutMs: action.fade_out_ms,
  };

  switch (action.type) {
    case 'move': {
      if (!action.object || !action.from || !action.to) {
        ctx.warnings.push(`move "${id}": object/from/to required.`);
        break;
      }
      const clip: MoveClip = {
        ...base,
        kind: 'move',
        objectId: action.object,
        fromId: action.from,
        toId: action.to,
      };
      push(clip);
      break;
    }
    case 'arrow': {
      if (!action.from || !action.to) {
        ctx.warnings.push(`arrow "${id}": from/to required.`);
        break;
      }
      const clip: ArrowClip = {
        ...base,
        kind: 'arrow',
        fromId: action.from,
        toId: action.to,
        style: normalizeStyle(action.style),
        path: normalizePath(action.path),
        arrow_head: action.arrow_head,
        text: action.text,
      };
      push(clip);
      break;
    }
    case 'loading': {
      if (!action.object) {
        ctx.warnings.push(`loading "${id}": object required.`);
        break;
      }
      const clip: LoadingClip = {
        ...base,
        kind: 'loading',
        objectId: action.object,
      };
      push(clip);
      break;
    }
    case 'set_content': {
      if (!action.object || !action.content) {
        ctx.warnings.push(`set_content "${id}": object/content required.`);
        break;
      }
      const clip: SetContentClip = {
        ...base,
        kind: 'set_content',
        objectId: action.object,
        content: action.content,
      };
      push(clip);
      break;
    }
    case 'comment': {
      if (!action.text) {
        ctx.warnings.push(`comment "${id}": text requis.`);
        break;
      }
      const clip: CommentClip = {
        ...base,
        kind: 'comment',
        ...(action.object ? { nextToId: action.object } : {}),
        text: action.text,
      };
      push(clip);
      break;
    }
    case 'highlight': {
      if (!action.object) {
        ctx.warnings.push(`highlight "${id}": object required.`);
        break;
      }
      const clip: HighlightClip = {
        ...base,
        kind: 'highlight',
        targetId: action.object,
      };
      push(clip);
      break;
    }
    case 'set_visible': {
      if (!action.object) {
        ctx.warnings.push(`set_visible "${id}": object required.`);
        break;
      }
      const clip: SetVisibleClip = {
        ...base,
        kind: 'set_visible',
        objectId: action.object,
        visible: action.visible,
        // keepEnd forced to true: visibility state persists until the end of the
        // timeline so Stage can query the clip at any time.
        keepEnd: true,
      };
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    case 'set_color': {
      const hasColor =
        action.background_color != null ||
        action.border_color != null ||
        action.text_color != null ||
        action.color != null;
      if (!action.object || !hasColor) {
        ctx.warnings.push(
          `set_color "${id}": object and at least one color ` +
            `(background_color/border_color/text_color for a node, ` +
            `color for a connection) required.`
        );
        break;
      }
      const clip: SetColorClip = {
        ...base,
        kind: 'set_color',
        objectId: action.object,
        backgroundColor: action.background_color,
        borderColor: action.border_color,
        textColor: action.text_color,
        color: action.color,
        // keepEnd forced to true: like set_visible, the color persists until the
        // end of the timeline so Stage can read the node's color at any later
        // instant (the clip stays in `active`, latest one per node winning).
        keepEnd: true,
      };
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    case 'set_icon': {
      if (!action.object || action.icon == null) {
        ctx.warnings.push(`set_icon "${id}": object and icon required.`);
        break;
      }
      const clip: SetIconClip = {
        ...base,
        kind: 'set_icon',
        objectId: action.object,
        icon: action.icon,
        // keepEnd forced to true: like set_color, the badge value persists until
        // the end of the timeline so Stage can read a node's icon at any later
        // instant (the clip stays in `active`, latest one per node winning).
        keepEnd: true,
      };
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    case 'rotate': {
      const hasTo = typeof action.to === 'number';
      const hasSpin = typeof action.spin === 'number';
      if (!action.object || (!hasTo && !hasSpin)) {
        ctx.warnings.push(
          `rotate "${id}": object and to/spin (number) required.`
        );
        break;
      }
      if (hasTo && hasSpin) {
        ctx.warnings.push(
          `rotate "${id}": to and spin are mutually exclusive; spin wins.`
        );
      }
      const fromDeg = ctx.rotationById.get(action.object) ?? 0;
      // keepEnd forced to true on every rotate clip: the final angle persists
      // until the end of the timeline so Stage can read the node's rotation at
      // any later instant.
      if (hasSpin) {
        const degPerSec = action.spin as number;
        // Provisional sweep for the `duration` mode (animStart..endMs). For
        // keep_until / keep_until_end the real stop instant — and thus toDeg —
        // is only known in pass 2, once all durations are resolved.
        const sweep = (degPerSec * (endMs - animStartMs)) / 1000;
        const clip: RotateClip = {
          ...base,
          kind: 'rotate',
          objectId: action.object,
          fromDeg,
          toDeg: fromDeg + sweep,
          spin: true,
          keepEnd: true,
        };
        // Chaining is exact only when the spin stops at a known instant (the
        // `duration` mode). An open-ended spin (keep_until / keep_until_end)
        // leaves the running angle at its start; a later rotate resumes there.
        if (!action.keep_until && !action.keep_until_end) {
          ctx.rotationById.set(action.object, fromDeg + sweep);
        }
        ctx.pending.push({
          clip,
          keepUntil: action.keep_until,
          keepNext: false,
          keepEnd: action.keep_until_end ?? false,
          stepIndex,
          spinDegPerSec: degPerSec,
        });
        if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
        break;
      }
      const clip: RotateClip = {
        ...base,
        kind: 'rotate',
        objectId: action.object,
        fromDeg,
        toDeg: action.to as number,
        keepEnd: true,
      };
      // Update the running angle for chaining (next rotate on this node starts here).
      ctx.rotationById.set(action.object, action.to as number);
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    case 'rotate_subtree': {
      if (!ctx.tree) {
        ctx.warnings.push(
          `rotate_subtree "${id}": requires direction:'tree' with a tree block.`
        );
        break;
      }
      if (
        !action.object ||
        (action.rotation !== 'left' && action.rotation !== 'right')
      ) {
        ctx.warnings.push(
          `rotate_subtree "${id}": object and rotation ('left'|'right') required.`
        );
        break;
      }
      const fromLayout = ctx.tree.layout;
      const ok = rotateSubtree(ctx.tree.state, action.object, action.rotation);
      if (!ok) {
        const missing = action.rotation === 'left' ? 'right' : 'left';
        ctx.warnings.push(
          `rotate_subtree "${id}": node "${action.object}" has no ${missing} child to rotate ${action.rotation}.`
        );
        break;
      }
      const toLayout = treeLayout(ctx.tree.nodeIds, ctx.tree.state);
      ctx.tree.layout = toLayout;
      const clip: ReflowClip = {
        ...base,
        kind: 'reflow',
        fromLayout,
        toLayout,
        edges: treeEdges(ctx.tree.state),
        // keepEnd forced true: the reached layout/edges persist until the end so
        // Stage can resolve the tree's placement at any later instant.
        keepEnd: true,
      };
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    case 'flow': {
      const route = action.route ?? [];
      if (route.length < 2) {
        ctx.warnings.push(
          `flow "${id}": route must list at least two node/pin references.`
        );
        break;
      }
      const clip: FlowClip = {
        ...base,
        kind: 'flow',
        route,
        reverse: action.reverse ?? false,
        loop: action.loop ?? true,
        // ~one charge per segment, at least two, so a lap always reads.
        count: Math.max(2, action.count ?? route.length - 1),
        color: action.color,
      };
      push(clip);
      break;
    }
    case 'toggle': {
      if (!action.object || typeof action.closed !== 'boolean') {
        ctx.warnings.push(
          `toggle "${id}": object and closed (boolean) required.`
        );
        break;
      }
      const clip: ToggleClip = {
        ...base,
        kind: 'toggle',
        objectId: action.object,
        closed: action.closed,
        // keepEnd forced true: like set_visible/set_color, the reached contact
        // state persists to the end so Stage can read it at any later instant.
        keepEnd: true,
      };
      ctx.pending.push({
        clip,
        keepUntil: undefined,
        keepNext: false,
        keepEnd: true,
        stepIndex,
      });
      if (action.id) ctx.timingById.set(action.id, { startMs, endMs });
      break;
    }
    default: {
      throw new Error(
        `Unrecognized action type: "${(action as Record<string, unknown>).type}"`
      );
    }
  }

  if (inParallel) {
    for (let i = pendingStart; i < ctx.pending.length; i++) {
      ctx.pending[i].inParallel = true;
    }
  }

  return { startMs, animEndMs: endMs, occupiedEndMs };
}

export function compile(spec: DataFlowSpec): CompileResult {
  const treeCtx =
    spec.direction === 'tree' && spec.tree
      ? (() => {
          const state = cloneTree(spec.tree);
          const nodeIds = spec.nodes.map((n) => n.id);
          return { state, nodeIds, layout: treeLayout(nodeIds, state) };
        })()
      : undefined;
  const ctx: Ctx = {
    pending: [],
    timingById: new Map(),
    warnings: [],
    counter: 0,
    parallelStops: [],
    rotationById: new Map(
      spec.nodes
        .filter((n) => typeof n.rotation === 'number')
        .map((n) => [n.id, n.rotation as number])
    ),
    tree: treeCtx,
    pace: spec.pace ?? 1,
    referenceLayout: null,
    layoutOf: () => {
      // In `tree` mode the topology is restructured as the timeline plays, so
      // the layout the compiler already keeps is the one to measure against.
      ctx.referenceLayout ??=
        treeCtx?.layout ?? computeLayout(spec, { aspect: REFERENCE_ASPECT });
      return ctx.referenceLayout;
    },
  };

  const steps: Step[] = [];
  let cursor = 0;

  // Each root action = one logical step. A short pause (STEP_GAP) separates
  // steps: the "Next" stop thus shows the "settled" step alone, without
  // overlapping the next one's appearance.
  const lastIndex = spec.timeline.length - 1;
  spec.timeline.forEach((action, index) => {
    const stepStart = cursor;
    // stepStart passed as minStartMs: wait_for can only delay the root action,
    // never start it before the beginning of its step.
    const { occupiedEndMs } = compileAction(
      action,
      stepStart,
      index,
      ctx,
      stepStart
    );
    const stepEnd = Math.max(cursor, occupiedEndMs);
    steps.push({
      index,
      startMs: stepStart,
      endMs: stepEnd,
      actionId: action.id,
    });
    cursor = stepEnd + (index < lastIndex ? STEP_GAP : 0);
  });

  // Total duration: end of last step, extended if a clip overflows (wait_for).
  let durationMs = cursor;
  for (const { clip } of ctx.pending) {
    durationMs = Math.max(durationMs, clip.endMs, clip.visibleUntilMs);
  }
  if (steps.length > 0) steps[steps.length - 1].endMs = durationMs;

  // Start of next "content" step after `stepIndex`: the steps
  // `wait` (dead times without clip) are skipped so keep_until_next holds
  // the content DURING the wait rather than leaving an empty screen.
  const nextContentStepStart = (stepIndex: number): number => {
    let i = stepIndex + 1;
    while (i < steps.length && spec.timeline[i]?.type === 'wait') i++;
    return steps[i]?.startMs ?? durationMs;
  };

  // Pass 2: lifecycle resolution (visibleUntilMs).
  for (const {
    clip,
    keepUntil,
    keepNext,
    keepEnd,
    stepIndex,
    spinDegPerSec,
  } of ctx.pending) {
    if (spinDegPerSec !== undefined && clip.kind === 'rotate') {
      // Spin: resolve the instant the rotation STOPS (its animation end), then
      // the final angle. The node never disappears, so it stays visible until
      // the end of the timeline, holding that final angle.
      let stopMs = clip.endMs; // `duration` mode: already animStartMs + duration
      if (keepUntil) {
        const ref = ctx.timingById.get(keepUntil);
        if (ref) stopMs = ref.startMs;
        else ctx.warnings.push(`keep_until: action "${keepUntil}" not found.`);
      } else if (keepEnd) {
        stopMs = durationMs;
      }
      if (stopMs < clip.animStartMs) stopMs = clip.animStartMs;
      clip.endMs = stopMs;
      clip.toDeg =
        clip.fromDeg + (spinDegPerSec * (stopMs - clip.animStartMs)) / 1000;
      clip.visibleUntilMs = durationMs;
      continue;
    }
    if (keepUntil) {
      const ref = ctx.timingById.get(keepUntil);
      if (ref) clip.visibleUntilMs = ref.startMs;
      else ctx.warnings.push(`keep_until: action "${keepUntil}" not found.`);
    } else if (keepEnd) {
      // Visible until timeline end.
      clip.visibleUntilMs = durationMs;
    } else if (keepNext) {
      // Visible until the START of the next content step (through the
      // inter-step pause and any `wait` dead times).
      clip.visibleUntilMs = nextContentStepStart(stepIndex);
    }
    // else: visibleUntilMs remains = footprint end (disappears after its hold).
  }

  // Stop points: a move stops at appearance (animStart) AND at arrival
  // (end); other clips stop once "settled" (end). Clips emitted inside a
  // `parallel` are skipped — the group is atomic for stepping and contributes
  // a single stop (its end) via `ctx.parallelStops`.
  const stopSet = new Set<number>();
  for (const { clip, inParallel } of ctx.pending) {
    if (inParallel) continue;
    if (clip.kind === 'move') stopSet.add(clip.animStartMs);
    stopSet.add(clip.endMs);
  }
  for (const stop of ctx.parallelStops) stopSet.add(stop);
  // NB: `Array.from` rather than `[...stopSet]`. Docusaurus Babel in mode
  // "loose" transpiles iterable spread to `[].concat(iterable)`,
  // which does NOT flatten a Set and produces an empty array after filter.
  const stops = Array.from(stopSet)
    .filter((s) => s > 0 && s <= durationMs)
    .sort((a, b) => a - b);

  const sortedClips = ctx.pending
    .map((p) => p.clip)
    .sort((a, b) => a.startMs - b.startMs);

  // Pass 3: pre-calculation of active clips per step for O(K) rendering
  for (let i = 0; i < steps.length; i++) {
    const stepStart = steps[i].startMs;
    const stepNext = i < steps.length - 1 ? steps[i + 1].startMs : durationMs;
    steps[i].activeClips = sortedClips.filter(
      (clip) => clip.startMs <= stepNext && clip.visibleUntilMs >= stepStart
    );
  }

  const timeline: Timeline = {
    clips: sortedClips,
    steps,
    stops,
    durationMs,
  };
  return { timeline, warnings: ctx.warnings };
}
