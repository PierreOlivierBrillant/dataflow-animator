/**
 * Visual validation harness — not a published component.
 *
 * Two channels, both deterministic (the engine is `evaluate(timeline, t)`):
 *
 *  - CLARITY → a "contact sheet": a frozen vanilla stage at each
 *    `timeline.stops[]`. A vision AI judges at a glance overlaps, readability,
 *    out-of-bounds, across the whole scenario. Real DOM measurement → we also
 *    see the re-layout of a `set_content` (font refit, ResizeObserver), not
 *    just the "intended" movement.
 *
 *  - FLUIDITY → the curve of the value-over-time. Fluidity is NOT in
 *    a frame: it's a property of the derivative. For each `set_content`, we
 *    plot the REALLY rendered opacity (`contentCrossfade`, which also drives the
 *    geometry lerp) against the old linear crossfade (`clipOpacity` raw) as a
 *    reference. The rendered curve is now an S of `easeInOutCubic` — slowed down
 *    start and arrival; the displayed jerk quantifies the gain compared to
 *    linear.
 *
 * Everything mounts the core's `mountStage` / `mountPlayer` and
 * reads the TRUE engine functions (`compile`, `contentCrossfade`, `clipOpacity`)
 * from the core: a single source of truth, no duplication to manually resync.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { compile } from '@dataflow-animator/core/engine/compiler';
import {
  evaluate,
  type Clip,
  type SetContentClip,
  type Timeline,
} from '@dataflow-animator/core/engine/timeline';
import {
  clipOpacity,
  contentCrossfade,
} from '@dataflow-animator/core/render/clipOpacity';
import { mountStage } from '@dataflow-animator/core/dom/mount';
import {
  mountPlayer,
  type PlayerOptions,
} from '@dataflow-animator/core/dom/player';
import {
  firstDifference,
  normalizeStageHtml,
} from '@dataflow-animator/core/dom/normalizeHtml';
import { DataFlowPlayer } from '../../src/DataFlowPlayer';
// The custom element, by relative path into its source — the same way this file
// already reaches `../../src/DataFlowPlayer` and the site's demos. Importing the
// barrel is what REGISTERS `<dataflow-player>`, so the `?wc=1` mode below needs
// nothing else.
import {
  MOUNTED_EVENT,
  type DataFlowPlayerElement,
} from '../../../element/src/index';
import type { DataFlowSpec, PlayerTheme } from '../../src/types';
import {
  demosById,
  getSpec,
} from '../../../../apps/docs/src/site-content/demos';
import '@dataflow-animator/core/styles/dataflow.css';
import './harness.css';

const params = new URLSearchParams(window.location.search);
const demoId = params.get('demo') ?? 'spa';
// `mode` = light/dark, `theme` = palette — same two axes as the player props.
const mode = params.get('mode') === 'dark' ? 'dark' : 'light';
const THEMES = [
  'default',
  'dots',
  'blueprint',
  'pcb',
  'chalk',
  'terminal',
  'paper',
  'neon',
] as const satisfies readonly PlayerTheme[];
const isTheme = (v: string | null): v is PlayerTheme =>
  (THEMES as readonly string[]).includes(v ?? '');
const themeParam = params.get('theme');
const theme: PlayerTheme = isTheme(themeParam) ? themeParam : 'default';
const locale = params.get('locale') === 'fr' ? 'fr' : 'en';

// demosById maps id → Demo (gallery metadata). `Demo.spec` may be a localized
// BUILDER `(locale) => DataFlowSpec`, so we resolve it through `getSpec` rather
// than passing the raw function to `compile` (which expects a DataFlowSpec).
const catalog = demosById;
const demo = catalog[demoId];
const spec: DataFlowSpec | undefined = demo ? getSpec(demo, locale) : undefined;

// ─── Self-test mode (?ab=1) ────────────────────────────────────────────────
// Two INDEPENDENT mounts of the vanilla renderer, side by side at a frozen `t`.
// Calibrates the measurement floor: two independent mounts must be pixel-
// identical. See docs/AI-VALIDATION.md and selftest.ab.spec.ts.
const isAB = params.has('ab');
// Mount-vs-update mode (?mu=1). Panel A is mounted fresh at `t`, panel B is
// mounted at the start of the timeline and walked to `t` with `update()`. It
// proves retained mode does not drift, on the live DOM, so it is exact and
// environment-independent. See mountUpdate.ab.spec.ts.
const isMU = params.has('mu');
// Web-component mode (?wc=1). Panel A calls `mountPlayer` directly, panel B
// places a `<dataflow-player>` carrying the equivalent attributes. The custom
// element does nothing but call `mountPlayer`, so it has no licence to move a
// pixel — this is the gate that keeps that true. See element.ab.spec.ts.
const isWC = params.has('wc');
// `?chrome=1` widens the comparison from the stage alone to the WHOLE player:
// control bar included. The diff target is already
// `[data-ab-panel="x"] .rdfa-player`, so the chrome enters without changing the
// selector.
const isChrome = params.has('chrome');

/**
 * Resolves the single frozen instant the A/B page renders at, in priority
 * order: an explicit `?probeT=<ms>`, an explicit `?probePct=<0..1>` (fraction
 * of the compiled timeline duration — lets the compare grid ask for "25%"
 * without first having to look up each demo's duration), or the midpoint of
 * the timeline as a representative, non-trivial default frame.
 */
