import type { LineStyle, ObjectContent, PathShape } from '../types';
import type { LayoutMap } from './layout';

/**
 * Deterministic intermediate representation (IR) of the timeline.
 *
 * The compiler (`compiler.ts`) transforms `spec.actions` into `Timeline`.
 * The runtime boils down to a PURE function `evaluate(timeline, t)`: no
 * dependency on the DOM, real-time, or any animation library. The player
 * merely advances `t` (via requestAnimationFrame) and re-renders.
 */

export type ClipKind =
  | 'move'
  | 'arrow'
  | 'loading'
  | 'set_content'
  | 'comment'
  | 'highlight'
  | 'set_visible'
  | 'set_color'
  | 'set_icon'
  | 'rotate'
  | 'reflow'
  | 'flow'
  | 'toggle';

interface ClipBase {
  /** Unique clip identifier (= action id if provided, otherwise generated). */
  id: string;
  kind: ClipKind;
  /** Instant (ms) when the element appears (mounted/visible). */
  startMs: number;
  /** Start of ANIMATION (>= startMs). Before: maintained at initial state. */
  animStartMs: number;
  /** End of animation, in ms (the element is "placed"). */
  endMs: number;
  /** Instant (ms) until which the element remains mounted/visible (>= endMs). */
  visibleUntilMs: number;
  /** Index of the root step this clip belongs to. */
  stepIndex: number;
  /** True if the source action had keep_until_end: removes the exit fade. */
  keepEnd?: boolean;
  /** Fade-in duration (ms). Absent = default behavior. */
  fadeInMs?: number;
  /** Fade-out duration (ms). Absent = default behavior (250 ms). */
  fadeOutMs?: number;
}

export interface MoveClip extends ClipBase {
  kind: 'move';
  /** ID of the moved dynamic object (packet, request...). */
  objectId: string;
  fromId: string;
  toId: string;
}

export interface ArrowClip extends ClipBase {
  kind: 'arrow';
  fromId: string;
  toId: string;
  style: LineStyle;
  path: PathShape;
  arrow_head?: 'forward' | 'backward' | 'both' | 'none';
  text?: string;
}

export interface LoadingClip extends ClipBase {
  kind: 'loading';
  /** Target static node ID. */
  objectId: string;
}

export interface SetContentClip extends ClipBase {
  kind: 'set_content';
  /** Mutated static node ID. */
  objectId: string;
  content: ObjectContent;
}

export interface CommentClip extends ClipBase {
  kind: 'comment';
  /** Reference static node ID. Absent = omniscient comment (top of stage). */
  nextToId?: string;
  text: string;
}

export interface HighlightClip extends ClipBase {
  kind: 'highlight';
  /** ID of the static node OR connection to highlight. */
  targetId: string;
}

export interface SetVisibleClip extends ClipBase {
  kind: 'set_visible';
  /** ID of the static node whose visibility changes. */
  objectId: string;
  /** true = the node appears, false = the node disappears. */
  visible: boolean;
}

export interface SetColorClip extends ClipBase {
  kind: 'set_color';
  /** Mutated static node OR connection ID. */
  objectId: string;
  /** New background color (predefined name or hex), if this clip changes it. */
  backgroundColor?: string;
  /** New border/stroke color, if this clip changes it. */
  borderColor?: string;
  /** New text color, if this clip changes it. */
  textColor?: string;
  /** New connection line color, if this clip recolors a connection. */
  color?: string;
}

export interface SetIconClip extends ClipBase {
  kind: 'set_icon';
  /** ID of the node whose corner icon badge changes. */
  objectId: string;
  /** New badge value (tech / icon name or short free text; '' clears it). */
  icon: string;
}

export interface RotateClip extends ClipBase {
  kind: 'rotate';
  /** ID of the rotated static node. */
  objectId: string;
  /** Angle (deg) before this clip — interpolation start. */
  fromDeg: number;
  /** Absolute target angle (deg). For a spin, the angle reached when it stops. */
  toDeg: number;
  /**
   * Continuous spin: the angle interpolates LINEARLY (constant speed, no easing)
   * over [animStartMs, endMs]. Absent/false = a single eased rotation toward
   * `toDeg`.
   */
  spin?: boolean;
}

export interface FlowClip extends ClipBase {
  kind: 'flow';
  /** Ordered wire path (node / `node:pin` refs) the charges ride. */
  route: string[];
  /** Travel reversed (−→+ electron flow instead of +→− conventional). */
  reverse: boolean;
  /** Charges wrap around the route continuously (vs a single pass). */
  loop: boolean;
  /** Number of charge dots spread along the route. */
  count: number;
  /** Charge color (predefined name or hex); undefined = theme accent. */
  color?: string;
}

export interface ToggleClip extends ClipBase {
  kind: 'toggle';
  /** ID of the switch / push_button being actuated. */
  objectId: string;
  /** Target contact state: true = closed, false = open. */
  closed: boolean;
}

