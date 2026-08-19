# Have the rendering validated by an AI

How to ask an AI (vision or otherwise) to judge whether an animation is
**clear** and **fluid**, exploiting the fact that the engine is a pure
function `evaluate(timeline, t)`.

## Principle: time is addressable data

Having an AI watch the animation "live" is the worst medium: a model
reads video poorly, and live playback adds unnecessary flakiness. Since everything
stems from `evaluate(timeline, t)`, we transform time into data and separate two
unrelated questions:

| Question                                   | Good medium                      | Tool                            |
| ------------------------------------------ | -------------------------------- | ------------------------------- |
| "Is it **clear**?" (overlaps, readability) | still images                     | Vite harness → contact sheet    |
| "Is it **fluid**?" (`set_content`, `move`) | **curve of the value-over-time** | Vite harness → curve panels     |
| Structural safeguard (CI, pre-commit)      | JSON                             | `extract-curves.mjs` (headless) |

Fluidity **is not in a frame**: it is a property of the derivative. A
screenshot cannot reveal it; the curve must be drawn.

## Tool 1 — visual harness (both channels)

Vite serves a harness that, for a given demo, renders **a frozen vanilla stage at
each `timeline.stops[]`** (contact sheet) and, for each `set_content`, plots
the **actual crossfade opacity** (`clipOpacity`, which also drives the geometry
lerp) against the same curve passed through `easeInOutCubic`.

```bash
npm run harness -w @dataflow-animator/react
# → http://localhost:5199/?demo=spa&mode=light
```

