# Architecture

Internal reference for the development and extension of the library.
See also [SPEC.md](./SPEC.md) (functional specification).

## Key decisions

1. **Custom deterministic engine (no GSAP).** Core = pure function
   `evaluate(timeline, t)`. Advantages: mastered seek / steps / lifecycle,
   tests without DOM, light bundle, SSR-safe.
2. **Compiler → IR → runtime separation.** `compile(spec)` produces a
   `Timeline` (dated clips + steps + duration), independent of the DOM. Rendering
   resolves geometry from actual measurements at render time.
3. **Monorepo npm workspaces.** The published library (`packages/react-dataflow-animator`)
   is isolated from the documentation site (`apps/docs`). The site consumes the
   lib as a workspace dependency.
4. **Framework-agnostic core (`packages/core`).** The spec types, the generated
   JSON Schema, the pure engine (`evaluate`/`compile`/layout/geometry/routing),
   TeX parsing, syntax highlighting, JSON export, and the render-side pure
   helpers (`clipOpacity`, `nodeColors`, `nodeKinds`) live in
   `@react-dataflow-animator/core` — a private, source-only workspace with
   **zero React dependency**, not even in `import type`. `packages/react-dataflow-animator`
   consumes it through a Vite/TS path alias to `../core/src` and inlines it into
   the published bundle; `@react-dataflow-animator/core` is never a runtime
   dependency of the npm package and never appears in its `dist/`.
5. **Scoped CSS** (`.rdfa-`) + CSS variables, compiled into `dist/style.css`.
   No CSS framework imposed on the consumer.
6. **Browser rendering, no server markup**: since v3 the player MOUNTS the
   core's DOM renderer in a client effect, so nothing is emitted server-side
   beyond a sized placeholder (and `fallback`). No DOM is touched at module
   scope, so importing the package on a server is safe.
7. **Extensible registries** (node icons, sub-icons, highlighter).

## Rendering pipeline

```text
spec ──compile()──▶ Timeline (clips, steps, durationMs)   [pure, no DOM, core]
                          │
createPlayerClock (rAF) ──▶ t ─────┤
                          ▼
    mountVanillaStage: evaluate(timeline, t) ──▶ active clips (+ progress)  [core]
                          │
   layout (CSS ratios) + geometry (measured BoundingClientRects)         [core]
                          ▼
   nodes / arrows / packets / spinners / contents / comments  [core, retained]
```

The whole pipeline lives in `@react-dataflow-animator/core`, React included out.
A clock tick calls `handle.update(t)`, which MUTATES the DOM already on screen
rather than rebuilding it — the retained mode that makes a frame 5–7× cheaper in
script time than the React reconciliation it replaced.

`packages/react-dataflow-animator` is a thin wrapper: `DataFlowPlayer` maps its
props to `mountVanillaPlayer`'s options in an effect and calls `destroy()` on
cleanup. It renders nothing per frame.

**Every option is read once, at mount.** The core reads its options when it
builds, so the wrapper remounts on any change — `spec` included, keyed on the
spec's structure rather than its identity, carrying the current instant and play
state across. Live per-option updates would be a second renderer's worth of
work.

The React renderer that preceded this design (`Stage.tsx`, `Controls.tsx`,
`nodes/`, `dynamic/`, `hooks/`, `tex/`) was removed at step 2.6b, once the
migration no longer needed it as the A/B gate's reference. The proof that the two
renderers agreed to the pixel lives in the git history; the surviving gates check
the vanilla renderer against itself and against a frozen reference grid (see
[AI-VALIDATION.md](./AI-VALIDATION.md)).

## Monorepo structure

