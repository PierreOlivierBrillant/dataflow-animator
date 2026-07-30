import { test, expect } from '@playwright/test';
import { RISK_DEMOS } from './riskDemos';
import { diffPngBuffers } from './pixelDiff';
import { waitForAbReady } from './waitForAbReady';
import { appendAbResult } from './abResults';

/**
 * `<dataflow-player>` vs `mountPlayer` — the custom element adds no pixel.
 *
 * `@dataflow-animator/element` is a wrapper with no rendering of its own: its
 * `connectedCallback` calls `mountPlayer(this, spec, options)` and the element
 * itself is the container. So the assertion is not "close enough", it is
 * **exactly 0.0000%**, and the self-test proves that floor is achievable (two
 * independent mounts of the same renderer are already pixel-identical).
 *
 * What a failure would mean, in order of likelihood:
 *
 *  - the element's own box is interfering — an unstyled custom element is
 *    `display: inline`, which is why it sets `display: contents` on itself;
 *  - an attribute is not landing as the option it claims to be, which is what the
 *    per-case sweep below is for: each case moves ONE thing, so the failing cell
 *    names the attribute;
 *  - the element mounted at a different instant, i.e. `initial-t` was read as a
 *    seek rather than as an opening position.
 *
 * Readiness is exact rather than timed: the element mounts on a microtask, so
 * panel B flips `__AB__.ready` from its own `dataflow-player:mounted` listener
 * (see `main.tsx`). The `toBeVisible` checks below are the second, independent
 * guard — a cell must never be able to compare an empty box and report it as a
 * rendering difference.
 *
 * The final table is printed by `globalTeardown.ts`. See docs/AI-VALIDATION.md.
 */

const THEMES = ['light', 'dark'] as const;

/**
 * Two sweeps, answering two different questions.
 *
 * `frames` walks the probe grid on every risk demo: does the element reproduce
 * the renderer across the whole timeline, mid-crossfade instants included?
 * `options` stays on one demo and moves one attribute at a time: does the
 * attribute→option mapping hold? Without the second, the gate would only prove
 * the element calls `mountPlayer` with the DEFAULTS.
 */
const SWEEPS = [
  {
    name: 'frames',
    demos: RISK_DEMOS,
    cases: ['default'] as const,
    pcts: [0, 0.25, 0.5, 0.75, 1],
  },
  {
    name: 'options',
    demos: ['spa'] as const,
    cases: [
      'no-controls',
      'compact',
      'spacious',
      'blueprint',
      'exportable',
    ] as const,
    pcts: [0.5],
  },
] as const;

for (const sweep of SWEEPS) {
  for (const demo of sweep.demos) {
    for (const wcCase of sweep.cases) {
      for (const pct of sweep.pcts) {
        for (const theme of THEMES) {
          const label =
            sweep.name === 'frames'
              ? `${demo} · ${Math.round(pct * 100)}% · ${theme}`
              : `${demo} · ${wcCase} · ${theme}`;
          test(`element — ${label}`, async ({ page }) => {
            await page.goto(
              `/?wc=1&demo=${demo}&mode=${theme}&probePct=${pct}&case=${wcCase}`
            );
            await waitForAbReady(page);

            const panelA = page.locator('[data-ab-panel="a"] .rdfa-player');
            const panelB = page.locator('[data-ab-panel="b"] .rdfa-player');
            await expect(panelA).toBeVisible();
            await expect(panelB).toBeVisible();

            // `animations: 'disabled'` for the same reason as the self-test: a
            // `loading` spinner is a native CSS @keyframes driven by the
            // browser's wall clock, so it would drift between two captures even
            // with `t` frozen.
            const shot = { animations: 'disabled' as const };
            const a = await panelA.screenshot(shot);
            const b = await panelB.screenshot(shot);
            const diff = diffPngBuffers(a, b);

            appendAbResult('element', { label, ratio: diff.ratio });
            expect(
              diff.ratio,
              `<dataflow-player> differs from mountPlayer on ${label}`
            ).toBe(0);
          });
        }
      }
    }
  }
}
