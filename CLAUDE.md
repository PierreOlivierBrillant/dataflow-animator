# CLAUDE.md

Instructions for Claude (and any other agent) working on this repository.

## Project overview

`@dataflow-animator/core` compiles a JSON specification into a deterministic, scrubbable animation of data flows, and mounts it with no framework at all. Three published bindings wrap that same call: `@dataflow-animator/react` (`<DataFlowPlayer>`), `@dataflow-animator/element` (`<dataflow-player>`) and `@dataflow-animator/angular` (`<dfa-player>`).
The engine is a pure function `evaluate(timeline, t)`: no DOM, no real clock, backwards scrubbing comes for free.

The repository is an **npm workspaces monorepo**:

```text
packages/core/                      @dataflow-animator/core — the PUBLISHED framework-agnostic
                                     package: spec types, JSON Schema, the pure engine,
                                     TeX/highlight, JSON export, the DOM renderer and its
                                     stylesheet. Usable on its own, and the common
                                     dependency of every framework wrapper
packages/react/                     @dataflow-animator/react — the published React binding.
                                     DEPENDS on @dataflow-animator/core (externalised, not
                                     inlined): it ships neither the engine nor the CSS
packages/element/                   @dataflow-animator/element — the published custom element
                                     <dataflow-player>, LIGHT DOM. Same dependency pattern as
                                     react: no engine, no CSS. Importing its barrel REGISTERS
                                     the tag, so it is the one package with side effects
packages/angular/                   @dataflow-animator/angular — the published Angular binding,
                                     the standalone <dfa-player>. Same dependency pattern again:
                                     no engine, no CSS. The one package with a FOREIGN toolchain
                                     — ng-packagr (Angular Package Format) instead of Vite, and
                                     `ng test` instead of a bare vitest
apps/docs/                          Docusaurus site (demos, playground, API docs)
docs/                               SPEC.md, ARCHITECTURE.md (internal references)
```

## Documentation to consult before acting

Read these files before any non-trivial modification:

- [`README.md`](./README.md) — user-facing view of the library.
- [`docs/SPEC.md`](./docs/SPEC.md) — functional specification (source of truth for expected behaviors).
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — module boundaries, rendering pipeline, extension points.
- [`docs/AI-VALIDATION.md`](./docs/AI-VALIDATION.md) — how to get rendering (clarity/smoothness) validated by an AI via the deterministic harness and Playwright visual regression.
- [`docs/SEARCH.md`](./docs/SEARCH.md) — Algolia DocSearch indexing model (how playground examples are indexed; crawler `recordExtractor` reference).
- [`apps/docs/docs/`](./apps/docs/docs/) — MDX user documentation (concepts, references).
- [`packages/core/src/types.ts`](./packages/core/src/types.ts) and [`schema.ts`](./packages/core/src/schema.ts) — exact shape of the spec (source of truth; `packages/react/src/types.ts` re-exports them for the React binding).
- [`packages/element/README.md`](./packages/element/README.md) — the custom element's public API (attributes, properties, events, the boolean/absence rule).
- [`packages/angular/README.md`](./packages/angular/README.md) — the Angular component's public API (selector, inputs, outputs, the same absence rule).

## Hard rules before every commit

**You MUST execute this sequence from the root and get a full success before proposing a commit.** You cannot mark a task as completed if any of these checks fail.

```bash
npm run format:check     # Prettier
npm run lint             # ESLint on all workspaces
npm run deadcode         # knip: dead code / unused exports
npm run test:coverage    # vitest + coverage thresholds
npm run build            # build lib + site (typecheck included)
npm run test:integration -w @dataflow-animator/react
npm run test -w @dataflow-animator/docs   # docs unit tests (schema-validate every demo, both locales)
npm run check:schema
npm run check:subicons   # generated sub-icon glyph data is fresh
```

**If you touched `package.json` or the lockfile, run `npm ci` (not `npm install`)
and rerun `test:coverage` before believing any of it.** `packages/angular` pins
**vitest 4** while core/react/element are on **vitest 3** — npm nests the two
correctly, but the package at risk from a re-hoist is never the one you edited, it
is its neighbours. `npm ci` is what CI does; `npm install` can paper over a lock
that `npm ci` would reject.

### What to do in case of failure

