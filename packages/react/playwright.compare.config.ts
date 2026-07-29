import { defineConfig } from '@playwright/test';

// Dedicated config for the A/B pixel-diff tools (compare.ab.spec.ts,
// selftest.ab.spec.ts — see docs/AI-VALIDATION.md). Deliberately separate
// from playwright.config.ts (test:visual's goldens):
//
//  - its own port, distinct from the interactive harness's default 5199, so
//    running `npm run harness:compare` never collides with (or silently
//    reuses) a developer's already-running `npm run harness` session — the
//    documented port-5199-reuse trap;
//  - `reuseExistingServer: false` unconditionally (not just in CI): this is a
//    structural gate, not an interactive review workflow, so it must always
//    boot against a known-fresh server instead of whatever happened to
//    already be listening on that port.
const PORT = 5198;

export default defineConfig({
  testDir: './scripts/validation-harness',
  testMatch: '**/*.ab.spec.ts',
  // Playwright restarts the worker after each failure, resetting in-memory
  // module state — so a run with several failing cells would lose most of its
  // results. globalSetup/globalTeardown run once in the main process
  // regardless, which is what the on-disk result accumulator (abResults.ts)
  // relies on to print a single final table covering the whole grid.
  globalSetup: './scripts/validation-harness/globalSetup.ts',
  globalTeardown: './scripts/validation-harness/globalTeardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'npm run harness',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