export interface ReflowClip extends ClipBase {
  kind: 'reflow';
  /** Node placements (ratios) BEFORE this rotation — interpolation start. */
  fromLayout: LayoutMap;
  /** Node placements (ratios) AFTER this rotation — interpolation end. */
  toLayout: LayoutMap;
  /** Parent→child edges of the tree AFTER this rotation (drawn while active). */
  edges: Array<[string, string]>;
}

export type Clip =
  | MoveClip
  | ArrowClip
  | LoadingClip
  | SetContentClip
  | CommentClip
  | HighlightClip
  | SetVisibleClip
  | SetColorClip
  | SetIconClip
  | RotateClip
  | ReflowClip
  | FlowClip
  | ToggleClip;

export interface Step {
  index: number;
  startMs: number;
  /** End of the step (= start of the next one, or total duration). */
  endMs: number;
  /** Root action ID, if provided. */
  actionId?: string;
  /** Subset of clips active during this step (pre-computed for optimization). */
  activeClips?: Clip[];
}

export interface Timeline {
  clips: Clip[];
  steps: Step[];
  /**
   * Stop points (ms) for navigation and timeline markers. A
   * `move` produces two: on appearance and on arrival; other actions
   * only one ("placed" state).
   */
  stops: number[];
  durationMs: number;
}

export interface ActiveClip {
  clip: Clip;
  /** Animation progress in [0, 1] (1 if finished but maintained). */
  progress: number;
  /** True if the animation is in progress (animStartMs <= t < endMs). */
  animating: boolean;
}

export const EMPTY_TIMELINE: Timeline = {
  clips: [],
  steps: [],
  stops: [],
  durationMs: 0,
};

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Default fade in/out duration (ms). Lives here rather than beside the renderer
 * because the COMPILER needs it too: an element's appearance phase is part of
 * its schedule, not just of how it is painted.
 */
export const FADE_MS = 250;

/** Cubic "ease-in-out" easing, for less mechanical movements. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Runtime core: for a given instant `tMs`, returns visible clips with their
 * progression. Pure and deterministic function (backwards scrubbing is free).
 */
export function evaluate(timeline: Timeline, tMs: number): ActiveClip[] {
  // Optimization O(K): if active clips were pre-computed per step
  if (timeline.steps.length > 0) {
    const stepIdx = stepIndexAt(timeline, tMs);
    const step = timeline.steps[stepIdx];
    if (step && step.activeClips) {
      return evaluateSubset(step.activeClips, tMs);
    }
  }

  const active: ActiveClip[] = [];

  // Fallback O(log N + K): binary search to find the last started clip
  let low = 0;
  let high = timeline.clips.length - 1;
  let maxIdx = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (timeline.clips[mid].startMs <= tMs) {
      maxIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  for (let i = 0; i <= maxIdx; i++) {
    const clip = timeline.clips[i];
    // INCLUSIVE upper bound: an element remains visible at the exact instant of
    // its disappearance (end of step), so the "Next" stop shows the step.
    if (tMs > clip.visibleUntilMs) continue; // already disappeared
    // Progression runs over [animStartMs, endMs]: before, the element is
    // maintained at initial state (progress 0); after, at final state (progress 1).
    const duration = clip.endMs - clip.animStartMs;
    const progress =
      duration <= 0 ? 1 : clamp((tMs - clip.animStartMs) / duration, 0, 1);
    active.push({
      clip,
      progress,
      animating: tMs >= clip.animStartMs && tMs < clip.endMs,
    });
  }
  return active;
}

function evaluateSubset(clips: Clip[], tMs: number): ActiveClip[] {
  const active: ActiveClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (tMs < clip.startMs || tMs > clip.visibleUntilMs) continue;
    const duration = clip.endMs - clip.animStartMs;
    const progress =
      duration <= 0 ? 1 : clamp((tMs - clip.animStartMs) / duration, 0, 1);
    active.push({
      clip,
      progress,
      animating: tMs >= clip.animStartMs && tMs < clip.endMs,
    });
  }
  return active;
}

/** Index of the step containing `tMs` (the last step with start <= t). */
export function stepIndexAt(timeline: Timeline, tMs: number): number {
  const { steps } = timeline;
  let low = 0;
  let high = steps.length - 1;
  let idx = 0;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (tMs >= steps[mid].startMs) {
      idx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return idx;
}

const STOP_TOLERANCE = 1; // ms

/** Next stop point strictly after `tMs` (otherwise the end). */
export function nextStop(timeline: Timeline, tMs: number): number {
  for (const stop of timeline.stops) {
    if (stop > tMs + STOP_TOLERANCE) return stop;
  }
  return timeline.durationMs;
}

/** Previous stop point strictly before `tMs` (otherwise the start). */
export function prevStop(timeline: Timeline, tMs: number): number {
  let previous = 0;
  for (const stop of timeline.stops) {
    if (stop < tMs - STOP_TOLERANCE) previous = stop;
    else break;
  }
  return previous;
}
