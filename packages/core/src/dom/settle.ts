/**
 * The convergence loop that stands in for React's render/measure fixed point.
 *
 * `Stage` + `useStageGeometry` form the iteration `Gₙ₊₁ = measure(render(Gₙ))`,
 * terminated by `sameGeometry` returning the previous object identity — React
 * then bails out of re-rendering, so nothing re-measures. `mountStage` is
 * a single imperative call, so it has to run that iteration itself and, above
 * all, know when to stop.
 *
 * The subtlety worth stating plainly: React's iteration is BUDGETED, not
 * unbounded. `useStageGeometry`'s layout effect performs one synchronous
 * `measure()` plus three more across `requestAnimationFrame` callbacks, and for a
 * non-circuit diagram nothing else ever calls `measure` again (`Stage`'s
 * letterbox and pin-nudge effects are both guarded and inert when
 * `frameAspect === 0`). A plain left-to-right demo therefore performs exactly
 * four measurements and then renders whatever it has — converged or not.
 *
 * That is why `maxPasses` is a faithfulness parameter rather than a safety
 * valve. If React stops at four, a vanilla renderer that kept iterating to the
 * true fixed point would legitimately draw something ELSE, and the pixel gate
 * would be right to fail it. Matching the picture means matching the budget.
 */

export interface SettleOptions<M> {
  /** React's `useState` seeds, so the ITERATE SEQUENCE matches, not just its limit. */
  initial: M;
  /**
   * One synchronous measurement pass. Must not mutate the DOM.
   *
   * Receives the previous metrics because measurement is not purely a function
   * of the DOM: React's `measure()` only publishes a new stage size/aspect when
   * the stage rect is non-degenerate, so a zero-sized stage CARRIES FORWARD the
   * previous values rather than resetting them to zero.
   */
  measure: (previous: M) => M;
  /** The `sameGeometry` bailout: true stops the loop. */
  same: (a: M, b: M) => boolean;
  /** Writes the new metrics back into the DOM (React's re-render). */
  apply: (metrics: M) => void;
  /** Measurement budget — see the note above. */
  maxPasses: number;
}

export interface SettleResult<M> {
  metrics: M;
  /**
   * Measurements actually performed. Exposed as a diagnostic: a run that
   * reaches `maxPasses` without ever hitting the `same` bailout has NOT
   * converged, which means the budget — rather than the geometry — decided the
   * picture. That is a condition to investigate, not to paper over by raising
   * the cap.
   */
  passes: number;
  /** True when the loop ended on the `same` bailout rather than on the budget. */
  converged: boolean;
}

export function settle<M>(options: SettleOptions<M>): SettleResult<M> {
  const { initial, measure, same, apply, maxPasses } = options;
  let metrics = initial;
  let passes = 0;
  let converged = false;

  while (passes < maxPasses) {
    const next = measure(metrics);
    passes++;
    if (same(metrics, next)) {
      converged = true;
      break;
    }
    metrics = next;
    apply(metrics);
  }

  return { metrics, passes, converged };
}