- **`format:check`** fails → run `npm run format:write` then stage the introduced diff; do not mix it with logical changes.
- **`lint`** fails → fix the warnings instead of ignoring them. Do not add `eslint-disable` without a real justification (a comment explaining why).
- **`deadcode`** fails → either remove the dead code, or add it to `ignoreExports` in `knip.json` if it's an intentional public export, with a comment.
- **`test:coverage`** fails on thresholds → add tests, do not lower thresholds without explicit user agreement.
- **`build`** fails → fix before proposing the commit. A broken build is never mergeable.

## Hard rules before every PUBLISH

Everything above, plus the two gates that exercise the packages the way a
STRANGER gets them — from a tarball, outside this monorepo, with the alias gone
and only the published `exports` left:

```bash
npm run smoke:consumer -w @dataflow-animator/element   # packs core + element, mounts them in a throwaway project
npm run smoke:consumer -w @dataflow-animator/angular   # packs core + angular, AOT-builds a real Angular CLI app
npm run harness:selftest -w @dataflow-animator/react   # 144 checks, must be 0.00%
npm run harness:element  -w @dataflow-animator/react   # 70 cells, must be 0.0000%
npm run test:visual -w @dataflow-animator/react        # goldens
```

These are the ONLY checks that can catch a broken `exports` map, a re-inlined
core, or a `files` list missing the LICENSE — every in-repo test resolves the
core through the source alias and would stay green through all three. They are
slow (the Angular one installs a whole CLI app), which is why they are not in
the per-commit list; skipping them before a publish is not an option.

**The publish itself is `.github/workflows/release.yml`, driven by a tag.** It
reruns everything above (including both `smoke:consumer` gates), asserts the tag
matches all four manifests, then publishes with `npm publish --provenance` —
core first, because the three bindings declare a dependency on a version that
has to exist. Never `npm publish` by hand from a working tree: the workflow is
what makes the tarball attributable to a commit.

To cut a release:

1. `npm view @dataflow-animator/<pkg> version` — confirm what is already out.
2. Bump the four `version` fields **together** (the bindings' `dependencies` on
   `@dataflow-animator/core` too), date the `## x.y.z` heading in `CHANGELOG.md`,
   and run the per-commit sequence.
3. Merge, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

The workflow needs an `NPM_TOKEN` secret and an `npm` GitHub environment — add a
required reviewer on that environment if you want a human approval between the
green gates and the irreversible publish. `publishConfig.access` is `public` in
all four manifests; without it npm refuses a scoped package on a free account.

**The token must be a granular access token with `Bypass 2FA` enabled.** Classic
"automation" tokens no longer exist (npm removed them in November 2025), and a
granular token without that setting makes the publish step fail with `EOTP`,
after the gates have run — the account's 2FA applies to a token that does not
opt out of it.

That is a stopgap with a deadline: npm removes direct publishing from
bypass-2FA tokens in **January 2027**. The replacement is **trusted publishing**
(OIDC), which needs no token at all and generates provenance on its own. It
cannot bootstrap this repository, though: npm requires a package to EXIST before
its trusted publisher can be configured, so the first version of a new package
has to go out on a token. Once all four are on the registry, configure a trusted
publisher per package on npmjs.com, then drop `NODE_AUTH_TOKEN` and
`--provenance` from the workflow.

`packages/angular` publishes its **`dist/`**, not its source directory — that is
where ng-packagr writes the Angular Package Format output. The other three
publish the workspace itself.

## Code conventions

- **English for code and technical docs.** ALL code comments (`//`, `/* */`, JSDoc) and ALL internal documentation — `README.md`, `docs/*.md`, this `CLAUDE.md` file, commit messages — must be written in English. Never introduce new comments or new docs in French. **Exception (do not confuse):** the _user-facing_ content of the `apps/docs` site remains bilingual EN/FR via native i18n (see the "Internationalization" section below) — the French half (`src/i18n/fr.ts`, `i18n/fr/**`, the `fr:` of demo specs) is NOT code to "switch to English", it is the intentional translation.
- **Strict TypeScript.** No `any`. If you need an `as unknown as X`, write a comment explaining why.
- **`packages/core` must never import `react`**, not even in `import type`. It is a PUBLISHED
  framework-agnostic package, consumed directly by callers with no framework and by wrappers for
  frameworks other than React — a React import there would land in every one of their bundles.
  Precedent: `nodeColors`'s `nodeTint` returns `Record<string, string>` rather than
  `React.CSSProperties`; the React package casts at the call site instead. If a helper needs a
  React-specific type, it belongs in `packages/react/src`, not in core.
