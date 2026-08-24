import { defineConfig } from '@playwright/test';

// Visual regression of the contact sheet (cf. docs/AI-VALIDATION.md).
// The rendering being deterministic (`evaluate(timeline, t)`), the goldens are
// stable — no clock-related flakiness. We reuse the system Chrome
// (`channel: 'chrome'`) so as not to download Chromium.
//
// NB: the goldens depend on the machine's font rendering. Regenerate them in
// the target environment (`npm run test:visual -- --update-snapshots`) or run
// CI in Playwright's official Docker image.
//
// TOLERANCES — an ABSOLUTE budget, not a ratio, and a TIGHT per-pixel
// threshold. Both numbers are measured, not guessed (2026-08-24, this machine):
//
//   * `maxDiffPixels: 100` — the run-to-run noise floor is 0 differing pixels
//     across all 12 goldens, measured twice; only exact per-pixel equality
//     (`threshold: 0`) surfaces any jitter at all, and just 41 px at worst
//     (collision). A budget of 100 is 100x that floor and still ~8x BELOW the
//     smallest real change measured (827 px — one packet's text edited).
//     It replaces `maxDiffPixelRatio: 0.02`, which absorbed nothing measurable
//     and let real content changes through: 0.02 of these sheets is 28k px
//     (collision) to 112k px (microservices), so six edited demo strings
//     (1171 px) passed the gate in BOTH themes.
//     A ratio is also the wrong shape here — the noise does not scale with
//     image area, but the goldens span 1.42 to 5.62 Mpx, so one ratio meant
//     4x more slack for the tallest sheet than for the shortest.
//
//   * `threshold: 0.05` (per-pixel, default 0.2) — this is what makes the
//     LIGHT theme see. Its surfaces sit close to the scene background, so a
//     changed block yields many LOW-AMPLITUDE pixel deltas that 0.2 discards;
//     the dark theme flips whole opaque areas instead. Same spa content edit,
//     same images: 5713 px caught in light at 0.2 vs 16306 px at 0.05, which
//     turns light from the blinder half into the more sensitive one. The noise
//     floor stays at 0 px here (measured twice).
export default defineConfig({
  testDir: './scripts/validation-harness',
  testMatch: '**/*.visual.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'line',
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100, threshold: 0.05 },
  },
  use: {
    baseURL: 'http://localhost:5199',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run harness',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
