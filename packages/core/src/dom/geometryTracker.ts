import type { GeometryMap, NodeGeom } from '../engine/geometry';
import { PASTILLE_INSET } from './stageConstants';

/**
 * Framework-free DOM measurement — the port of
 * `packages/react/src/hooks/useStageGeometry.ts`.
 *
 * Measures the actual position of the nodes (`getBoundingClientRect`) relative
 * to the stage, and can keep it up to date via a `ResizeObserver` (on the stage
 * AND on each node, so a node that GROWS — e.g. `set_content` — is caught).
 *
 * SSR-safe: nothing here touches the DOM until a method is called.
 */

export interface StageMetrics {
  geometry: GeometryMap;
  /** Width/height ratio of the stage. */
  aspect: number;
  /** Measured dimensions of the stage (px). */
  width: number;
  height: number;
}

export interface GeometryTracker {
  /**
   * One synchronous measurement pass. Never mutates the DOM.
   *
   * `previous` supplies the carry-forward values for a degenerate (hidden,
   * zero-sized) stage — see the guard below.
   */
  measure(previous: StageMetrics): StageMetrics;
  /** Opt-in: re-measure on resize. Separate from `measure` so a caller that
   *  only needs one reading never installs an observer. */
  observe(onChange: () => void): void;
  disconnect(): void;
}

/**
 * The seeds React's `useState` calls start from. Starting the vanilla loop from
 * the same values makes the ITERATE SEQUENCE match, not merely its limit —
 * cheap insurance against any path dependence in `computePlacements`' clamp.
 *
 * Never mutated: `measure` always returns a freshly built object.
 */
export const INITIAL_METRICS: StageMetrics = {
  geometry: {},
  aspect: 1.6,
  width: 0,
  height: 0,
};

/**
 * Equality of two geometry maps. Allows a measurement pass to NOT publish a new
 * state when nothing has moved: essential so that a re-measurement triggered by
 * a change in placements converges instead of looping.
 *
 * This is LOAD-BEARING, not an optimisation. In React it works by returning the
 * previous object identity, which makes React bail out of re-rendering, which is
 * what stops the cascade. The vanilla loop has no such built-in bailout, so the
 * check IS the termination condition.
 */
export function sameGeometry(a: GeometryMap, b: GeometryMap): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const id of ka) {
    const x = a[id];
    const y = b[id];
    if (!y) return false;
    if (
      x.x !== y.x ||
      x.y !== y.y ||
      x.width !== y.width ||
      x.height !== y.height ||
      x.labelH !== y.labelH ||
      x.labelW !== y.labelW ||
      x.borderOutset !== y.borderOutset ||
      x.scale !== y.scale
    )
      return false;
  }
  return true;
}

/**
 * Whole-state equality, i.e. "would React have re-rendered?".
 *
 * Wider than {@link sameGeometry} on purpose: React re-renders when `setAspect`
 * or `setSize` changes even if the geometry map is identical, and that extra
 * iteration is real — it happens on the very first pass, when the stage goes
 * from its 0×0 seed to its measured size.
 */
export function sameMetrics(a: StageMetrics, b: StageMetrics): boolean {
  return (
    a.aspect === b.aspect &&
    a.width === b.width &&
    a.height === b.height &&
    sameGeometry(a.geometry, b.geometry)
  );
}

export function createGeometryTracker(stage: HTMLElement): GeometryTracker {
  let ro: ResizeObserver | undefined;

  const measure = (previous: StageMetrics): StageMetrics => {
    const sr = stage.getBoundingClientRect();
    let { aspect, width, height } = previous;
    // A zero-sized (hidden) stage publishes no size — the previous values are
    // carried forward. Node measurement still proceeds.
    if (sr.width > 0 && sr.height > 0) {
      aspect = sr.width / sr.height;
      width = sr.width;
      height = sr.height;
    }

    // Stage scale (--rdfa-scale), inherent to all nodes: read only once on the
    // stage. Used to scale the arrow↔node gap and the pill overhang (both
    // expressed at scale 1 in the geometry).
    const scale =
      parseFloat(getComputedStyle(stage).getPropertyValue('--rdfa-scale')) || 1;

    const geometry: GeometryMap = {};
    stage.querySelectorAll<HTMLElement>('[data-node-id]').forEach((el) => {
      const id = el.getAttribute('data-node-id');
      if (!id) return;
      // We measure the visual (icon / content panel), not the label below, so
      // that the connections point to the center of the element.
      const target = el.querySelector<HTMLElement>('.rdfa-node-visual') ?? el;
      const r = target.getBoundingClientRect();
      const node: NodeGeom = {
        id,
        x: r.left - sr.left + r.width / 2,
        y: r.top - sr.top + r.height / 2,
        width: r.width,
        height: r.height,
        scale,
      };
      // Measures the text label (under the visual) for arrow routing.
      const labelEl = el.querySelector<HTMLElement>('.rdfa-node-label');
      if (labelEl) {
        const lr = labelEl.getBoundingClientRect();
        node.labelH = lr.height;
        node.labelW = lr.width;
      }
      // Tinted pictogram: the pill (`background_color`) overhangs the measured
      // glyph. Arrows snap to this colored outline → we expose the overhang, at
      // the current scale, as `borderOutset`. DOM measurement cannot see it: it
      // is a `::before` pseudo-element, out of flow.
      if (
        el.classList.contains('rdfa-node--tinted') &&
        el.querySelector('.rdfa-node-icon')
      ) {
        node.borderOutset = PASTILLE_INSET * scale;
      }
      geometry[id] = node;
    });

    return { geometry, aspect, width, height };
  };

  return {
    measure,

    observe(onChange: () => void) {
      if (typeof ResizeObserver === 'undefined') return;
      ro ??= new ResizeObserver(() => onChange());
      // Observing the stage alone is not enough: a node can grow without the
      // stage changing size.
      ro.observe(stage);
      stage
        .querySelectorAll<HTMLElement>('[data-node-id]')
        .forEach((el) => ro?.observe(el));
      // NOTE — no MutationObserver, unlike the React hook. During playback
      // `set_visible` does add and remove nodes at runtime, but the mount loop
      // re-observes the node set on every reconciliation, so this tracker never
      // has to watch for it — and an observer here would create a re-entrancy
      // hazard against our own DOM writes. Deliberately driven, not observed.
    },

    disconnect() {
      ro?.disconnect();
      ro = undefined;
    },
  };
}
