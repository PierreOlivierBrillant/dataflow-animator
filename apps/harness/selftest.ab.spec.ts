import { test, expect } from '@playwright/test';
import { RISK_DEMOS } from './riskDemos';
import { diffPngBuffers } from './pixelDiff';
import { waitForAbReady } from './waitForAbReady';
import { appendAbResult } from './abResults';

/**
 * Measurement-floor calibration for the vanilla renderer.
 *
 * There is no React panel to compare against any more — that renderer is gone
 * and its proof is in the git history. What this gate does, and why it matters
 * more than the comparison ever did, is prove the
 * MEASUREMENT itself has zero noise floor: if two independent mounts of the same
 * renderer disagreed by a pixel, no visual gate built on it could be trusted.
 * Two independent questions, both required to be exactly 0.00%:
 *
 *  - successive capture: screenshot the SAME vanilla panel twice in a row — a
 *    non-zero diff would mean residual animation, unsettled fonts, or a
 *    ResizeObserver pass still in flight.
 *  - cross-mount: screenshot two INDEPENDENT vanilla mounts of the identical
 *    spec at the identical `t` — a non-zero diff would mean DOM measurement is
 *    nondeterministic across mounts.
 *
 * The final table is printed by `globalTeardown.ts`, not from here — see
 * `abResults.ts` for why. See docs/AI-VALIDATION.md for how this sits beside the
 * mount-vs-update gate and the reference grid.
 */

const THEMES = ['light', 'dark'] as const;

/**
 * Two configurations. `stage` samples the midpoint; `chrome` sweeps the probe
 * grid, because composing the stage with a sibling control bar changes the
 * stage's height and therefore its measurement schedule — a race that would be
 * instant-dependent, so a single instant would not find it.
 */
const CONFIGS = [
  { name: 'stage', query: '', pcts: [0.5] },
  { name: 'chrome', query: '&chrome=1', pcts: [0, 0.25, 0.5, 0.75, 1] },
] as const;

for (const config of CONFIGS) {
  for (const demo of RISK_DEMOS) {
    for (const pct of config.pcts) {
      for (const theme of THEMES) {
        const suffix =
          config.name === 'stage'
            ? `${demo} · ${theme}`
            : `${demo} · ${Math.round(pct * 100)}% · ${theme} · chrome`;
        test(`self-test — ${suffix}`, async ({ page }) => {
          await page.goto(
            `/?ab=1&demo=${demo}&mode=${theme}&probePct=${pct}${config.query}`
          );
          await waitForAbReady(page);

          const panelA = page.locator('[data-ab-panel="a"] .rdfa-player');
          const panelB = page.locator('[data-ab-panel="b"] .rdfa-player');
          // `t` is frozen and the spec is static, but a CSS `loading` spinner
          // (native @keyframes, driven by the browser's wall clock rather than
          // React's `t`) would still drift between two successive captures.
          // `animations: 'disabled'` snaps it to a fixed state first — the same
          // mechanism `expect(page).toHaveScreenshot()` applies by default in
          // harness.visual.spec.ts, applied here to the raw `.screenshot()` call.
          const shot = { animations: 'disabled' as const };

          const a1 = await panelA.screenshot(shot);
          const a2 = await panelA.screenshot(shot);
          const successive = diffPngBuffers(a1, a2);
          appendAbResult('selftest', {
            label: `${suffix} · successive`,
            ratio: successive.ratio,
          });
          expect(
            successive.ratio,
            `successive-capture drift on ${suffix}`
          ).toBe(0);

          const b1 = await panelB.screenshot(shot);
          const crossMount = diffPngBuffers(a1, b1);
          appendAbResult('selftest', {
            label: `${suffix} · cross-mount`,
            ratio: crossMount.ratio,
          });
          expect(crossMount.ratio, `cross-mount drift on ${suffix}`).toBe(0);
        });
      }
    }
  }
}