- **Four public APIs, four semver surfaces.** `packages/core/src/index.ts` is as public as
  `packages/react/src/index.ts`, `packages/element/src/index.ts` and
  `packages/angular/src/index.ts`: no breaking change to any of
  them without a major version and documentation. For the element, the ATTRIBUTE and PROPERTY names
  are part of that surface too — renaming `auto-play` is a breaking change even though no TS type
  moves. Same for the Angular component's SELECTOR, INPUT and OUTPUT names, and for its
  `peerDependencies` range on `@angular/core`. Anything added to the core's barrel is a promise — the renderer's
  plumbing (`el.ts`, `reconcile.ts`, `settle.ts`, `geometryTracker.ts`, the circuit router…) stays
  out of it deliberately, and the harness reaches it through the source alias, not a published
  subpath.
- **Every binding's `src` imports the core's TOP-LEVEL barrel only.** Never
  `@dataflow-animator/core/dom/player` or any other subpath: those resolve in this monorepo (the
  alias short-circuits `exports`) and fail for everyone who installs the package, since the
  published `exports` lists only `.`, `./styles.css` and `./schema.json`. If the barrel is missing
  something `src/` needs, add it to the core's barrel — that is a deliberate public commitment,
  not a workaround. The harness is the ONE exception, and only because it never ships.
- **Tests first** for uncovered areas you are going to refactor.
- **Comments**: describe the _why_, not the _what_. The code is enough to say what it does. A comment explaining an avoided pitfall (e.g. Babel loose mode in Docusaurus) is precious; a comment that paraphrases the next line is not.
- **SSR-safe**: no `window` / `document` / `requestAnimationFrame` access outside of a `useEffect` or `useLayoutEffect`. Check before proposing.
- **Spec and related types**: the JSON schema is GENERATED from `types.ts` (`npm run generate:schema`, verified by `check:schema`). If you modify `types.ts`, regenerate the schema — never edit it by hand. NB: the `scripts/schema-patches.mjs` patch makes the schema stricter than the TS types for `language` (intended).
- **Document any spec evolution.** As soon as you add, modify, or remove a field, an action type, an enum value, or a default value in `types.ts`, you MUST reflect the change in the docs, in the same commit:
  - `docs/SPEC.md` (functional source of truth);
  - the relevant MDX user doc under `apps/docs/docs/` (concept or reference), with **at least one concrete example** in the existing style (see the orientation tabs and co-located examples `_folder/*.ts`);
  - the links in `intro.mdx` and the `sidebars.ts` if you create a page.

  A PR that changes the spec without touching the docs is incomplete. The "API Reference" page is generated from the schema, but does NOT replace a prose explanation + example: the schema alone does not document the intent.

## Fix the root cause, not just the symptom (patch vs. redesign)

Before coding the shortest fix, ask yourself if the local problem is actually a symptom of a structure that no longer holds up. On a product built incrementally, stacking punctual patches accumulates edge cases that end up costing more than the debt they claimed to avoid. **Systematically evaluate if a more global solution — a small redesign of the affected area — would fix the root cause rather than masking the symptom**, and make that the basis of your proposal.

Signals that a scoped redesign is better than yet another patch:

- you are adding a **3rd edge case** (`if`/override/exception) to a place that already has some;
- two elements must remain **manually synchronized** (same coordinates, same duplicated values) instead of deriving from a single source — see the redesign of the `subicon` badge + spinner into a common container;
- a fix only has an effect by **compensating** for another module instead of fixing it where the decision is made;
- you are fighting against the existing structure (increasingly specific selectors, compensation margins, `!important`...).

Guardrails — the rule is NOT "redesign often":

- **Stay within the scope.** The redesign covers the area the task touches, not an opportunistic refactor of the neighborhood.
- **No stealth breaking changes.** Respect the rule on the public API; a redesign that modifies it follows the procedure (major version + doc).
- **Propose before executing large ones.** A contained change (like the badge), you can carry out then present. As soon as it spills over multiple modules, the public API, or the spec, **expose the option and its cost to the user** before committing — do not stealthily overhaul a large surface area.

