/**
 * Perf baseline: average cost of a player frame under real rAF-driven playback
 * (autoPlay + loop), over ~300 frames, on `circuit` (heavy: dense orthogonal
 * routing) and `clientServer` (average).
 *
 * Since step 2.6b removed the React renderer, this measures the vanilla renderer
 * (`--renderer vanilla`, the default) or the published `DataFlowPlayer`
 * (`--renderer wrapper`). The frozen `bench-baseline.json` keeps the step-2.1
 * React figure purely as a HISTORICAL reference; it is never regenerated.
 *
 * Frame timing comes from wall-clock gaps between successive
 * `requestAnimationFrame` callbacks (the real cadence a user experiences);
 * the CDP `Performance` domain additionally breaks that cost down by phase
 * (script / style / layout) over the same window, sourced from Chrome
 * DevTools Protocol rather than reimplemented.
 *
 *   node scripts/bench-perf.mjs                      # vanilla
 *   node scripts/bench-perf.mjs --renderer wrapper   # published component
 */
import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    demo: { type: 'string' },
    frames: { type: 'string', default: '300' },
    port: { type: 'string', default: '5197' },
    out: { type: 'string' },
    renderer: { type: 'string', default: 'vanilla' },
  },
});

const DEMOS = values.demo ? [values.demo] : ['circuit', 'clientServer'];
// One renderer per run. These figures are machine-dependent, so a comparison is
// only meaningful within a single run on one machine — run `vanilla` and
// `wrapper` back to back on the same box to read the wrapper's own per-frame
// cost. See docs/AI-VALIDATION.md.
const RENDERERS = [values.renderer === 'wrapper' ? 'wrapper' : 'vanilla'];
const FRAMES = Number(values.frames);

// The harness's own vite.config.ts reads PORT from the environment (see
// scripts/validation-harness/vite.config.ts) — reusing that logic here
// avoids a second, potentially-diverging port-selection implementation.
// `strictPort` in the config file only applies to server.port when set, so
// we force it via override to fail loudly on a collision rather than
// silently reusing a stranger's server (the documented port-5199 trap,
// applied here to whatever port THIS run picks).
process.env.PORT = values.port;

console.log(`Starting harness on port ${values.port}...`);
const server = await createServer({
  configFile: join(__dirname, 'validation-harness/vite.config.ts'),
  server: { strictPort: true },
});
await server.listen();
const baseUrl = `http://localhost:${values.port}`;

const browser = await chromium.launch({ channel: 'chrome' });
/** @type {Record<string, unknown>} */
const results = {};

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function metricDelta(before, after, name) {
  const b = before.metrics.find((m) => m.name === name)?.value ?? 0;
  const a = after.metrics.find((m) => m.name === name)?.value ?? 0;
  return (a - b) * 1000; // CDP reports seconds
}

try {
  for (const renderer of RENDERERS) {
  for (const demo of DEMOS) {
    console.log(`Benchmarking ${demo} — ${renderer} (${FRAMES} frames)...`);
    const page = await browser.newPage();
    await page.goto(
      `${baseUrl}/?bench=1&demo=${demo}&frames=${FRAMES}&renderer=${renderer}`
    );
    await page.evaluate(() => document.fonts.ready);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const before = await cdp.send('Performance.getMetrics');

    await page.waitForFunction(
      () => (window /** @type {any} */).__BENCH__?.done === true,
      undefined,
      { timeout: 30_000 }
    );

    const after = await cdp.send('Performance.getMetrics');
    const bench = await page.evaluate(
      () => (window /** @type {any} */).__BENCH__
    );

    const sorted = [...bench.samples].sort((a, b) => a - b);
    const mean =
      bench.samples.reduce((s, v) => s + v, 0) / bench.samples.length;

    results[`${renderer}/${demo}`] = {
      frames: bench.samples.length,
      frameMs: {
        mean: Number(mean.toFixed(3)),
        median: Number(percentile(sorted, 0.5).toFixed(3)),
        p95: Number(percentile(sorted, 0.95).toFixed(3)),
        min: Number(sorted[0].toFixed(3)),
        max: Number(sorted[sorted.length - 1].toFixed(3)),
      },
      cdp: {
        scriptDurationMs: Number(
          metricDelta(before, after, 'ScriptDuration').toFixed(2)
        ),
        layoutDurationMs: Number(
          metricDelta(before, after, 'LayoutDuration').toFixed(2)
        ),
        recalcStyleDurationMs: Number(
          metricDelta(before, after, 'RecalcStyleDuration').toFixed(2)
        ),
        taskDurationMs: Number(
          metricDelta(before, after, 'TaskDuration').toFixed(2)
        ),
      },
    };

    await page.close();
  }
  }
} finally {
  await browser.close();
  await server.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  renderer: RENDERERS.join('+'),
  framesRequested: FRAMES,
  demos: results,
};

// Never bench-baseline.json: that file is the frozen step-2.1 React reference,
// kept for history only. `vanilla` and `wrapper` runs each write their own file.
const defaultOut =
  values.renderer === 'wrapper'
    ? 'validation-harness/bench-wrapper.json'
    : 'validation-harness/bench-vanilla.json';
const outPath = values.out ?? join(__dirname, defaultOut);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `\nPer-frame cost — ${RENDERERS.join(' vs ')} (${FRAMES} frames/demo)\n`
);
for (const [demo, r] of Object.entries(results)) {
  console.log(
    `${demo.padEnd(14)} mean ${r.frameMs.mean}ms  median ${r.frameMs.median}ms  ` +
      `p95 ${r.frameMs.p95}ms  script ${r.cdp.scriptDurationMs}ms  ` +
      `layout ${r.cdp.layoutDurationMs}ms  style ${r.cdp.recalcStyleDurationMs}ms`
  );
}
console.log(`\nSaved to ${outPath}`);