function resolveFrozenT(durationMs: number): number {
  const probeTParam = params.get('probeT');
  if (probeTParam != null) return Number(probeTParam);
  const probePctParam = params.get('probePct');
  if (probePctParam != null) {
    const pct = Math.min(1, Math.max(0, Number(probePctParam)));
    return durationMs * pct;
  }
  return durationMs * 0.5;
}

// ─── Perf bench mode (?bench=1) ────────────────────────────────────────────
// A minimal page — one player, no filmstrip/curves chrome — autoPlay + loop, so
// the measured cadence is the real player's. See scripts/bench-perf.mjs and
// docs/AI-VALIDATION.md.
const isBench = params.has('bench');
const benchFrames = Number(params.get('frames') ?? '300');
const BENCH_PANEL = { width: 640, height: 420 };
// Which renderer the bench drives. `vanilla` is the core's `mountPlayer`;
// `wrapper` is the published `DataFlowPlayer` — the same renderer plus whatever
// the React wrapper costs per frame (expected: nothing, since the wrapper
// renders nothing once mounted). The React renderer was removed at step 2.6b.
const benchRenderer =
  params.get('renderer') === 'wrapper' ? 'wrapper' : 'vanilla';

/**
 * The passive rAF sampler, shared by both bench renderers.
 *
 * It only records the wall-clock gap between frames; the renderer's own loop is
 * what advances `t`. Both callbacks land in the same animation-frame batch, so
 * the gap still reflects the real per-frame cost.
 */
