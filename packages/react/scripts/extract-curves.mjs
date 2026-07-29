/**
 * STRUCTURAL fluidity pass, headless and without browser.
 *
 * Since the engine is pure (`evaluate(timeline, t)`), we don't need to render
 * pixels to detect fluidity defects that are decided at compile time:
 * an instantaneous `set_content` transition, a fade that is too short, two contents
 * overlapping on the same node. This is the fast signal (CI, pre-commit);
 * the REAL shape of the crossfade (linear vs eased) and the re-layout are seen in
 * the Vite harness, which renders the real DOM. See docs/AI-VALIDATION.md.
 *
 * We ONLY use the public API (`compile`, `evaluate` from the built dist)
 * to not reimplement anything from the engine. `clipOpacity`/easing are not public:
 * their curve lives in the harness, not here.
 *
 *   node scripts/extract-curves.mjs --demo spa
 *   node scripts/extract-curves.mjs --demo spa --json > out/spa.json
 */
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    demo: { type: 'string', default: 'spa' },
    locale: { type: 'string', default: 'en' },
    json: { type: 'boolean', default: false },
  },
});

const distUrl = new URL('../dist/index.js', import.meta.url);
let compile;
try {
  ({ compile } = await import(distUrl.href));
} catch {
  console.error(
    `Unable to load the dist (${distUrl.pathname}).\n` +
      `Build the lib first: npm run build:lib`
  );
  process.exit(1);
}

// Demo modules are resolved the same way `getSpec` (used by the Vite harness,
// scripts/validation-harness/main.tsx) does: a demo export may be a plain
// DataFlowSpec, or a localized builder `(locale) => DataFlowSpec`. We import
// the leaf demo file directly (rather than the `demos.ts` barrel) because
// plain `node` — unlike Vite's bundler resolution — cannot resolve the
// barrel's extension-less relative imports (`./demos/signalr`); the leaf
// files only carry `import type`, which is erased and needs no resolution.
const demoUrl = new URL(
  `../../../apps/docs/src/site-content/demos/${values.demo}.ts`,
  import.meta.url
);
let spec;
try {
  const mod = await import(demoUrl.href);
  const exported = mod[values.demo] ?? mod.default;
  spec = typeof exported === 'function' ? exported(values.locale) : exported;
} catch (err) {
  console.error(`Demo not found: ${values.demo} (${demoUrl.pathname})`);
  console.error(String(err?.message ?? err));
  process.exit(1);
}
if (!spec) {
  console.error(`Demo module has no usable export: ${values.demo} (${demoUrl.pathname})`);
  process.exit(1);
}

const { timeline } = compile(spec);

const setContent = timeline.clips.filter((c) => c.kind === 'set_content');

// We ONLY flag what can be derived without knowing `clipOpacity`:
//  - overlaps of two contents on the same node (flickering);
//  - EXPLICIT fades cut short (0ms) or very short, chosen by the author.
// The DEFAULT fade duration (internal FADE_MS) is not visible here: if the
// spec doesn't fix fadeInMs/fadeOutMs, it's up to the Vite harness to show the
// real curve. So we invent no fade numbers on the headless side.
const findings = [];
const seenByNode = new Map();

for (const clip of setContent) {
  const flags = [];
  const prev = seenByNode.get(clip.objectId);
  if (prev && clip.startMs < prev.visibleUntilMs) flags.push('chevauchement-meme-noeud');
  seenByNode.set(clip.objectId, clip);

  if (clip.fadeInMs === 0) flags.push('fondu-entree-coupe');
  if (clip.fadeOutMs === 0) flags.push('fondu-sortie-coupe');
  if ((clip.fadeInMs ?? Infinity) > 0 && (clip.fadeInMs ?? Infinity) < 120)
    flags.push('fondu-entree-court');
  if ((clip.fadeOutMs ?? Infinity) > 0 && (clip.fadeOutMs ?? Infinity) < 120)
    flags.push('fondu-sortie-court');

  findings.push({
    objectId: clip.objectId,
    window: [Math.round(clip.startMs), Math.round(clip.visibleUntilMs)],
    holdMs: Math.round(clip.visibleUntilMs - clip.startMs),
    fadeInMs: clip.fadeInMs ?? 'default',
    fadeOutMs: clip.fadeOutMs ?? 'default',
    flags,
  });
}

const report = {
  demo: values.demo,
  durationMs: Math.round(timeline.durationMs),
  stops: timeline.stops.length,
  setContentCount: setContent.length,
  findings,
};

if (values.json) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  console.log(
    `\n${report.demo} — ${report.durationMs}ms, ${report.stops} stops, ` +
      `${report.setContentCount} set_content\n`
  );
  if (findings.length === 0) console.log('  (no set_content)');
  for (const f of findings) {
    const tag = f.flags.length ? `  ⚠ ${f.flags.join(', ')}` : '  ✓';
    console.log(
      `${tag}  ${f.objectId}  window ${f.window[0]}–${f.window[1]}ms · ` +
        `hold ${f.holdMs}ms · fade-in ${f.fadeInMs} · fade-out ${f.fadeOutMs}`
    );
  }
  const flagged = findings.filter((f) => f.flags.length).length;
  console.log(
    `\n${flagged ? `${flagged} clip(s) with risky explicit fade.` : 'Nothing to report structurally — crossfade fluidity is judged in the harness.'}\n`
  );
}
