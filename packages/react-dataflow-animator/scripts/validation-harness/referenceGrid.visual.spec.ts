import { test, expect } from '@playwright/test';
import { RISK_DEMOS } from './riskDemos';

/**
 * The reference grid — a NON-REGRESSION gate for the vanilla renderer.
 *
 * What it proves: that a future change to `@dataflow-animator/core/dom`
 * has not moved a pixel of the rendered output. Each golden is a contact sheet:
 * one frozen frame of the vanilla stage at every `timeline.stops[]`, so a single
 * image covers every settled instant of a demo.
 *
 * What it does NOT prove — and this matters, because it replaces the old A/B
 * gate: it is no longer a comparison against the React renderer. That renderer
 * is gone (step 2.6b), and the proof that the two agreed to the pixel lives in
 * the git history (200/200 A/B cells at 0.0000%), not in these images. This gate
 * pins the vanilla renderer against its own past, nothing more.
 *
 * FRAGILE by nature: the goldens depend on the machine's font rendering and the
 * Chrome version (`channel: 'chrome'`). Regenerate in the target environment:
 *   npm run test:visual -- --update-snapshots
 * `maxDiffPixelRatio: 0.02` (playwright.config.ts) absorbs anti-aliasing dust.
 * NOT wired into CI — that would need a pinned rendering environment we do not
 * have here; it stays a local/manual gate, as it was before this step.
 */

const THEMES = ['light', 'dark'] as const;

for (const demo of RISK_DEMOS) {
  for (const mode of THEMES) {
    test(`reference grid — ${demo} · ${mode}`, async ({ page }) => {
      await page.goto(`/?demo=${demo}&mode=${mode}&theme=default`);

      // The contact sheet is mounted (vanilla stages, one per stop)...
      await page.waitForSelector('.filmstrip .frame .rdfa-stage');
      // ...and the engine has published its series (proof that compile() ran).
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              !!(window as unknown as { __VALIDATION__?: unknown })
                .__VALIDATION__
          )
        )
        .toBe(true);

      // Stable DOM measurement: the retained renderer's settle loop and the font
      // refit of a set_content finish across a couple of frames after mount; we
      // wait for the fonts then a short stabilization before freezing the image.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      // The live probe loops (rAF) → non-deterministic image: excluded from the
      // golden (it is a diagnostic, not a regression target).
      await page.evaluate(() =>
        document.querySelector('.probe-section')?.remove()
      );

      await expect(page).toHaveScreenshot(`${demo}-${mode}.png`, {
        fullPage: true,
      });
    });
  }
}