## Internationalization (i18n) — EVERY string must be translated

The `apps/docs` site is bilingual **English (source, `/`) / French (`/fr/`)** via **native** Docusaurus i18n (see memory/`docusaurus.config.ts`). **Hard rule: all user-visible text MUST exist in both languages** — including the text _inside the example specs_ (node labels, timeline comments, packet headers/bodies, `set_content`...). An identical FR/EN string is only tolerated for a true language invariant (proper noun, technical identifier: `parallel`, `GET`, `SQL`, `npm`...).

Depending on the location, the mechanism differs:

1. **UI (React components / pages)** → `src/i18n/fr.ts` dictionary (SOURCE of truth, `type Messages = typeof fr`) + `src/i18n/en.ts` (same keys, otherwise TS error). In the component: `const t = useTranslation();` then `t.section.key`. Never hardcode French in the JSX.
2. **Demo specs** (`src/site-content/demos/*.ts`) → exports a `(locale: Locale) => DataFlowSpec` builder with a `const strings = { en, fr }` table and rebuilds the spec via `s = strings[locale]`. **Reference: `demos/clientServer.ts`.** As long as a demo is not translated, it can remain a `DataFlowSpec` object (FR in both languages); the `getSpec(demo, locale)` resolver accepts both forms.
3. **Demo metadata** (`demos.ts`) → `Localized<T> = { fr: T; en?: T }` (FR fallback via `pickLocale`). `category` = stable KEY; displayed labels are translated in `gallery.categories`.
4. **MDX docs** → English is the SOURCE in `docs/*.mdx`; French lives in `i18n/fr/docusaurus-plugin-content-docs/current/*.mdx`. Exception: `intro.mdx` renders `<IntroDoc>` which self-localizes (no i18n/fr copy).
5. **API Reference** (`docsContent.tsx`, `apiExamples.ts`) → same rules: prose and `note:`/`text:` of examples go through the dictionary / a localized table, no hardcoded French.
6. **CSS `content:` labels** (the docs sidebar and TOC headings in `custom.css`) → the stylesheet reads `var(--rdfa-docs-*-title)`, and the `rdfa-docs-chrome-labels` plugin in `docusaurus.config.ts` injects those custom properties per locale from the SAME dictionary. Never write a literal string in a `content:` — it would ship in one language on both sites. The indirection exists because those two boxes belong to Docusaurus components no wrapper can reach (a heading rendered around `@theme/TOC` lands outside its sticky container), and because Docusaurus only serializes Helmet's title/meta/link/script into the static HTML, so a `<style>` in `<Head>` would appear only after hydration.

The current locale for content (specs, localized fields) is obtained with `useLocale()` (`src/i18n`).

**Verification (mandatory when you touch i18n):**

- `cd apps/docs && npx tsc --noEmit` — the Docusaurus build does NOT type-check; it's this `tsc` that catches an `en.ts` misaligned with `fr.ts` and type errors. Run this before considering an i18n task complete.
- `npm run build:docs && (cd apps/docs && npx docusaurus serve)` — test both locales as in prod (`docusaurus start` only serves one).
- Hunt for residual French: `grep -rnE "[éèàçœêîôûù]" apps/docs/src/components apps/docs/src/pages` (excluding `fr.ts`, comments) should return nothing user-visible.

## Vigilance points (from code reviews)

Pitfalls already encountered in this repo — check them when you touch the affected area (case details are in `todo.md` as long as it exists):