URL parameters: `?demo=<id>` (see the navigation bar for the list),
`?mode=light|dark` and `?theme=<palette>` (`default` | `dots` | `blueprint` |
`pcb` | `chalk` | `terminal` | `paper` | `neon` — the same two axes as the
player's props, so a palette can be eyeballed on any demo).

The harness mounts the renderer with `mountStage` and reads `compile`,
`clipOpacity`/`contentCrossfade` from `@dataflow-animator/core` (none of
them public): a single source of truth, no duplication to resync. The DOM
measurement is real → we also see the **re-layout** of a `set_content` (font
refit, ResizeObserver), not just the movement "intended" by the engine.

### How an AI consumes it

Via the **chrome-devtools** MCP server already in place:

1. `navigate_page` / `new_page` → the URL above.
2. `take_screenshot` (`fullPage: true`) → **a single image** provides the
   contact sheet + the curves. The AI judges clarity and fluidity at once.
3. `evaluate_script` → `window.__VALIDATION__` exposes the numerical series
   (`stops`, and per `set_content` the `{ t, actual, eased }` samples), to
   reason about the numbers without OCR-ing the curve.

## Tool 2 — headless extractor (structure, no browser)

Detects defects that are decided at compile time, without rendering pixels:
cut/short explicit fades, overlap of two contents on the same
node. Fast signal for CI.

```bash
npm run build:lib                                   # dist must exist
node scripts/extract-curves.mjs --demo spa          # readable summary
node scripts/extract-curves.mjs --demo spa --json   # JSON
```

> Intentionally limited to the public API (`compile`): it **does not reimplement**
> `clipOpacity`. The DEFAULT fade duration is therefore not visible here — if the
> spec does not set `fadeInMs`/`fadeOutMs`, it's up to the harness to show the real
> curve. The tool invents no fade numbers.

## Worked case: "the `set_content` lacks fluidity"

The harness makes it obvious. The **red** curve (actual opacity) is a
**linear trapezoid**: constant velocity then sharp cut at the corners
(`max discontinuity ≈ 4/s`). The **green** curve shows the same crossfade passed
through `easeInOutCubic` — softened start and arrival. The engine already has the
easing function; `clipOpacity`'s crossfade, however, is linear. This is where
fluidity is won, and the AI immediately sees what to change and where.

The contrast is most telling on a **short window** (little hold): the
`spa` demo has a second `set_content` of ~750 ms that illustrates it well.

## Tool 3 — the renderer's own gates

The framework-agnostic DOM renderer (`@dataflow-animator/core/dom`) is now
the only renderer; the React one it replaced has been removed. Three
gates guard it, and it is worth being exact about **what each one proves**, because
they replaced an A/B comparison against React whose job is finished — the proof
that the two renderers agreed to the pixel is in the git history (200/200 A/B
cells at 0.0000%), not in any file here.

| Gate            | Command                       | Proves                                                                                        | Exact?                                      |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| mount-vs-update | `npm run harness:mountupdate` | the renderer is internally consistent: `mount(t)` == `mount(0)` then `update()` walked to `t` | yes — live DOM diff, no image               |
| self-test       | `npm run harness:selftest`    | the measurement floor is zero: two independent mounts are pixel-identical                     | yes — 0.00% required                        |
| element         | `npm run harness:element`     | the `<dataflow-player>` wrapper adds no pixel over a bare `mountPlayer`                       | yes — 0.0000% required                      |
| reference grid  | `npm run test:visual`         | no regression over time: the render matches a frozen golden                                   | approximate — pixels, font/Chrome-dependent |

#### What the four gates are pointed AT: `riskDemos.ts`

All four read the same list, so what is missing from it is invisible to every one
of them at once — the list is a single point of failure and deserves the same
scrutiny as the gates themselves. Each entry buys a risk area: `set_content`
(`spa`, `messageQueue`), dense `move` (`clientServer`), parallel composition
(`microservices`), tight layout (`collision`), tree layout (`avlTree`).

`avlTree` is there because of a regression that actually shipped. Every other
entry is a linear or graph layout, whose edges all come from `connections[]`;
`direction: 'tree'` is a second, independent path where the parent→child edges are
DERIVED from `tree` rather than declared. The vanilla renderer shipped without
drawing those edges at all — they were lost with the React renderer in `cf96860`
— and all four gates stayed green through it, because not one of them rendered a
tree. `avlTree` covers that path end to end in a single spec: auto-drawn edges, a
`set_visible` reveal with its staggered edge draw-in, and a `rotate_subtree`
reflow that interpolates placements.

The lesson generalises past trees: **a gate only guards the code its fixtures
reach**. When a spec feature gets a rendering path of its own, adding it to
`RISK_DEMOS` is the one edit that arms all four gates at once.

### mount-vs-update — the primary structural gate (`?mu=1`)

```bash
npm run harness:mountupdate -w @dataflow-animator/react
```

`mountUpdate.ab.spec.ts` mounts two vanilla stages of the same spec: panel A
fresh at `t`, panel B at `0` then walked to `t` with `update()` through the
checkpoints `0 → 25% → 50% → 75% → t`. Both render live, in the same run, and the
verdict is a **normalised `outerHTML` comparison** (`normalizeStageHtml`), not a
screenshot. It therefore depends on no font, no Chrome version, no external
reference — it asserts an internal invariant (retained mode == remount) and stays
exact everywhere. It is also the only gate that exercises `update()` at all.

Its probe grid is `0/25/50/75/**90**/100%` — one instant off the quarter grid, and
the reason generalises. A quarter grid samples wherever the timeline happens to
be; an ANIMATED TRANSITION only occupies its own window, and a short one falls
between two quarters. `avlTree`'s `rotate_subtree` compiles to a reflow spanning
88.8%→92.5%, so the quarters step from 75% straight over it to 100% and every
sample sees a SETTLED layout — the interpolation between the two placements is
never rendered. 90% lands 545ms into that 1700ms window, and the walk reaches it
from 75% in a single `update()` that must therefore land mid-flight.

That instant was **falsified rather than assumed**: reading the rendered node
centres out of panel A across the window gives exactly the pre-rotation layout at
88.8% and exactly the post-rotation one at 92.5%, while at 90% all five moving
nodes sit 13.2% along their travel — a placement neither endpoint can produce. If
you move the value, re-check that; a probe that coincides with a settled layout
asserts nothing. Only this gate carries the extra instant: the self-test and
element gates compare two renderings produced the SAME way, so a mid-reflow
sample there would re-ask what this gate already answers exactly.

The one class of cell it does not assert on is a `set_content` caught
mid-crossfade — a documented path dependence of the renderer (the icon geometry
anchoring the icon→panel morph is captured once), detected from the spec rather
than listed by hand. `avlTree` has no `set_content`, so all of its cells assert.

### self-test — the measurement floor (`?ab=1`)

```bash
npm run harness:selftest -w @dataflow-animator/react
```

`selftest.ab.spec.ts` renders two INDEPENDENT vanilla panels of the same spec at
the same frozen `t` (480×320), over every risk demo (`riskDemos.ts`) × both
themes × two configs (`stage`, `chrome`), and requires exactly 0.00% on two
checks (144 total):

- **successive capture** — screenshot one panel twice in a row: a non-zero diff
  means something is still settling (fonts, ResizeObserver, a wall-clock CSS
  animation);
- **cross-mount** — screenshot two independent mounts: a non-zero diff means DOM
  measurement is nondeterministic across mounts.

If this floor were not zero, no pixel gate built on top of it could be trusted.
While building the renderer, this suite caught a real bug: a `loading` spinner is
a native CSS `@keyframes` animation driven by the browser's wall clock, so two
successive captures drifted even with `t` frozen. The fix is
`animations: 'disabled'` on the `.screenshot()` calls (the same mechanism
`toHaveScreenshot()` applies by default). `?probeT=<ms>` / `?probePct=<0..1>`
freeze the instant; `window.__AB__` exposes `{ demo, t, durationMs, chrome,
ready }` plus `{ passes, converged }` from the settle loop.

### element — the wrapper adds no pixel (`?wc=1`)

```bash
npm run harness:element -w @dataflow-animator/react
```

`element.ab.spec.ts` puts a bare `mountPlayer(container, spec, options)` in panel A
and a `<dataflow-player>` carrying the equivalent attributes in panel B, at a
frozen `t`. `@dataflow-animator/element` has no rendering of its own — its
`connectedCallback` calls `mountPlayer` and the element itself is the container —
so the requirement is **exactly 0.0000%**, and the self-test is what proves that
floor is reachable at all. 70 cells, in two sweeps:

- **frames** — every risk demo × the probe grid (0/25/50/75/100%) × both themes:
  does the element reproduce the renderer across the whole timeline?
- **options** — one demo, one attribute moved per cell (`controls="false"`,
  `density`, `theme`, `exportable`): does the attribute→option mapping hold?
  Without this sweep the gate would only prove the element calls `mountPlayer`
  with the DEFAULTS.

The A/B pair of each cell is declared in ONE table in `main.tsx` (`WC_CASES`),
with the core's options and the element's attributes written side by side. Two
values kept manually in sync is normally a smell in this repo; here it IS the
gate — the human asserts "these two spellings are the same request", and the pixel
diff proves the element's parsing agrees. Deriving B's attributes from A's options
would test the element against itself.

**Readiness is exact, not timed.** The element mounts on a coalesced microtask
while panel A mounts synchronously, so `__AB__.ready` starts `false` and the
panels flip it themselves — panel B from the element's own
`dataflow-player:mounted` event. Leaning on `waitForAbReady`'s 400ms buffer would
have meant a cell could capture an empty panel B and report it as a rendering
difference; the day the buffer stopped being enough, the flake would have looked
like a regression. Panel B also refuses to signal unless `.rdfa-player` is really
there, and the spec asserts `toBeVisible()` on both panels as an independent
second check.

The gate has been falsified on purpose: dropping the `initial-t` mapping from
`options.ts` moves `spa · 50% · light` to 1.9733% and the cell fails. A gate that
cannot fail is not a gate.

### reference grid — visual non-regression (`test:visual`)

```bash
npm run test:visual -w @dataflow-animator/react
npm run test:visual -w @dataflow-animator/react -- --update-snapshots  # regenerate
```

`referenceGrid.visual.spec.ts` captures a **contact sheet** per risk demo × theme
(12 fullPage goldens): one frozen frame of the vanilla stage at every
`timeline.stops[]`, so a single image covers every settled instant. It pins the
renderer against its own past — a future change that moves a pixel is flagged.

It does **not** compare against React; that renderer is gone. FRAGILE by nature:
the goldens depend on the machine's font rendering and the Chrome version
(`channel: 'chrome'`), and `maxDiffPixelRatio: 0.02` absorbs anti-aliasing dust.
Regenerate in the target environment with `--update-snapshots`. It is a
LOCAL/manual gate — **not wired into CI** (that would need a pinned rendering
environment), exactly as it was before this step.

### Shared plumbing

`selftest.ab.spec.ts`, `mountUpdate.ab.spec.ts` and `element.ab.spec.ts` run under
`playwright.compare.config.ts` — its own port (5198, distinct from the
interactive harness's 5199) and `reuseExistingServer: false` unconditionally, so
a developer's running `npm run harness` session is never silently reused
mid-measurement (the documented port-5199 trap). `referenceGrid.visual.spec.ts`
runs under `playwright.config.ts` (port 5199) instead. Per-cell rows are
accumulated on disk (`abResults.ts`, gitignored) rather than in memory, because
Playwright restarts the worker after a failing test; `globalTeardown.ts` prints
the final tables exactly once, in the main process.

`window.__AB__` also carries `passes` and `converged` from the settle loop.
`converged: false` means the measurement BUDGET stopped the loop rather than the
geometry settling — the fix is not to raise the budget (see
`core/src/dom/settle.ts`). Every risk demo converges: 3 settle passes, 4 on `spa`
at the instants where its `set_content` is re-fitting.

### Perf baseline

```bash
npm run harness:bench -w @dataflow-animator/react                        # vanilla
npm run harness:bench -w @dataflow-animator/react -- --renderer wrapper  # published component
```

`scripts/bench-perf.mjs` drives the harness's `?bench=1&demo=<id>` page in one of
two modes: the core's `mountPlayer` (`--renderer vanilla`, default) or the
published `DataFlowPlayer` (`--renderer wrapper`), both autoPlay + loop, for ~300
frames on `circuit` (heavy: dense orthogonal routing) and `clientServer`
(average), recording via Playwright + CDP:

- the wall-clock gap between successive `requestAnimationFrame` callbacks
  (mean/median/p95/min/max) — the cadence a user actually experiences;
- the CDP `Performance` domain's script/layout/style/task duration deltas over
  the whole run — a breakdown by phase.

`bench-baseline.json` is the FROZEN step-2.1 React figure, kept for HISTORY only
and never rewritten; `--renderer vanilla` writes `bench-vanilla.json`,
`--renderer wrapper` writes `bench-wrapper.json`. Two caveats:

- at these demos' sizes, render cost is comfortably under the 16.7ms frame
  budget, so the wall-clock frame time reads as vsync-locked (~16.7ms)
  regardless of renderer cost — the CDP script/layout/style breakdown is the
  more sensitive signal;
- the numbers are machine-dependent: a future CI-run comparison should either
  regenerate the baseline in that same environment or compare both renderers
  within the SAME run, not diff raw milliseconds captured on different
  machines.

## Ideas to go further

- **Automate in CI**: a Playwright script (use `channel: 'chrome'`
  to reuse the system Chrome, without downloading Chromium) that loads the
  harness, waits for measurement, screenshots, and reads `__VALIDATION__`.
- **Visual regression**: since the rendering is deterministic, reference
  contact sheets (golden) + a pixel diff (`odiff`, `pixelmatch`,
  `jest-image-snapshot`) provide **non-flaky** snapshots — the usual pain
  point disappears.
