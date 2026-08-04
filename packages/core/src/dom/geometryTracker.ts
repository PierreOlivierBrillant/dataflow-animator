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
  /**
   * The targets the `ResizeObserver` currently holds. Internal introspection —
   * deliberately absent from the package barrel — so a suite can assert that a
   * node the reconciliation removed is no longer RETAINED, which is not
   * otherwise observable from the outside.
   */
  readonly observed: ReadonlySet<Element>;
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

/**
 * Ratio between a RENDERED length (`getBoundingClientRect`, which every ancestor
 * `transform: scale(...)` multiplies) and the LAYOUT length of the same box
 * (`offsetWidth`/`offsetHeight`, which no transform touches).
 *
 * 1 when either is unavailable — an unlaid-out stage (SSR, jsdom) or a
 * zero-sized one — so the measurement degrades to the raw reading.
 */
function scaleFactor(rendered: number, layout: number): number {
  if (!(rendered > 0) || !(layout > 0)) return 1;
  // `offsetWidth` is rounded to the whole pixel while the rect is fractional,
  // so any gap up to a pixel is that rounding and nothing else. Dividing by it
  // would spread a sub-pixel error over an untransformed stage — every reading
  // off by ~0.05% — to correct a scale that isn't there. Past a pixel, it is.
  if (Math.abs(rendered - layout) <= 1) return 1;
  return rendered / layout;
}

export function createGeometryTracker(stage: HTMLElement): GeometryTracker {
  let ro: ResizeObserver | undefined;
  /**
   * Exactly the targets `ro` holds. A `ResizeObserver` keeps a STRONG reference
   * to every target until it is unobserved, so without this set each node the
   * reconciliation removes — every `set_visible` hide→show builds a fresh
   * element rather than recycling the old one — would stay alive, detached,
   * until `disconnect()`.
   */
  const observed = new Set<Element>();

  const measure = (previous: StageMetrics): StageMetrics => {
    const sr = stage.getBoundingClientRect();
    // An ancestor `transform: scale(...)` — a modal opening animation, a zoomed
    // container — multiplies every rect read below, and a `ResizeObserver`
    // NEVER fires on it: it reports the untransformed border box, so a scale
    // that starts at 0.96 and settles at 1 is invisible to it. Measuring under
    // one would freeze a shrunken geometry into the overlay layers for the rest
    // of the mount, while the nodes themselves stay placed in layout pixels —
    // arrows falling short of their nodes by exactly that factor. Dividing by
    // the cumulative scale brings every reading back into LAYOUT pixels, the
    // one space the whole pipeline already agrees on (`offsetWidth` in
    // `commentElement`, `clientWidth` in `contentElement`, CSS percentages for
    // node placement).
    const kx = scaleFactor(sr.width, stage.offsetWidth);
    const ky = scaleFactor(sr.height, stage.offsetHeight);
    let { aspect, width, height } = previous;
    // A zero-sized (hidden) stage publishes no size — the previous values are
    // carried forward. Node measurement still proceeds.
    if (sr.width > 0 && sr.height > 0) {
      width = sr.width / kx;
      height = sr.height / ky;
      aspect = width / height;
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
        x: (r.left - sr.left + r.width / 2) / kx,
        y: (r.top - sr.top + r.height / 2) / ky,
        width: r.width / kx,
        height: r.height / ky,
        scale,
      };
      // Measures the text label (under the visual) for arrow routing.
      const labelEl = el.querySelector<HTMLElement>('.rdfa-node-label');
      if (labelEl) {
        const lr = labelEl.getBoundingClientRect();
        node.labelH = lr.height / ky;
        node.labelW = lr.width / kx;
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
      const observer = (ro ??= new ResizeObserver(() => onChange()));
      // Observing the stage alone is not enough: a node can grow without the
      // stage changing size.
      const current = new Set<Element>([stage]);
      stage
        .querySelectorAll<HTMLElement>('[data-node-id]')
        .forEach((el) => current.add(el));

      // The observed set is a function of the CURRENT tree, so a call is a
      // full re-synchronisation rather than an append. Dropping first keeps the
      // observer from holding a detached element for the rest of the mount.
      // `unobserve` never notifies, and the `observe` calls below are the very
      // ones this method has always made — so no callback exists here that did
      // not before, and nothing can cascade into `onChange`.
      for (const el of observed) {
        if (!current.has(el)) {
          observer.unobserve(el);
          observed.delete(el);
        }
      }
      for (const el of current) {
        observer.observe(el);
        observed.add(el);
      }
      // NOTE — no MutationObserver, unlike the React hook. During playback
      // `set_visible` does add and remove nodes at runtime, but the mount loop
      // re-observes the node set on every reconciliation, so this tracker never
      // has to watch for it — and an observer here would create a re-entrancy
      // hazard against our own DOM writes. Deliberately driven, not observed.
    },

    disconnect() {
      ro?.disconnect();
      ro = undefined;
      observed.clear();
    },

    get observed(): ReadonlySet<Element> {
      return observed;
    },
  };
}