- **No dead IR fields**: any data computed by the compiler must be consumed by the renderer, otherwise deleted. Do not export an unhooked API.
- **DOM measurement**: a ResizeObserver only sees resizes, never displacements — a spec edit that MOVES nodes without changing any size is invisible to `geometryTracker`. What covers it is that the spec is frozen for the lifetime of a mount (`mountStage` closes over it, `update(t)` only moves time) and that every wrapper remounts on a STRUCTURAL key over the WHOLE spec (`serializeSpec`). Keep that key whole: narrowing it to the fields believed to influence position puts the burden back on a hand-maintained list. The observer's OTHER blind spot is the ancestor `transform: scale(...)` (a modal animating in): it reports the untransformed border box, so it never fires, while every `getBoundingClientRect` under it comes back multiplied — which is why `measure()` divides each reading by rect ÷ `offsetWidth` and publishes LAYOUT pixels. Never reintroduce a raw rect there.
- **Consistent units in geometry**: horizontal/vertical decisions and offsets are taken in measured pixels, not in 0..1 ratios (or else by correcting by the Stage aspect). Two modules that decide differently contradict each other on non-square stages.
- **rAF loops**: cap the time delta (inactive tab → huge `dt` upon return).
- **Dual paths**: if a function has an optimized path and a fallback (e.g. `evaluate`), a test must prove their equivalence — the prod path is not necessarily the one tests exercise.
- **npm publication**: before any `npm publish`, verify the tarball with `npm pack --dry-run` (LICENSE present, `files`/`exports` correct). Two packages ship now — check both.
- **The core is consumed TWO ways, and they must not cross**: the harness/vitest/`tsc` resolve `@dataflow-animator/core` to `../core/src` through an alias (the only way to reach the deep subpaths the harness needs, which the published `exports` does not list); the LIBRARY BUILDS externalise it instead — `packages/react/vite.config.ts` and `packages/element/vite.config.ts` have NO `resolve.alias` on purpose. Re-adding one there silently re-inlines the whole engine into `dist/index.js` **with every test still green**. What catches it is the artefact. For react the probe is the import list — `grep -c "rdfa-stage"` is a FALSE POSITIVE there, since `DataFlowPlayer.tsx` renders its own placeholder; for the element, which renders nothing of its own, `grep -c 'rdfa-' packages/element/dist/index.js` must be `0`. `npm run smoke:consumer -w @dataflow-animator/element` runs the whole probe. See ARCHITECTURE.md, "Two ways to consume the core".
- **The stylesheet ships once, from the core**: `packages/core/src/styles/dataflow.css` → `@dataflow-animator/core/styles.css`. Neither binding emits CSS nor exposes a `./styles.css`; consumers (the docs site's `custom.css` included) import the core's. Edit the one source file; never fork it. This is also why `<dataflow-player>` is light DOM: a global stylesheet cannot cross a shadow boundary, so encapsulating would force the element to carry its own copy.
- **The custom element's four easy-to-undo invariants** (`packages/element`):
  - `"sideEffects": ["./dist/index.js"]`, never `false` — the barrel REGISTERS the tag, and `false` lets a bundler drop a bare `import '@dataflow-animator/element'` entirely;
  - the class extends a conditional `ElementBase`, not `HTMLElement` directly — `extends` evaluates its base AT IMPORT, so a direct extend throws in any SSR bundle. `src/ssr.test.ts` runs in the `node` environment to prove it, which is why the package's default vitest environment is `node` and jsdom is opted into per file;
  - `defineDataFlowPlayer(tag)` registers a SUBCLASS for any tag after the first — `customElements.define` throws when a constructor is already registered;
  - **an absent boolean attribute is NOT `false`**, it is "unspecified" → the core's default. The core defaults `controls` to `true`, so writing no key into the options object is the whole mechanism. Never write a default in the wrapper; it would drift from the core's.
- **The element mounts on a coalesced microtask, always** — the first mount included. Anything that reads the player after inserting the tag (a test, the pixel gate, a consumer) waits for the `dataflow-player:mounted` event, never a timeout: a timeout hides exactly the race it appears to fix.
- **The Angular package's own easy-to-undo invariants** (`packages/angular`):
  - **`compilationMode: "partial"`** in `tsconfig.lib.json`. Its default with a hand-written
    tsconfig is FULL mode, which makes ng-packagr write a `prepublishOnly` that hard-fails
    `npm publish`. The probe is `ɵɵngDeclareComponent` present / `ɵɵdefineComponent` absent;
  - **`NgZone.runOutsideAngular` around `mountPlayer`** — without it the rAF clock triggers change
    detection every frame. `src/zone.spec.ts` proves it, and the proof only works because the test
    uses `provideZoneChangeDetection()` and triggers CD inside `zone.run(...)`. Under the DEFAULT
    TestBed the assertion passes with the call removed — green, proving nothing. Never assert on a
    `runOutsideAngular` spy's call count either: Angular calls it itself;
  - **`isPlatformBrowser` guards every DOM touch**, the `display: contents` fix-up included;
  - **the spec input is keyed by `serializeSpec`, not by identity** — `[spec]="buildSpec()"` yields a
    new object per change-detection pass, so keying on the object remounts forever;
  - **no `styles:` on the component, ever.** A one-line `:host {}` would put CSS in the published
    package and break "the stylesheet ships once, from the core";
  - **`tsconfig.lib.json` has no `paths`** while `tsconfig.spec.json` does. That asymmetry IS the
    dual consumption for this package (build → node_modules, tests → source). Adding a `paths` entry
    to the lib config would hide the published `exports` from the only thing that exercises it;
  - the JSDoc survives into the fesm bundle, so `grep rdfa-` and `grep "from '"` on it are FALSE
    POSITIVES — probe quoted strings and line-anchored imports (`smoke-consumer.mjs` does).
- **Two vitest majors coexist**: 4 in `packages/angular` (required by `@angular/build`), 3 everywhere
  else. npm nests them correctly, but after any dependency change run `npm ci` and rerun
  `test:coverage` on core, react AND element — the package a re-hoist breaks is a neighbour, not the
  one you edited.
- **A `dist/index.js` being rewritten is briefly EMPTY**: rollup writes in place, so the file goes
  291522 → 0 → 262144 → 291522 bytes inside one millisecond. Any reader that lands in that window
  sees a module exporting nothing. The React binding re-exports most of its surface from the core, so
  when the core is the torn file, webpack reports every one of those names as
  `not found in '@dataflow-animator/react' (possible exports: DataFlowPlayer, NodeView)` — those two
  being all the binding declares itself. That is why `scripts/dev.mjs` starts the site only after
  both watchers report their first bundle; the fix is a barrier on the watcher's `END` event, never a
  delay. If those warnings ever come back, look for something reading a `dist` concurrently with a
  build — not for a missing export.
- **…and webpack's persistent cache FREEZES that warning**: the tear has to happen only once. Webpack
  snapshots the module it read together with the mtime of the file it read it from — and the torn read
  and the final write share a millisecond, so the recorded timestamp matches the complete file on disk
  forever after. `apps/docs/node_modules/.cache/webpack` then replays
  `export 'dataFlowSchema' … was not found` on every `docusaurus start`, for as long as the cache
  lives, with a `dist` that is provably intact (`grep dataFlowSchema packages/*/dist/index.js`). So the
  warning surviving a restart does NOT mean it is real: check the dist first, and if the exports are
  there, the cure is `npm run clear -w @dataflow-animator/docs`, not a change to any barrel.

## Available scripts (quick reference)

Monorepo root:

| Script                  | Effect                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Builds the libs, then `scripts/dev.mjs`: core + react watchers, and the site only ONCE THEY HAVE WRITTEN their first bundle (see the truncation-window vigilance point). The element is absent on purpose: the site does not consume it |
| `npm run build`         | Full build (all three packages + site)                                                                                                                                                                                                  |
| `npm run build:lib`     | Core build (isolated typecheck included), then react, then element                                                                                                                                                                      |
| `npm run build:docs`    | Site build only                                                                                                                                                                                                                         |
| `npm run lint`          | ESLint on all workspaces that expose it                                                                                                                                                                                                 |
| `npm run format:check`  | Checks Prettier formatting                                                                                                                                                                                                              |
| `npm run format:write`  | Applies Prettier                                                                                                                                                                                                                        |
| `npm test`              | vitest tests of core, react and element (each has its own coverage threshold)                                                                                                                                                           |
| `npm run test:coverage` | Same, with coverage thresholds                                                                                                                                                                                                          |
| `npm run deadcode`      | knip — dead code detection                                                                                                                                                                                                              |
| `npm run check:schema`  | Verifies core's generated JSON Schema is fresh                                                                                                                                                                                          |

Package (`packages/core/` — published as `@dataflow-animator/core`):

| Script                      | Effect                                                         |
| --------------------------- | -------------------------------------------------------------- |
| `npm run build`             | rm -rf dist, schema, typecheck, vite lib build, flattened d.ts |
| `npm run lint`              | ESLint on src/                                                 |
| `npm run typecheck`         | Isolated tsc typecheck (core's tsconfig)                       |
| `npm test`                  | Unit vitest tests                                              |
| `npm run test:coverage`     | Tests + coverage                                               |
| `npm run generate:schema`   | types.ts → schema.generated.json                               |
| `npm run check:schema`      | CI guard: schema.generated.json is fresh                       |
| `npm run generate:subicons` | react-icons glyphs → subIconData.generated.ts                  |
| `npm run check:subicons`    | CI guard: generated sub-icon data is fresh                     |
| `npm run dev`               | vite build in watch mode (the docs site consumes this dist)    |
| `npm run smoke:export`      | Sanity-checks the emitted dist/schema.json                     |

Package (`packages/react/` — published as `@dataflow-animator/react`):

| Script                        | Effect                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| `npm run build`               | Typecheck + vite build + .d.ts declarations                |
| `npm run dev`                 | vite build in watch mode                                   |
| `npm run lint`                | ESLint on src/                                             |
| `npm test`                    | Unit vitest tests                                          |
| `npm run test:coverage`       | Tests + coverage                                           |
| `npm run test:integration`    | Integration tests on demos                                 |
| `npm run harness`             | Visual validation harness (Vite, :5199)                    |
| `npm run curves`              | Headless structural pass (`--demo <id>`)                   |
| `npm run test:visual`         | Playwright visual regression (goldens)                     |
| `npm run harness:selftest`    | A/B gate calibration — 144 checks, must be 0.00%           |
| `npm run harness:element`     | `<dataflow-player>` vs `mountPlayer` — 70 cells at 0.0000% |
| `npm run harness:mountupdate` | `mountStage` + `update(t)` vs a fresh mount at `t`         |
| `npm run harness:bench`       | Perf baseline of the player (per-frame)                    |

Package (`packages/element/` — published as `@dataflow-animator/element`):

| Script                   | Effect                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run build`          | rm -rf dist, typecheck, vite lib build, thin d.ts referencing the core            |
| `npm run dev`            | vite build in watch mode                                                          |
| `npm run lint`           | ESLint on src/                                                                    |
| `npm run typecheck`      | Isolated tsc typecheck (core resolved to source via `paths`)                      |
| `npm test`               | Unit vitest tests (`node` by default, jsdom opted into per file)                  |
| `npm run test:coverage`  | Tests + coverage                                                                  |
| `npm run smoke:consumer` | Packs core + element and installs both outside the monorepo. THE pre-publish gate |

Package (`packages/angular/` — published as `@dataflow-animator/angular`):

| Script                   | Effect                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run build`          | rm -rf dist, then ng-packagr (APF): fesm2022 + a d.ts referencing the core                                              |
| `npm run dev`            | ng-packagr in watch mode                                                                                                |
| `npm run lint`           | ESLint on src/ (the root flat config — no angular-eslint, there are no templates)                                       |
| `npm test`               | `ng test` — the `@angular/build:unit-test` builder, vitest 4 + jsdom                                                    |
| `npm run test:coverage`  | Same, with coverage thresholds (declared in `angular.json`, not a vitest config)                                        |
| `npm run smoke:consumer` | Packs core + angular, installs both in a real Angular CLI app, `ng build` AOT + a headless render. THE pre-publish gate |

NB: the element's pixel gate lives in the REACT workspace
(`npm run harness:element -w @dataflow-animator/react`), because that is where the whole A/B
harness and its plumbing live. The harness is really a bench for the CORE, not for react — moving
it out is a worthwhile cleanup that the Angular package's own large diff had to leave intact.

## Workflows to avoid

- **Never** run `git add .` or `git add -A` — add files by name.
- **Never** run `git commit` on your own initiative — propose the message and wait for an explicit user confirmation.
- **Never** run `git commit --amend` without discussing it (Claude by default creates a new commit).
- **Never** use `--no-verify` to bypass a hook.
- Do not invent a doc URL, an npm package name, or a version. If you are unsure, ask or verify with `npm view`.
- Do not remove a public export from `src/index.ts` without explicit confirmation.

## To start a work session

1. Read `README.md` and `docs/SPEC.md` if you don't have the project in mind.
2. Run the checks above to confirm the green state of the base.
3. Work on your task.
4. Rerun the same sequence of checks before proposing the commit.