```text
packages/
  core/                              framework-agnostic core (private, source-only)
    src/
      index.ts                       public entry point of the core (types + schema)
      types.ts                       TS types of the spec (source of truth)
      schema.ts / schema.generated.json   JSON Schema generated from types.ts
      engine/
        compiler.ts                  spec.actions → Timeline
        timeline.ts                  IR + evaluate (pure) + navigation
        layout.ts                    node placement (lanes / circular)
        geometry.ts                  connection points
        orthoRouter.ts, pins.ts, portOffsets.ts, pathShapes.ts, placements.ts, scale.ts
                                      circuit routing (A*, pin assignment, path shaping)
      render/
        clipOpacity.ts                crossfade / geometry-lerp progress (pure)
        nodeColors.ts, nodeKinds.ts    pure render-side lookups (no CSSProperties — see below)
        stageSignature.ts              useStageGeometry's remeasure signature
      tex/                            TeX-like inline markup parser (RichText's input)
      highlight/                      Prism wrapper (replaceable)
      export/
        json.ts                       serialize / copy / download the spec JSON
      dom/                            THE renderer (retained-mode, no framework)
        player.ts                     mountVanillaPlayer: stage + chrome + clock
        mount.ts                      mountVanillaStage: the stage, update(t), settle loop
        clock.ts                      createPlayerClock (rAF, subscribe/destroy)
        controls.ts, jsonDialog.ts, debugOverlay.ts        the player's chrome
        nodeElement.ts, packetElement.ts, arrowElement.ts,
        commentElement.ts, contentElement.ts, zones.ts     the layers
        icons/                        pictograms, tech badges, custom registry
        el.ts, reconcile.ts, settle.ts, geometryTracker.ts plumbing
    scripts/
      generate-schema.mjs             types.ts → schema.generated.json (ts-json-schema-generator)
      check-schema-is-fresh.mjs       CI guard: schema.generated.json is committed & fresh
      generate-subicon-data.mjs       react-icons glyphs → subIconData.generated.ts
  react-dataflow-animator/            the published npm package (thin React wrapper)
    src/
      DataFlowPlayer.tsx              mounts the core's player in an effect
      index.ts                        public exports
      types.ts                        re-exports core's spec types + the React-facing props type
      schema.ts                       thin re-export of core's schema.generated.json
      utils/styleMap.ts               CSSProperties → the core's kebab-case string map
      components/nodes/NodeView.tsx   isolated node preview, mounts renderNodeVisual
      styles/
        dataflow.css                  scoped .rdfa- styles
apps/
  docs/                              Docusaurus site
    docs/                            MDX content (intro, concepts, reference)
    src/                             React components of the site
      site-content/demos/            demos importable in the lib
docs/
  SPEC.md, ARCHITECTURE.md           internal references
```

`packages/core` has no `dist/`: it is never built or published on its own.
`packages/react-dataflow-animator` resolves `@react-dataflow-animator/core/*`
to `../core/src/*` (a Vite alias + a matching `tsconfig.app.json` `paths`
entry) and Vite/Rollup inline the core source straight into the published
bundle, so `dist/index.js` is self-contained and never references the private
workspace.

## Adding a new component

### New action type

1. Add the type in `types.ts` (`ActionType`) and the enum in `schema.ts`.
2. Add a clip variant in `engine/timeline.ts` (`Clip` union)
   with its `keep_until_next` default and its default duration in
   `engine/compiler.ts`, and a `case` in `compileAction`.
3. Render the clip in `components/Stage.tsx` (`active` filter on `kind`).
4. `.rdfa-…` styles in `styles/dataflow.css`. Test in
   `engine/compiler.test.ts`.

### New node type or new sub-icon

- at runtime, `registerNodeIcon(type, icon)` / `registerSubIcon(name, icon)`,
  where `icon` is SVG markup or a `() => SVGElement` factory
  (`core/src/dom/icons/registry.ts`). Markup is parsed lazily, on first
  resolution, via a `<template>` — so registering never touches the DOM and is
  safe at module scope in an SSR bundle. A registration wins over every
  built-in, the stateful `switch`/`push_button` geometry included;
- or enrich the data tables in the lib: `core/src/dom/icons/nodeIconShapes.ts`
  (pictogram geometry) and `subIconCatalog.ts` (tech badges, whose glyph data is
  then generated by `npm run generate:subicons`).

## Build and publication

Everything starts from the root via npm workspaces:

```bash
npm run build       # full build (lib then site)
npm run build:lib   # core isolated typecheck, then the npm package
npm run build:docs  # only the site
```

`build:lib` first runs `tsc` on `packages/core` with its OWN tsconfig: core
sources are otherwise only typechecked as part of the react package's program
(vitest does not typecheck), whose compiler options differ — errors valid only
under core's stricter standalone view would stay invisible.

