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
3. **Monorepo npm workspaces.** Three published packages — `packages/core` →
   `@dataflow-animator/core` (the engine, the renderer, the stylesheet),
   `packages/react` → `@dataflow-animator/react` and `packages/element` →
   `@dataflow-animator/element` (the bindings) — isolated from the documentation
   site (`apps/docs`). The site consumes the React binding for its components and
   the core for the stylesheet; it does not consume the element (yet).

   Both bindings are thin, and deliberately so: they mount the core's player and
   own nothing about how it draws. `packages/element` is under 400 lines of code
   across three files, none of which renders anything — its whole job is to turn
   attributes into `PlayerOptions` and manage a mount.

4. **Framework-agnostic core (`@dataflow-animator/core`).** The spec types, the
   generated JSON Schema, the pure engine (`evaluate`/`compile`/layout/geometry/routing),
   TeX parsing, syntax highlighting, JSON export, the render-side pure helpers
   (`clipOpacity`, `nodeColors`, `nodeKinds`), the DOM renderer and its
   stylesheet live in `packages/core` — with **zero React dependency**, not even
   in `import type`.

   Since phase 3 this is a **published package with its own build**, not a
   private source-only workspace: it is the entry point for a consumer with no
   framework at all, and the common dependency every wrapper is built on. The
   React rule is what makes that possible — a `react` import here would leak into
   every downstream consumer regardless of framework.

   Every binding **depends** on it: since step 3.2 the core is a runtime
   dependency (`^1.0.0`) of `@dataflow-animator/react`, and since step 3.3 of
   `@dataflow-animator/element` too, externalised from their bundles rather than
   inlined into them. One engine and one stylesheet on disk, however many
   bindings — see
   [Two ways to consume the core](#two-ways-to-consume-the-core).

5. **Scoped CSS** (`.rdfa-`) + CSS variables. The stylesheet lives in the core
   next to the renderer it styles, and is compiled into its `dist/styles.css`.
   It ships **once**: a consumer imports `@dataflow-animator/core/styles.css`
   whichever binding they use, and neither binding emits CSS of its own. No CSS
   framework imposed on the consumer.

   This is also why `<dataflow-player>` is a **light-DOM** custom element rather
   than a Shadow DOM one: a global `.rdfa-*` stylesheet cannot cross a shadow
   boundary, so encapsulating would have forced the element to carry its own copy
   of the CSS — the exact duplication the decision above exists to prevent. The
   consumer gains ordinary CSS selectors into the player as a side benefit.
   Shadow DOM stays available as a later opt-in.

6. **Browser rendering, no server markup**: the player MOUNTS the
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
    mountStage: evaluate(timeline, t) ──▶ active clips (+ progress)  [core]
                          │
   layout (CSS ratios) + geometry (measured BoundingClientRects)         [core]
                          ▼
   nodes / arrows / packets / spinners / contents / comments  [core, retained]
```

The whole pipeline lives in `@dataflow-animator/core`, React included out.
A clock tick calls `handle.update(t)`, which MUTATES the DOM already on screen
rather than rebuilding it — the retained mode that makes a frame 5–7× cheaper in
script time than the React reconciliation it replaced.

`packages/react` is a thin wrapper: `DataFlowPlayer` maps its props to
`mountPlayer`'s options in an effect and calls `destroy()` on cleanup. It renders
nothing per frame. Thin is measurable — its whole bundle is under 4 kB, because
everything above lives in the core it imports.

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
  core/                              @dataflow-animator/core — the published framework-agnostic package
    src/
      index.ts                       THE public API (the package's semver surface)
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
        player.ts                     mountPlayer: stage + chrome + clock
        mount.ts                      mountStage: the stage, update(t), settle loop
        clock.ts                      createPlayerClock (rAF, subscribe/destroy)
        controls.ts, jsonDialog.ts, debugOverlay.ts        the player's chrome
        nodeElement.ts, packetElement.ts, arrowElement.ts,
        commentElement.ts, contentElement.ts, zones.ts     the layers
        icons/                        pictograms, tech badges, custom registry
        el.ts, reconcile.ts, settle.ts, geometryTracker.ts plumbing
      styles/
        dataflow.css                  scoped .rdfa- styles (the renderer's own stylesheet)
    scripts/
      generate-schema.mjs             types.ts → schema.generated.json (ts-json-schema-generator)
      check-schema-is-fresh.mjs       CI guard: schema.generated.json is committed & fresh
      generate-subicon-data.mjs       react-icons glyphs → subIconData.generated.ts
  react/                             @dataflow-animator/react — the published React binding
    src/                              imports the core's TOP-LEVEL barrel only, never a subpath
      DataFlowPlayer.tsx              mounts the core's player in an effect
      index.ts                        public exports (its own + a mirror of the core's)
      types.ts                        the React-facing props type; re-exports core's spec types
      utils/styleMap.ts               CSSProperties → the core's kebab-case string map
      components/nodes/NodeView.tsx   isolated node preview, mounts renderNodeVisual
    scripts/validation-harness/       the visual gates — imports the core's DEEP subpaths
  element/                           @dataflow-animator/element — the published custom element
    src/                              imports the core's TOP-LEVEL barrel only, never a subpath
      DataFlowPlayerElement.ts        the element + defineDataFlowPlayer; calls mountPlayer(this, …)
      options.ts                      attributes → PlayerOptions (the boolean/absence rules)
      index.ts                        public exports; importing it REGISTERS <dataflow-player>
    scripts/smoke-consumer.mjs        the external consumer gate (packs and installs both tarballs)
  angular/                           @dataflow-animator/angular — the published Angular binding
    src/                              imports the core's TOP-LEVEL barrel only, never a subpath
      DataFlowPlayerComponent.ts      the standalone <dfa-player>; calls mountPlayer(host, …)
      options.ts                      inputs → PlayerOptions (the "absent writes no key" rule)
      index.ts                        public exports (no side effects — nothing to register)
      spec-helpers.ts                 test-only fixtures, excluded from tsconfig.lib.json
    ng-package.json                   the ng-packagr (Angular Package Format) build
    angular.json                      ONLY the `ng test` builder — never used to build the package
    scripts/smoke-consumer.mjs        the external consumer gate (packs, installs, `ng build` AOT)
apps/
  docs/                              Docusaurus site
    docs/                            MDX content (intro, concepts, reference)
    src/                             React components of the site
      site-content/demos/            demos importable in the lib
docs/
  SPEC.md, ARCHITECTURE.md           internal references
```

## Two ways to consume the core

The core is consumed through **two different resolution paths that must never
cross**. All three bindings reproduce this, and every binding added after them has
to as well.

| consumer                                          | resolves `@dataflow-animator/core` via         | sees deep subpaths? |
| ------------------------------------------------- | ---------------------------------------------- | ------------------- |
| harness, vitest, `ng test`, `tsc`                 | **source alias** → `../core/src`               | yes                 |
| the published library build (`vite`, `rollup -c`) | **external** → runtime dependency, not inlined | no (needs none)     |
| the published library build (`ng-packagr`)        | **node_modules** → the core's own `exports`    | no (needs none)     |

- The **harness** (`packages/react/scripts/validation-harness/`) imports
  `@dataflow-animator/core/dom/mount`, `/engine/timeline`, `/render/clipOpacity`…
  Those subpaths are deliberately absent from the core's published `exports`:
  they point into `src/`, which is not published, and they are renderer plumbing
  that is not part of the semver surface. A Vite alias (and a matching
  `tsconfig` `paths` entry) resolves them to source, which short-circuits
  `exports` entirely. This is the ONLY way the harness can work.
- The **library builds** must do the opposite: `packages/react/vite.config.ts` and
  `packages/element/vite.config.ts` have **no `resolve.alias` at all** and list
  `@dataflow-animator/core` in `rollupOptions.external`, so the published bundles
  import the core instead of copying it.
- The **Angular build** reaches the same place by the third road, and its absence
  of a `paths` entry in `tsconfig.lib.json` is the load-bearing part —
  the mirror image of the missing `resolve.alias` next door. ng-packagr never
  bundles a `dependency` (it only insists it be declared in
  `allowedNonPeerDependencies`), so what the config decides is TYPE resolution:
  with no alias, `tsconfig.lib.json` resolves the core through node_modules,
  i.e. through its real `exports` map and its flattened `dist/index.d.ts`.
  That makes the Angular build **the only thing in the repository that exercises
  the core's published contract**, and it costs exactly one build-order
  dependency — the core must be built first, which `build:lib` already
  guarantees. `tsconfig.spec.json` takes the other road, so the tests keep the
  usual source-alias behaviour with no build-order coupling.

Every binding's own `src/` reaches the core's **top-level barrel only**, never a
subpath. A subpath resolves in this monorepo (the alias short-circuits `exports`)
and fails for everyone who installs the package, since the published `exports`
lists only `.`, `./styles.css` and `./schema.json`. The harness is the ONE
exception, and only because it never ships.

The failure mode worth naming: putting an alias back into a binding's Vite or
rollup config silently re-inlines the whole engine and stylesheet into
`dist/index.js`, multiplying what ships by ~80, **with every test still green** —
the tests run through the alias either way. What catches it is not a unit test
but the shape of the artefact:

```bash
# The React bundle imports EXACTLY three modules and inlines none of them.
grep -oE 'from ?"[^"]+"' packages/react/dist/index.js | sort -u
#   from "@dataflow-animator/core"
#   from "react"
#   from "react/jsx-runtime"

# Symbols that exist ONLY in the core must be absent here (all must print 0).
grep -c requestAnimationFrame packages/react/dist/index.js
grep -c ResizeObserver        packages/react/dist/index.js
grep -c createPlayerClock     packages/react/dist/index.js

ls packages/react/dist   # index.js, index.d.ts, index.js.map — no style.css
```

Do NOT use an `rdfa-` class name as the canary **for the React bundle**:
`DataFlowPlayer.tsx` renders its own `rdfa-player` / `rdfa-stage rdfa-fallback`
placeholder before mount, so those strings legitimately appear there and prove
nothing.

For the **element** bundle the probe is stronger, because that package renders no
markup of its own — so `rdfa-` IS a valid canary, and the import list is a single
entry:

```bash
grep -oE 'from ?"[^"]+"' packages/element/dist/index.js | sort -u
#   from "@dataflow-animator/core"        ← and nothing else

grep -c 'rdfa-'               packages/element/dist/index.js   # 0
grep -c createPlayerClock     packages/element/dist/index.js   # 0
grep -c requestAnimationFrame packages/element/dist/index.js   # 0

ls packages/element/dist   # index.js (~6.5 kB), index.d.ts (~4.5 kB), index.js.map
```

`npm run smoke:consumer -w @dataflow-animator/element` runs every one of those
checks, so the probe is a script rather than a paragraph someone has to remember.

### The Angular package (ng-packagr / Angular Package Format)

`npm run build -w @dataflow-animator/angular` is `ng-packagr -p ng-package.json -c
tsconfig.lib.json`. Four things about it are not obvious and are easy to undo:

1. **`compilationMode: "partial"` is mandatory**, in
   `tsconfig.lib.json`'s `angularCompilerOptions`. Left at its default with a
   hand-written tsconfig, ng-packagr compiles in FULL mode and writes a
   `prepublishOnly` into the emitted manifest that hard-fails `npm publish`
   ("Trying to publish a package that has been compiled in full compilation
   mode"). Partial mode is what lets a consumer's own Angular version link the
   component. The probe: `ɵɵngDeclareComponent` present, `ɵɵdefineComponent`
   absent, no `scripts` in the emitted manifest.
2. **The package is `dist/`, not the workspace root.** ng-packagr GENERATES the
   published `package.json` (its own `exports`, `module`, `typings`,
   devDependencies stripped) and copies `README.md` and `LICENSE` in. So the
   package has no `files`/`exports` of its own, and `npm pack` must run in
   `dist/` — unlike react and element, which pack from their workspace root.
3. **`allowedNonPeerDependencies: ["@dataflow-animator/core"]`** in
   `ng-package.json`. Without it ng-packagr refuses a runtime `dependency`
   outright. Angular itself stays a peer dependency.
4. **`angular.json` is not the build.** It exists only for `ng test`
   (`@angular/build:unit-test`), which needs a build target to read its options
   from — hence a target named `unit-test-build` rather than `build`, so nobody
   mistakes it for the thing that produces the package.

The artefact probe, adapted (and it needs adapting — see the last two lines):

```bash
cd packages/angular/dist
grep -E "^import .* from '" fesm2022/*.mjs    # only @angular/{core,common}, @dataflow-animator/core, tslib
grep -c "ɵɵngDeclareComponent" fesm2022/*.mjs # 1  (partial)
grep -c "ɵɵdefineComponent"    fesm2022/*.mjs # 0  (not full)
grep -c createPlayerClock      fesm2022/*.mjs # 0
find . -name '*.css' | wc -l                  # 0
```

Two false positives are specific to this package, and both come from the same
cause: **ng-packagr preserves JSDoc**, so the bundle contains this package's own
prose. A bare `grep rdfa-` matches three doc comments, and a bare `grep "from '"`
matches an import statement quoted in an example. Anchor the import probe to the
start of a line, and use a QUOTED canary (`'rdfa-`) for the engine — a class name
the renderer emits is a string literal, a class name in a comment is not. The
React bundle has the same trap for a different reason (its pre-mount placeholder),
so the rule generalises: probe the code, not the prose.

`npm run smoke:consumer -w @dataflow-animator/angular` runs all of it, then does
the thing only an external consumer can do: installs both tarballs into a real
Angular CLI workspace and runs **`ng build` (AOT, production)**. That build is
where the consumer's compiler links the partial-compiled component — the one step
nothing in this repository can stand in for — and it finishes by rendering the
built app headlessly to confirm a `.rdfa-player` with a real size, which also
proves the core's `./styles.css` export resolved through `angular.json`.

In-repo, `tsc` and vitest both resolve the core to its SOURCE, so there is no
build-order coupling and a core edit is visible immediately. That leaves one
thing unverified in-repo — whether the core's flattened `dist/index.d.ts` really
exposes what each binding's `src` imports — and it is checked where it belongs:
on the real tarballs, by the external consumer smoke test (see below).

## Adding a new component

### New action type

1. Add the type in `types.ts` (`ActionType`) and the enum in `schema.ts`.
2. Add a clip variant in `engine/timeline.ts` (`Clip` union)
   with its `keep_until_next` default and its default duration in
   `engine/compiler.ts`, and a `case` in `compileAction`. Export the new clip
   type from `core/src/index.ts` alongside its siblings — the union is public,
   so a member that cannot be named is a hole in the API.
3. Render the clip in `dom/mount.ts` (`active` filter on `kind`), splitting the
   work between a `create` and an `apply` as every other layer does.
4. `.rdfa-…` styles in `core/src/styles/dataflow.css`. Test in
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
npm run build       # full build (all three packages, then the site)
npm run build:lib   # the core, then the React binding, then the element
npm run build:docs  # only the site
```

`build:lib` builds the core FIRST, and that build starts with `tsc` on
`packages/core` with its OWN tsconfig: core sources are otherwise only
typechecked as part of a binding's program (vitest does not typecheck), whose
compiler options differ — errors valid only under core's stricter standalone view
would stay invisible.

### The core package build (`packages/core`'s `build` script)

1. `rm -rf dist` — same reason as below: `vite build` does not clean between
   runs, and an orphan in `dist/` would ship.
2. `node scripts/generate-schema.mjs` — the schema is regenerated from
   `types.ts` before anything consumes it.
3. `npm run typecheck` (`tsc -p tsconfig.json`, `noEmit`) — the isolated view.
4. `vite build` — ESM bundle + `dist/styles.css`. The stylesheet is EXTRACTED,
   not injected: `dist/index.js` carries no CSS import, so a consumer must
   `import '@dataflow-animator/core/styles.css'` explicitly. `prismjs` is
   external (a runtime `dependency`); `react-icons` is not, because no `src/`
   file imports it — it feeds the glyph generator only, and its geometry is
   already committed in `subIconData.generated.ts`.
5. `rollup -c rollup.dts.config.mjs` — flattens the declarations into a single
   self-contained `dist/index.d.ts`. A plain `tsc` build would emit one `.d.ts`
   per source file, stitched together by relative imports into `src/`, which is
   not in `files`.
6. `postbuild`: copies `src/schema.generated.json` to `dist/schema.json`.

Result in `packages/core/dist/`: `index.js`, `index.d.ts`, `styles.css`,
`schema.json`. `exports` publishes them as `@dataflow-animator/core`,
`@dataflow-animator/core/styles.css` and `@dataflow-animator/core/schema.json` —
nothing else. The source subpaths the workspace used to expose are gone: they
pointed into `src/`, which is not published, and every in-repo consumer resolves
through the alias instead.

`packages/core/src/index.ts` is the package's semver surface. Adding an export
there is a public commitment; the renderer's plumbing (`el.ts`, `reconcile.ts`,
`settle.ts`, `geometryTracker.ts`, the circuit router…) deliberately stays out of
it, and the harness reaches it through the source alias rather than through a
published subpath.

### The React package build (`packages/react`'s `build` script)

1. `rm -rf dist` — a plain `vite build` does not clean `dist/` between runs,
   so a file removed from the bundle would linger as an orphan in a stale
   `dist/` (e.g. leftovers from a since-removed video-export feature). The
   build always starts from a clean slate.
2. `node ../core/scripts/generate-schema.mjs` — regenerates
   `packages/core/src/schema.generated.json` from `packages/core/src/types.ts`
   before anything else consumes it.
3. `tsc -b tsconfig.app.json tsconfig.node.json` — typecheck. `tsconfig.app.json`
   resolves the core to `../core/src` via `paths`, so this single program also
   typechecks every core file the package actually imports.
4. `vite build` — ESM bundle, and **nothing else**: no CSS is emitted because no
   source file imports one. `@dataflow-animator/core` is in
   `rollupOptions.external`, so `dist/index.js` carries
   `import { mountPlayer, … } from "@dataflow-animator/core"` instead of a copy
   of the engine.
5. `rollup -c rollup.dts.config.mjs` (`rollup-plugin-dts`) — bundles this
   package's OWN declarations into `dist/index.d.ts`, with the core listed as
   `external` so its types are **referenced by import, not inlined**. That is the
   opposite of what this step did while the core was inlined, and it is what
   makes a consumer resolve one set of spec types no matter which package they
   import from. The result is ~6 kB instead of ~106 kB of copied declarations.

Result in `packages/react/dist/`: `index.js`, `index.d.ts` (+ the source map).
No `style.css`, no `schema.json` — both belong to the core, and `exports` now
lists only `.` and `./package.json`.

`react` and `react-dom` are in `peerDependencies` (externalized from the bundle).
`@dataflow-animator/core` is a real `dependency` at `^1.0.0` — a resolvable range,
not `"*"`, so an installer outside this monorepo gets a version. In-repo, npm
workspaces satisfies that range with the local symlink. `prismjs` is NOT a
dependency here: no file in `src/` imports it, and the core already declares it,
so it arrives transitively.

### The element package build (`packages/element`'s `build` script)

`rm -rf dist` → `tsc -p tsconfig.json` (`noEmit`) → `vite build` →
`rollup -c rollup.dts.config.mjs`. Same shape and same reasons as the React
binding's, minus the schema step (nothing here reads the schema) and with the
core's `paths` pointing at `../core/src` so this program also typechecks every
core file the element touches.

Result in `packages/element/dist/`: `index.js` (~6.5 kB), `index.d.ts` (~4.5 kB),
`index.js.map`. `exports` lists only `.` and `./package.json` — no
`./styles.css`, because the CSS belongs to the core.

Three things about this manifest are load-bearing:

- **`"sideEffects": ["./dist/index.js"]`**, not `false`. Importing the barrel
  REGISTERS `<dataflow-player>`; with `sideEffects: false` a bundler would be free
  to drop a bare `import '@dataflow-animator/element'` entirely and the tag would
  simply never exist. The React package can say `false` because its entry only
  exports values.
- **`@dataflow-animator/core` at `^1.0.0`** — a resolvable range, for the same
  reason as above. `prismjs` is external in the Vite config even though nothing
  here imports it, so a future indirect reach for it cannot get inlined.
- **No `resolve.alias`** in `vite.config.ts`, with the comment explaining that the
  absence is the point. See
  [Two ways to consume the core](#two-ways-to-consume-the-core).

The element's own design constraints are documented where they live, but two are
worth naming here because they are easy to undo by accident:

- `class X extends HTMLElement` evaluates its base **at import**, so the class
  extends a conditional `ElementBase` instead — otherwise importing the package in
  an SSR bundle throws on the import line, before anyone asks to mount anything.
  `ssr.test.ts` runs in the `node` environment precisely to prove this, and no
  mock can replace it.
- `customElements.define` throws when a **constructor** is already registered, so
  `defineDataFlowPlayer(tag)` registers a _subclass_ for any tag after the first.
  Without that, the first call after the barrel's auto-registration would throw.

### Two non-additive lists to keep in sync

Both the Vite watch config and the TS include list narrow to an explicit file
set as soon as one entry is set — adding a new path without updating these
silently stops covering it:

- `vite.config.ts`'s `build.watch.include` (used by `npm run dev` /
  `vite build --watch`) lists `src/**/*` only. It must NOT list `../core/src` any
  more: the core is external, so its sources cannot affect this bundle. It has
  its own `npm run dev -w @dataflow-animator/core` watcher, and the docs site
  watches both dists (see `watchLibPlugin` in `docusaurus.config.ts`, whose regex
  covers both packages for exactly that reason).
- `tsconfig.app.json`'s `include`: must list `../core/src/**/*.d.ts` alongside
  `src`. Ambient `.d.ts` files (e.g. Prism's typing) that live in core have
  no `import` statement pulling them in transitively through `paths`, so `tsc`
  only picks them up if they're named explicitly here.
  `packages/element/tsconfig.json` carries the same pair of entries, for the same
  reason.

The core's own programs need the same care: `tsconfig.json` and
`tsconfig.dts.json` both `include: ["src"]`, which covers
`src/highlight/prism-ambient.d.ts` and `src/css.d.ts` — the two ambient
declarations nothing imports. Narrowing either `include` to a file list would
drop them silently.

## Tests and quality

| Command (root)          | Effect                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm run lint`          | Lint workspaces that expose a lint script (`core`, both bindings, docs)                |
| `npm run format:check`  | Checks Prettier formatting                                                             |
| `npm run format:write`  | Applies Prettier                                                                       |
| `npm test`              | vitest tests of `core`, `react` and `element`                                          |
| `npm run test:coverage` | Tests + per-workspace coverage report (each package has its own threshold)             |
| `npm run deadcode`      | knip — dead code detection across all workspaces                                       |
| `npm run check:schema`  | Verifies `packages/core/src/schema.generated.json` is committed & fresh                |
| `npm run build`         | Full build (all three packages — the core's build typechecks it in isolation — + docs) |

On the React side, two vitest configurations coexist: `vitest.config.ts`
(unit, under `src/**/*.test.{ts,tsx}`) and `vitest.integration.config.ts`
(integration tests on demos). Both keep the source alias, which is how they can
run without either package having been built. `packages/core` and
`packages/element` each have their own `vitest.config.ts` with a separate coverage
threshold — `npm test`/`npm run test:coverage` at the root fan out to all three
workspaces.

`packages/element` runs in the `node` environment by DEFAULT and opts individual
files into jsdom with a per-file directive. That is not a style choice:
`ssr.test.ts` needs an environment where `HTMLElement` and `customElements` are
genuinely absent, which is the only way to prove the package can be imported
server-side. The cost is that v8 does not merge that file's coverage back into the
jsdom run of the same source, which is why the branch threshold sits at 96 rather
than 100 — the two uncovered arms are precisely the SSR halves.

### The external consumer smoke test

Because everything in-repo resolves the core to source, no in-repo check proves
the tarballs actually work together once installed. For the element that proof is
**scripted**:

```bash
npm run smoke:consumer -w @dataflow-animator/element   # add `-- --keep` to inspect the temp project
```

It builds and packs `@dataflow-animator/core` + `@dataflow-animator/element`,
installs both from tarballs in a throwaway project outside the monorepo (with an
`overrides` entry pinning the core to its local tarball, so npm never tries the
registry), then runs:

- the **publish-shape** checks — the artefact probe above, no `.css` in the
  tarball, `dist/index.js` marked as having side effects, the core declared as a
  real semver range, and a declaration that _references_ the core's types instead
  of inlining them;
- a **mount test** (vitest + jsdom) that imports the element and
  `@dataflow-animator/core/styles.css` by name, places a `<dataflow-player>` with a
  spec and checks it renders and then tears down — the only place the core's
  published `exports` map is genuinely resolved;
- `tsc --noEmit` with `skipLibCheck: false` on a consumer file that uses the
  element, its properties and the re-exported spec types, which typechecks the
  published declarations themselves.

Run it before any publish, and publish the core BEFORE the bindings.

For the React binding the same proof is still a manual step:

```bash
npm pack -w @dataflow-animator/core -w @dataflow-animator/react --pack-destination /tmp/smoke
```

then, in a throwaway project OUTSIDE the monorepo, install both tarballs (with an
`overrides` entry pinning the core to its local tarball, so npm never tries to
resolve it from the registry), import `DataFlowPlayer`, `NodeView`,
`registerNodeIcon`, `compile`, `evaluate` and `dataFlowSchema` from
`@dataflow-animator/react` plus `@dataflow-animator/core/styles.css`, and run
`tsc --noEmit`. That single command exercises what nothing else does: the core's
published `exports` map, its flattened declarations, and the React package's
declared dependency range. `packages/element/scripts/smoke-consumer.mjs` is the
template for scripting it, and doing so is the obvious next cleanup.

## Deployment

`.github/workflows/ci-cd.yml` runs schema freshness, Prettier, ESLint, knip,
unit + integration tests and the library build (which typechecks core in
isolation) on every push / PR, then builds and deploys the Docusaurus site on
GitHub Pages on the `main` branch. It calls root scripts only, so it needed no
change when the core gained a build of its own, nor when the element was added:
`lint`, `test:coverage` and `build:lib` fan out to every workspace on their own.
The npm publication of all three packages remains manual — verify each tarball
with `npm pack --dry-run` first, run
`npm run smoke:consumer -w @dataflow-animator/element`, and publish the core
BEFORE the bindings, which depend on it.
