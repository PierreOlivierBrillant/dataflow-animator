import { test, expect } from '@playwright/test';
import { RISK_DEMOS } from './riskDemos';
import { diffPngBuffers } from './pixelDiff';
import { waitForAbReady } from './waitForAbReady';
import { appendAbResult } from './abResults';

/**
 * Mount-vs-update gate: the retained renderer against ITSELF — and, since step
 * 2.6b removed the React renderer, the PRIMARY structural gate.
 *
 * Panel A is `mountStage(spec, t)`. Panel B is mounted at the start of
 * the timeline and walked to the same `t` through a fixed set of checkpoints
 * with `update()`. If retained mode is sound, the two are the same rendering; if
 * `update()` leaves anything behind — a stale style declaration, a head polygon
 * that should have gone, an element in the wrong document position — they are
 * not.
 *
 * WHY IT IS EXACT AND ENVIRONMENT-INDEPENDENT. Both panels render live, in the
 * same run, and the verdict is a normalised `outerHTML` comparison — not a
 * screenshot. It asserts an internal invariant of the renderer (retained mode ==
 * remount), so it depends on no font, no browser version, and no external
 * reference. It is the only gate that exercises `update()` at all.
 *
 * WHY THE PATH IS CUMULATIVE. A single jump from 0 to `t` would only show that
 * one transition lands correctly. Drift in a retained renderer accumulates over
 * a SEQUENCE of frames, so panel B walks 0 → 25% → 50% → 75% → t, applying every
 * intermediate state before the one under test.
 *
 * WHY THE DOM, NOT THE PIXELS. A normalised `outerHTML` comparison refutes the
 * invariant the instant the two states differ, and says where; a pixel diff only
 * notices once the drift is large enough to move a pixel. The DOM verdict is
 * therefore what this gate asserts, with the pixel ratio recorded beside it as a
 * corroborating signal. See `core/src/dom/normalizeHtml.ts` for exactly what is
 * normalised away (attribute order, declaration order, float precision) and what
 * is not (structure, order, classes, text).
 *
 * NO RATCHET. This gate is born green and there is nothing to ratchet down from.
 * The one class of cell it does not assert on is `midCrossfade`, and that is not
 * a tolerance: it is a documented path dependence of the reference renderer,
 * detected from the spec rather than listed by hand — see the flag's definition
 * in main.tsx.
 */

const THEMES = ['light', 'dark'] as const;

/**
 * The probe grid, plus one instant that is not on the quarter grid.
 *
 * A quarter grid samples where the timeline happens to be at 0/25/50/75/100%,
 * which is fine for a demo whose interesting states are spread evenly — but an
 * ANIMATED TRANSITION only occupies its own window, and a short one falls
 * between two quarters. `avlTree`'s `rotate_subtree` compiles to a reflow
 * running 40450→42150ms of a 45550ms timeline, i.e. 88.8%→92.5%: the grid steps
 * from 75% straight over it to 100%, so every sample sees a SETTLED layout and
 * the interpolation between the two placements is never rendered at all.
 *
 * 0.9 lands 545ms into that 1700ms window. It matters here specifically: this
 * gate compares a fresh mount at `t` against a mount walked to `t`, and the walk
 * (…→75%→90%) enters the reflow through a single `update()` that must land
 * mid-flight. That is the one thing that actually exercises reflow
 * interpolation in retained mode — a settled instant would be reproduced by an
 * `update()` that ignored the interpolation entirely.
 *
 * The instant was falsified rather than assumed, by reading the rendered node
 * centres out of panel A across the window: at 88.8% and at 92.5% the layout is
 * exactly the pre- and post-rotation one, while at 90% all five moving nodes sit
 * 13.2% along their travel (4.2px for `20`, up to 16.8px for `70`) — a placement
 * reachable by neither endpoint. Move this value and check that still holds;
 * a probe that coincides with a settled layout asserts nothing.
 *
 * Only this gate gets the extra instant. The self-test and element gates
 * compare two renderings PRODUCED THE SAME WAY, so a mid-reflow sample there
 * would re-ask a question this gate already answers exactly (its panel A is a
 * fresh mount at mid-reflow, so a nondeterministic one would show up here).
 */
const PROBE_PCTS = [0, 0.25, 0.5, 0.75, 0.9, 1] as const;

for (const demo of RISK_DEMOS) {
  for (const pct of PROBE_PCTS) {
    for (const theme of THEMES) {
      const label = `${demo} · ${Math.round(pct * 100)}% · ${theme}`;
      test(`mount-vs-update — ${label}`, async ({ page }) => {
        await page.goto(`/?mu=1&demo=${demo}&mode=${theme}&probePct=${pct}`);
        await waitForAbReady(page);

        const midCrossfade = await page.evaluate(
          () =>
            (window as unknown as { __AB__: { midCrossfade?: boolean } }).__AB__
              .midCrossfade === true
        );

        const result = await page.evaluate(() =>
          (
            window as unknown as {
              __MU__: {
                compare(): {
                  ok: boolean;
                  reason?: string;
                  index?: number;
                  a?: string;
                  b?: string;
                };
              };
            }
          ).__MU__.compare()
        );

        // Same freeze as the other gates: a wall-clock CSS animation (the
        // `loading` spinner) would otherwise make two captures differ for
        // reasons that have nothing to do with the renderer.
        const shot = { animations: 'disabled' as const };
        const a = await page
          .locator('[data-ab-panel="a"] .rdfa-player')
          .screenshot(shot);
        const b = await page
          .locator('[data-ab-panel="b"] .rdfa-player')
          .screenshot(shot);
        const { ratio } = diffPngBuffers(a, b);

        appendAbResult('mountupdate', {
          label,
          ratio,
          htmlEqual: result.ok,
          note: midCrossfade
            ? 'set_content mid-crossfade (see spec header)'
            : '',
        });

        if (midCrossfade) {
          test.info().annotations.push({
            type: 'path-dependence',
            description:
              'set_content mid-crossfade: iconGeomByNode is captured once and ' +
              'never rewritten, faithfully to React, so a fresh mount and a ' +
              'walked mount anchor the icon→panel morph differently.',
          });
          return;
        }

        expect(
          result.reason,
          `${label}: the two panels' stages could not both be read`
        ).not.toBe('missing-stage');

        expect(
          result.ok,
          `${label}: update() did not converge to a fresh mount.\n` +
            `First divergence at offset ${result.index}:\n` +
            `  fresh   … ${result.a}\n` +
            `  updated … ${result.b}`
        ).toBe(true);
      });
    }
  }
}