The package build (`packages/react-dataflow-animator`'s `build` script):

1. `rm -rf dist` — a plain `vite build` does not clean `dist/` between runs,
   so a file removed from the bundle would linger as an orphan in a stale
   `dist/` (e.g. leftovers from a since-removed video-export feature). The
   build always starts from a clean slate.
2. `node ../core/scripts/generate-schema.mjs` — regenerates
   `packages/core/src/schema.generated.json` from `packages/core/src/types.ts`
   before anything else consumes it.
3. `tsc -b tsconfig.app.json tsconfig.node.json` — typecheck. `tsconfig.app.json`
   resolves `@react-dataflow-animator/core/*` to `../core/src/*` via `paths`
   (see below), so this single program also typechecks every core file the
   package actually imports.
4. `vite build` — ESM bundle + `style.css`. The `@react-dataflow-animator/core`
   alias in `vite.config.ts` inlines the core source directly into the bundle:
   `packages/core` is never a runtime dependency and never appears in
   `dist/`.
5. `rollup -c rollup.dts.config.mjs` (`rollup-plugin-dts`) — flattens the
   `.d.ts` output into a single `dist/index.d.ts` with no reference to
   `@react-dataflow-animator/core`. A plain `tsc` declaration build would leave
   `import(...)` paths pointing at the private core workspace, which doesn't
   exist in the published tarball; flattening is what keeps the public
   `.d.ts` self-contained.
6. `postbuild`: copies `packages/core/src/schema.generated.json` to
   `dist/schema.json` (the schema is owned by core, but still published at the
   same `react-dataflow-animator/schema.json` path as before the extraction).

Result in `packages/react-dataflow-animator/dist/`: `index.js`,
`index.d.ts`, `style.css`, `schema.json`. The `exports` field of `package.json`
exposes them under `react-dataflow-animator`, `react-dataflow-animator/styles.css`
and `react-dataflow-animator/schema.json`.

`react` and `react-dom` are in `peerDependencies` (externalized from the bundle).
`@react-dataflow-animator/core` is a `private` workspace with no `dist/`: it is
never built, published, or listed as a runtime dependency of the npm package —
only inlined at build time via the alias above.

### Two non-additive lists to keep in sync with the core alias

Both the Vite watch config and the TS include list narrow to an explicit file
set as soon as one entry is set — adding a new path into `packages/core`
without updating these silently stops covering it:

- `vite.config.ts`'s `build.watch.include` (used by `npm run dev` /
  `vite build --watch`): must list `../core/src/**/*` alongside `src/**/*`, or
  edits to core stop triggering a rebuild that the docs site's dev server
  picks up.
- `tsconfig.app.json`'s `include`: must list `../core/src/**/*.d.ts` alongside
  `src`. Ambient `.d.ts` files (e.g. Prism's typing) that now live in core have
  no `import` statement pulling them in transitively through `paths`, so `tsc`
  only picks them up if they're named explicitly here.

## Tests and quality

| Command (root)          | Effect                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `npm run lint`          | Lint workspaces that expose a lint script (`core`, the package, docs)                        |
| `npm run format:check`  | Checks Prettier formatting                                                                   |
| `npm run format:write`  | Applies Prettier                                                                             |
| `npm test`              | vitest tests of `core` and of the package                                                    |
| `npm run test:coverage` | Tests + per-workspace coverage report (`core` and the package each have their own threshold) |
| `npm run deadcode`      | knip — dead code detection across all workspaces                                             |
| `npm run check:schema`  | Verifies `packages/core/src/schema.generated.json` is committed & fresh                      |
| `npm run build`         | Full build (lib, which typechecks core transitively, + docs)                                 |

On the package side, two vitest configurations coexist: `vitest.config.ts`
(unit, under `src/**/*.test.{ts,tsx}`) and `vitest.integration.config.ts`
(integration tests on demos). `packages/core` has its own `vitest.config.ts`
with a separate coverage threshold, run independently — `npm test`/`npm run test:coverage`
at the root fan out to both workspaces.

## Deployment

`.github/workflows/ci-cd.yml` runs schema freshness, Prettier, ESLint, knip,
unit + integration tests and the library build (which typechecks core in
isolation) on every push / PR, then builds and deploys the Docusaurus site on
GitHub Pages on the `main` branch. The npm publication of the lib remains
manual.