function useBenchSampler(): void {
  useEffect(() => {
    const samples: number[] = [];
    let last: number | null = null;
    let raf = 0;
    const sample = (now: number) => {
      if (last != null) samples.push(now - last);
      last = now;
      if (samples.length >= benchFrames) {
        (window as unknown as { __BENCH__: unknown }).__BENCH__ = {
          demo: demoId,
          renderer: benchRenderer,
          frames: samples.length,
          samples,
          done: true,
        };
        return;
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/**
 * The published component under the same protocol as `VanillaBenchApp`.
 *
 * Identical panel, identical options — it IS `VanillaBenchApp` with
 * `<DataFlowPlayer>` in place of the imperative mount, which is exactly the
 * delta being measured.
 */
function WrapperBenchApp() {
  useBenchSampler();
  if (!spec) return null;
  return (
    <DataFlowPlayer
      spec={spec}
      height={BENCH_PANEL.height}
      width={BENCH_PANEL.width}
      controls={false}
      autoPlay
      loop
      theme={theme}
      mode={mode}
    />
  );
}

/** The vanilla player under the same protocol as `BenchApp`: autoplay + loop. */
function VanillaBenchApp() {
  const slotRef = useRef<HTMLDivElement | null>(null);
  useBenchSampler();
  useEffect(() => {
    const container = slotRef.current;
    if (!container || !spec) return;
    const player = mountPlayer(container, spec, {
      height: BENCH_PANEL.height,
      width: BENCH_PANEL.width,
      // No chrome, so the measurement compares the RENDERER against the React
      // bench's bare `Stage`, not two different amounts of furniture.
      controls: false,
      autoPlay: true,
      loop: true,
      theme,
      mode,
    });
    return () => player.destroy();
  }, []);
  if (!spec) return <div className="harness-error">Unknown demo: {demoId}</div>;
  return <div ref={slotRef} />;
}

const AB_PANEL = { width: 480, height: 320 };

/**
 * Mounts the framework-agnostic renderer inside a flex slot sized like
 * `.rdfa-stage`.
 *
 * `path` is what the mount-vs-update gate drives: the renderer is mounted at
 * `path[0]` and then walked through the remaining instants with `update()`, so
 * the panel ends up at the same `t` a fresh mount would have been given — but
 * having got there the way playback actually gets there. Omitted (or a single
 * entry), it is a plain frozen-`t` mount, which is what the A/B gate uses.
 */
function VanillaPanel({
  spec,
  t,
  path,
}: {
  spec: DataFlowSpec;
  t: number;
  path?: readonly number[];
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const walk = path && path.length > 0 ? path : [t];
  // The array identity would change on every render and re-run the effect;
  // its CONTENT is what matters.
  const walkKey = walk.join(',');
  useEffect(() => {
    const container = slotRef.current;
    if (!container) return;
    const steps = walkKey.split(',').map(Number);
    const handle = mountStage(container, spec, steps[0]);
    for (let i = 1; i < steps.length; i++) handle.update(steps[i]);
    // The convergence diagnostic, republished for scripts to read. `converged:
    // false` means the measurement BUDGET stopped the loop rather than the
    // geometry settling — see core/src/dom/settle.ts for why that matters.
    const w = window as unknown as { __AB__?: Record<string, unknown> };
    if (w.__AB__) {
      w.__AB__.passes = handle.passes;
      w.__AB__.converged = handle.converged;
    }
    return () => handle.destroy();
  }, [spec, walkKey]);
  // `display:flex` is NOT cosmetic. Panel A puts `.rdfa-stage` directly under
  // `.rdfa-player` (itself `display:flex; flex-direction:column`), and the stage
  // gets ALL its height from `flex: 1 1 auto` — every one of its children is
  // absolutely positioned, so its content height is 0. This wrapper adds one
  // nesting level; left as a plain block it would not be a flex container, the
  // stage's `flex` would be ignored, and panel B's stage would compute to height
  // 0 — `measure()` would never see a size and the root would stay
  // `visibility:hidden`. Every cell would then fail for a reason having nothing
  // to do with the renderer.
  return (
    <div
      ref={slotRef}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
}

function ABPanel({
  label,
  panelId,
  children,
  bare,
}: {
  label: string;
  panelId: 'a' | 'b';
  children: ReactNode;
  /** The child renders its OWN `.rdfa-player` — `mountPlayer` does. */
  bare?: boolean;
}) {
  return (
    <section className="ab-panel" data-ab-panel={panelId}>
      <h2>{label}</h2>
      {bare ? (
        children
      ) : (
        <div
          className="rdfa-player"
          data-theme={theme}
          data-mode={mode}
          style={{ width: AB_PANEL.width, height: AB_PANEL.height }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/** Mounts the framework-agnostic PLAYER — stage plus chrome — paused at `t`. */
function VanillaPlayerPanel({ spec, t }: { spec: DataFlowSpec; t: number }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = slotRef.current;
    if (!container) return;
    const player = mountPlayer(container, spec, {
      height: AB_PANEL.height,
      width: AB_PANEL.width,
      theme,
      mode,
      controls: true,
      autoPlay: false,
      // Opens AT `t` rather than at 0 and seeking: the icon→panel anchor is
      // captured on the first measurement, so where the player opens is part of
      // what it renders.
      initialT: t,
    });
    return () => player.destroy();
  }, [spec, t]);
  return <div ref={slotRef} />;
}

function ABApp() {
  if (!spec) {
    return (
      <div className="harness-error">
        Unknown demo: <code>{demoId}</code>. Available demos:{' '}
        {Object.keys(catalog).sort().join(', ')}
      </div>
    );
  }
  const { timeline } = compile(spec);
  const t = resolveFrozenT(timeline.durationMs);

  // Same inline-during-render publication style as `__VALIDATION__` below:
  // a plain diagnostic global, read by selftest.ab.spec.ts via `page.evaluate`.
  (window as unknown as { __AB__: unknown }).__AB__ = {
    demo: demoId,
    t,
    durationMs: timeline.durationMs,
    chrome: isChrome,
    ready: true,
  };

  // Both panels are INDEPENDENT mounts of the vanilla renderer. Since the React
  // renderer was removed (step 2.6b), the self-test no longer proves "React ==
  // vanilla" — that proof is in the git history. What survives is a calibration
  // of the MEASUREMENT: two independent mounts of the same spec at the same `t`
  // must be pixel-identical, or DOM measurement itself is nondeterministic.
  // `chrome` mounts the whole player (stage + control bar) via
  // `mountPlayer`, which builds its own `.rdfa-player` → `bare`.
  const panel = () =>
    isChrome ? (
      <VanillaPlayerPanel spec={spec} t={t} />
    ) : (
      <VanillaPanel spec={spec} t={t} />
    );

  return (
    <main className="harness ab-harness" data-theme={mode}>
      <header className="harness-bar">
        <h1>
          self-test — {demoId}{' '}
          <span>
            · t={Math.round(t)}ms · vanilla vs vanilla
            {isChrome ? ' · chrome' : ''}
          </span>
        </h1>
      </header>
      <div className="ab-grid">
        <ABPanel label="A — Vanilla DOM" panelId="a" bare={isChrome}>
          {panel()}
        </ABPanel>
        <ABPanel
          label="B — Vanilla DOM (independent mount)"
          panelId="b"
          bare={isChrome}
        >
          {panel()}
        </ABPanel>
      </div>
    </main>
  );
}

// ─── Mount-vs-update mode (?mu=1) ──────────────────────────────────────────

/**
 * The instants the walked panel passes through on its way to `t`: the compare
 * grid's own checkpoints, up to the target.
 *
 * Cumulative rather than a single jump on purpose. One `update()` would only
 * prove that a lone transition lands correctly; walking the whole grid is what
 * catches an error that ACCUMULATES over a sequence of frames, which is the
 * actual failure mode of a retained renderer.
 */
function cumulativePath(durationMs: number, pct: number): number[] {
  const checkpoints = [0, 0.25, 0.5, 0.75].filter((p) => p < pct);
  return [...checkpoints, pct].map((p) => durationMs * p);
}

function MUApp() {
  if (!spec) {
    return (
      <div className="harness-error">
        Unknown demo: <code>{demoId}</code>. Available demos:{' '}
        {Object.keys(catalog).sort().join(', ')}
      </div>
    );
  }
  const { timeline } = compile(spec);
  const pctParam = params.get('probePct');
  const pct =
    pctParam != null ? Math.min(1, Math.max(0, Number(pctParam))) : 0.5;
  const t = timeline.durationMs * pct;
  const path = cumulativePath(timeline.durationMs, pct);

  // A `set_content` caught MID-CROSSFADE is the one documented case where the
  // two paths legitimately disagree: the icon geometry anchoring the icon→panel
  // morph is captured once and never rewritten, so a fresh mount captures a
  // panel that has already partly grown while a walked mount captured the true
  // icon box. React has exactly the same path dependence — see the comment on
  // `iconGeomByNode` in core/src/dom/mount.ts. The gate reads this flag and
  // reports such a cell instead of asserting on it.
  const midCrossfade = evaluate(timeline, t).some((a) => {
    if (a.clip.kind !== 'set_content') return false;
    const p = contentCrossfade(a.clip as SetContentClip, t);
    return p > 0 && p < 1;
  });

  (window as unknown as { __AB__: unknown }).__AB__ = {
    demo: demoId,
    t,
    durationMs: timeline.durationMs,
    panelB: 'vanilla-updated',
    path,
    midCrossfade,
    ready: true,
  };

  // The gate reads the two subtrees through this, so the normaliser runs in the
  // page next to the DOM it describes rather than being reimplemented in the
  // Playwright process.
  (window as unknown as { __MU__: unknown }).__MU__ = {
    compare() {
      const read = (panel: 'a' | 'b'): string | null => {
        const stage = document.querySelector(
          `[data-ab-panel="${panel}"] .rdfa-stage`
        );
        return stage ? normalizeStageHtml(stage) : null;
      };
      const a = read('a');
      const b = read('b');
      if (a == null || b == null) return { ok: false, reason: 'missing-stage' };
      const diff = firstDifference(a, b);
      return diff == null
        ? { ok: true, length: a.length }
        : { ok: false, reason: 'diff', ...diff };
    },
  };

  return (
    <main className="harness ab-harness" data-theme={mode}>
      <header className="harness-bar">
        <h1>
          mount-vs-update — {demoId}{' '}
          <span>
            · t={Math.round(t)}ms · walk={path.map(Math.round).join('→')}
          </span>
        </h1>
      </header>
      <div className="ab-grid">
        <ABPanel label="A — Vanilla, fresh mount(t)" panelId="a">
          <VanillaPanel spec={spec} t={t} />
        </ABPanel>
        <ABPanel label="B — Vanilla, mount(0) + update(…)" panelId="b">
          <VanillaPanel spec={spec} t={t} path={path} />
        </ABPanel>
      </div>
    </main>
  );
}

// ─── Web-component mode (?wc=1) ────────────────────────────────────────────

/**
 * The A/B pairs of the WC gate: for each case, the core's options on one side and
 * the element's attributes on the other.
 *
 * The two spellings sitting next to each other IS the gate. Everywhere else in
 * this repo, two values that must stay manually in sync are a design smell; here
 * the human asserts "these two are the same request" and the pixel diff is what
 * proves the element's attribute parsing agrees. Writing panel B's attributes by
 * deriving them from panel A's options would test the element against itself.
 *
 * `default` covers the plain configuration; the rest each move ONE thing, so a
 * failing cell names the attribute that broke.
 */
const WC_CASES = {
  default: { options: {}, attrs: {} },
  'no-controls': {
    options: { controls: false },
    attrs: { controls: 'false' },
  },
  compact: { options: { density: 'compact' }, attrs: { density: 'compact' } },
  spacious: {
    options: { density: 'spacious' },
    attrs: { density: 'spacious' },
  },
  blueprint: { options: { theme: 'blueprint' }, attrs: { theme: 'blueprint' } },
  exportable: { options: { exportable: true }, attrs: { exportable: '' } },
} as const satisfies Record<
  string,
  { options: PlayerOptions; attrs: Record<string, string> }
>;

type WcCase = keyof typeof WC_CASES;

const wcCase: WcCase = ((): WcCase => {
  const requested = params.get('case');
  return requested !== null && requested in WC_CASES
    ? (requested as WcCase)
    : 'default';
})();

/** What both panels get before the case's own delta — spelled once per side. */
function wcBaseOptions(t: number): PlayerOptions {
  return {
    height: AB_PANEL.height,
    width: AB_PANEL.width,
    theme,
    mode,
    controls: true,
    autoPlay: false,
    initialT: t,
  };
}
function wcBaseAttrs(t: number): Record<string, string> {
  return {
    height: String(AB_PANEL.height),
    width: String(AB_PANEL.width),
    theme,
    mode,
    controls: 'true',
    'auto-play': 'false',
    'initial-t': String(t),
  };
}

/**
 * Readiness for the WC gate, and the reason it cannot be the usual
 * publish-during-render.
 *
 * The element mounts on a MICROTASK (coalesced), panel A mounts synchronously in
 * its effect. Declaring the page ready during render would leave the gate leaning
 * on `waitForAbReady`'s 400ms buffer: a cell that captured an empty panel B would
 * read as a rendering difference, and the day the buffer stopped being enough the
 * flake would look like a regression. So `ready` starts false and only the panels
 * themselves flip it, panel B off the element's own `dataflow-player:mounted`.
 */
const wcReady = new Set<string>();
function signalWcPanelReady(panelId: string): void {
  wcReady.add(panelId);
  if (wcReady.size < 2) return;
  const w = window as unknown as { __AB__?: { ready?: boolean } };
  if (w.__AB__) w.__AB__.ready = true;
}
function reportWcProblem(message: string): void {
  const w = window as unknown as { __AB__?: { error?: string } };
  if (w.__AB__) w.__AB__.error = message;
  console.error(`[wc-gate] ${message}`);
}

/**
 * Panel A: `mountPlayer`, called by hand.
 *
 * Deliberately NOT `VanillaPlayerPanel` with an extra prop. That component is
 * what the self-test's `chrome` config mounts, and that gate is required to stay
 * at 120/120 — so it is left byte-for-byte alone and this one, which needs
 * per-case options, lives beside it.
 */
function MountPlayerPanel({ spec, t }: { spec: DataFlowSpec; t: number }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = slotRef.current;
    if (!container) return;
    const player = mountPlayer(container, spec, {
      ...wcBaseOptions(t),
      ...WC_CASES[wcCase].options,
    });
    signalWcPanelReady('a');
    return () => player.destroy();
  }, [spec, t]);
  return <div ref={slotRef} />;
}

/** Panel B: the same request, written as `<dataflow-player>` attributes. */
function ElementPlayerPanel({ spec, t }: { spec: DataFlowSpec; t: number }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = slotRef.current;
    if (!container) return;
    const el = document.createElement(
      'dataflow-player'
    ) as DataFlowPlayerElement;
    for (const [name, value] of Object.entries({
      ...wcBaseAttrs(t),
      ...WC_CASES[wcCase].attrs,
    }))
      el.setAttribute(name, value);
    el.spec = spec;

    const onMounted = (): void => {
      // The event says the mount returned; this says it produced something. A
      // signal without a player would let the gate compare an empty box and call
      // it a rendering difference.
      if (el.querySelector('.rdfa-player')) signalWcPanelReady('b');
      else
        reportWcProblem(
          'dataflow-player:mounted fired with no .rdfa-player in the element'
        );
    };
    el.addEventListener(MOUNTED_EVENT, onMounted, { once: true });
    container.appendChild(el);

    return () => {
      el.removeEventListener(MOUNTED_EVENT, onMounted);
      el.remove();
    };
  }, [spec, t]);
  return <div ref={slotRef} />;
}

function WCApp() {
  if (!spec) {
    return (
      <div className="harness-error">
        Unknown demo: <code>{demoId}</code>. Available demos:{' '}
        {Object.keys(catalog).sort().join(', ')}
      </div>
    );
  }
  const { timeline } = compile(spec);
  const t = resolveFrozenT(timeline.durationMs);

  (window as unknown as { __AB__: unknown }).__AB__ = {
    demo: demoId,
    t,
    durationMs: timeline.durationMs,
    case: wcCase,
    panelB: 'dataflow-player',
    // Flipped by the panels, not here — see `signalWcPanelReady`.
    ready: false,
  };

  return (
    <main className="harness ab-harness" data-theme={mode}>
      <header className="harness-bar">
        <h1>
          web component — {demoId}{' '}
          <span>
            · t={Math.round(t)}ms · case={wcCase} · mountPlayer vs
            &lt;dataflow-player&gt;
          </span>
        </h1>
      </header>
      <div className="ab-grid">
        <ABPanel label="A — mountPlayer" panelId="a" bare>
          <MountPlayerPanel spec={spec} t={t} />
        </ABPanel>
        <ABPanel label="B — <dataflow-player>" panelId="b" bare>
          <ElementPlayerPanel spec={spec} t={t} />
        </ABPanel>
      </div>
    </main>
  );
}

// ─── Fluidity curve sampling ────────────────────────────────

interface CurveSample {
  t: number;
  /** What Stage displays: contentCrossfade (clipOpacity softened by easeInOutCubic). */
  rendered: number;
  /** "Before" reference: the linear crossfade of raw clipOpacity. */
  linear: number;
}

// We plot the FADE-IN REGION (the content's appearance + the geometry morph),
// not the clip's whole lifetime: a hold of several seconds
// would crush the ramp and proportional sampling would become too
// coarse to resolve the eased shape. Not fixed and fine → reliable metric.
const STEP_MS = 6;
const MAX_FADE_MS = 2000;

function sampleCrossfade(clip: Clip, durationMs: number): CurveSample[] {
  const start = Math.max(0, clip.startMs);
  const hardEnd = Math.min(durationMs, clip.visibleUntilMs);
  // End of fade = first instant the render reaches ~1 (capped).
  let fadeEnd = start;
  for (let t = start; t <= hardEnd && t <= start + MAX_FADE_MS; t += STEP_MS) {
    fadeEnd = t;
    if (contentCrossfade(clip, t) >= 0.999) break;
  }
  const end = Math.min(hardEnd, fadeEnd + 120); // margin: shows entry into the hold
  const out: CurveSample[] = [];
  for (let t = start; t <= end + 0.5; t += STEP_MS) {
    const tt = Math.min(t, end);
    out.push({
      t: tt,
      rendered: contentCrossfade(clip, tt),
      linear: clipOpacity(clip, tt),
    });
  }
  return out;
}

/**
 * Real duration of the fade-in, READ on the samples (therefore faithful to
 * the default fade of `clipOpacity`, which no spec field exposes).
 */
function riseMs(samples: CurveSample[]): number | null {
  if (samples.length === 0) return null;
  const start = samples[0].t;
  for (const s of samples)
    if (s.rendered >= 0.99) return Math.round(s.t - start);
  return null;
}

/** Largest velocity discontinuity (corner) on the series, in /second. */
function maxJerk(
  samples: CurveSample[],
  pick: (s: CurveSample) => number
): number {
  let prevV = 0;
  let max = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt <= 0) continue;
    const v = ((pick(samples[i]) - pick(samples[i - 1])) / dt) * 1000;
    max = Math.max(max, Math.abs(v - prevV));
    prevV = v;
  }
  return max;
}

// ─── Render ──────────────────────────────────────────────────────────────────

const W = 320;
const H = 90;

function path(
  samples: CurveSample[],
  pick: (s: CurveSample) => number
): string {
  if (samples.length === 0) return '';
  const t0 = samples[0].t;
  const span = Math.max(1, samples[samples.length - 1].t - t0);
  return samples
    .map((s, i) => {
      const x = ((s.t - t0) / span) * W;
      const y = H - pick(s) * H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function CurvePanel({ clip, timeline }: { clip: Clip; timeline: Timeline }) {
  const samples = sampleCrossfade(clip, timeline.durationMs);
  const objectId = 'objectId' in clip ? clip.objectId : '?';
  const rise = riseMs(samples);
  const jerkRendered = maxJerk(samples, (s) => s.rendered);
  const jerkLinear = maxJerk(samples, (s) => s.linear);
  return (
    <div className="curve">
      <div className="curve-head">
        <strong>set_content</strong> → <code>{objectId}</code>
        <span className="curve-meta">
          window {Math.round(clip.startMs)}–{Math.round(clip.visibleUntilMs)}ms
          {rise !== null ? ` · fade-in ≈ ${rise}ms` : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="curve-svg"
        preserveAspectRatio="none"
      >
        <path d={path(samples, (s) => s.linear)} className="curve-linear" />
        <path d={path(samples, (s) => s.rendered)} className="curve-rendered" />
      </svg>
      <div className="curve-legend">
        <span className="dot dot-rendered" /> rendered (eased)
        <span className="dot dot-linear" /> before: linear
        <span className="curve-jerk">
          jerk: rendered ≈ {jerkRendered.toFixed(2)}/s · before ≈{' '}
          {jerkLinear.toFixed(2)}/s
        </span>
      </div>
    </div>
  );
}

/**
 * A `.rdfa-player` box holding the VANILLA renderer frozen at `t`.
 *
 * The stage is mounted directly under `.rdfa-player`, exactly as the real player
 * does: `.rdfa-player` is `display:flex; flex-direction:column`, so the stage's
 * `flex: 1 1 auto` gives it height even though every one of its children is
 * absolutely positioned (content height 0). No extra flex wrapper is needed here
 * — unlike `VanillaPanel`, which nests one level below ABPanel's `.rdfa-player`.
 */
function FrozenStage({
  spec,
  t,
  width,
  height,
}: {
  spec: DataFlowSpec;
  t: number;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const handle = mountStage(container, spec, t);
    return () => handle.destroy();
  }, [spec, t]);
  return (
    <div
      ref={ref}
      className="rdfa-player"
      data-theme={theme}
      data-mode={mode}
      style={{ height, width }}
    />
  );
}

function Filmstrip({
  spec,
  timeline,
}: {
  spec: DataFlowSpec;
  timeline: Timeline;
}) {
  return (
    <div className="filmstrip">
      {timeline.stops.map((stop, i) => (
        <figure className="frame" key={`${stop}-${i}`}>
          <figcaption>t={Math.round(stop)}ms</figcaption>
          <FrozenStage spec={spec} t={stop} width={440} height={280} />
        </figure>
      ))}
    </div>
  );
}

// LIVE probe: a single Stage that continuously PLAYS (rAF) a short loop around
// the set_content. The icon→panel geometry morph is emergent from the
// frame-by-frame choreography (capturing `iconGeomByNode` when the clip
// becomes active, then forceRemeasure/ResizeObserver) — a frozen Stage or
// jumps in `t` do not reproduce it. The loop passes through the icon state at
// each cycle, which properly re-captures the geometry. We read the top edge
// as it plays (DOM poll) to verify the anchoring.
const PROBE_PRE_MS = 700;
const PROBE_POST_MS = 700;
const PROBE_SPEED = 0.18;

function LiveProbe({
  spec,
  timeline,
  clip,
}: {
  spec: DataFlowSpec;
  timeline: Timeline;
  clip: Clip;
}) {
  const lo = Math.max(0, clip.startMs - PROBE_PRE_MS);
  const hi = clip.startMs + PROBE_POST_MS;
  // ?probeT=<ms> freezes the probe at a precise instant (deterministic capture of a
  // mid-point); otherwise it loops.
  const frozenParam = params.get('probeT');
  const frozen = frozenParam != null ? Number(frozenParam) : null;
  const [t, setT] = useState(frozen ?? lo);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ReturnType<typeof mountStage> | null>(null);

  // Mount the vanilla stage once. The rAF loop below advances `t`; a separate
  // effect pushes it into the retained renderer with `update(t)`. The morph is
  // emergent from the frame-by-frame play, so driving `update` per frame — rather
  // than remounting — is exactly what reproduces it.
  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;
    const handle = mountStage(container, spec, frozen ?? lo);
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, [spec, frozen, lo]);

  useEffect(() => {
    handleRef.current?.update(t);
  }, [t]);

  useEffect(() => {
    const w = window as unknown as {
      __probe?: { start: number; objectId: string };
    };
    w.__probe = {
      start: clip.startMs,
      objectId: 'objectId' in clip ? clip.objectId : '?',
    };
    if (frozen != null) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      setT((prev) => {
        const next = prev + dt * PROBE_SPEED;
        return next > hi ? lo : next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [clip, lo, hi, frozen]);
  return (
    <div className="probe">
      <div className="probe-head">
        live probe · <code>{'objectId' in clip ? clip.objectId : '?'}</code> ·
        t=
        {Math.round(t)}ms
      </div>
      <div
        ref={boxRef}
        className="rdfa-player"
        data-theme={theme}
        data-mode={mode}
        style={{ height: 380, width: 560 }}
      />
    </div>
  );
}

function App() {
  if (!spec) {
    return (
      <div className="harness-error">
        Unknown demo: <code>{demoId}</code>. Available demos:{' '}
        {Object.keys(catalog).sort().join(', ')}
      </div>
    );
  }
  const { timeline } = compile(spec);
  const setContentClips = timeline.clips.filter(
    (c) => c.kind === 'set_content'
  );

  // Exposed for machine reading (chrome-devtools MCP → evaluate_script,
  // or a Playwright script) without having to OCR the contact sheet.
  (window as unknown as { __VALIDATION__: unknown }).__VALIDATION__ = {
    demo: demoId,
    durationMs: timeline.durationMs,
    stops: timeline.stops,
    setContent: setContentClips.map((c) => ({
      objectId: 'objectId' in c ? c.objectId : null,
      window: [c.startMs, c.visibleUntilMs],
      samples: sampleCrossfade(c, timeline.durationMs),
    })),
  };

  return (
    // `data-theme` here emulates a themed HOST (the Docusaurus convention), so
    // it carries the light/dark mode — not one of the player's palette names.
    <main className="harness" data-theme={mode}>
      <header className="harness-bar">
        <h1>
          {demoId}{' '}
          <span>
            · {Math.round(timeline.durationMs)}ms · {timeline.stops.length}{' '}
            stops
          </span>
        </h1>
        <nav>
          {Object.keys(catalog)
            .sort()
            .map((id) => (
              <a
                key={id}
                href={`?demo=${id}&mode=${mode}&theme=${theme}`}
                aria-current={id === demoId}
              >
                {id}
              </a>
            ))}
        </nav>
      </header>

      <section>
        <h2>Clarity — contact sheet (one frozen Stage per stop)</h2>
        <Filmstrip spec={spec} timeline={timeline} />
      </section>

      {setContentClips.length > 0 && (
        <section className="probe-section">
          <h2>Live probe — actual appearance (animated geometry)</h2>
          <LiveProbe
            spec={spec}
            timeline={timeline}
            clip={setContentClips[0]}
          />
        </section>
      )}

      <section>
        <h2>
          Fluidity — crossfade of the {setContentClips.length} set_content
        </h2>
        {setContentClips.length === 0 ? (
          <p className="muted">No set_content in this demo.</p>
        ) : (
          <div className="curves">
            {setContentClips.map((clip, i) => (
              <CurvePanel clip={clip} timeline={timeline} key={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// No StrictMode: it double-invokes effects, which disrupts the precise
// iconGeom capture → forceRemeasure sequence of set_content. We remain faithful to
// the real render (Docusaurus doesn't wrap the player in StrictMode).
createRoot(document.getElementById('root')!).render(
  isBench ? (
    benchRenderer === 'wrapper' ? (
      <WrapperBenchApp />
    ) : (
      <VanillaBenchApp />
    )
  ) : isWC ? (
    <WCApp />
  ) : isMU ? (
    <MUApp />
  ) : isAB ? (
    <ABApp />
  ) : (
    <App />
  )
);
