# CLAUDE.md

Instructions for Claude (and any other agent) working on this repository.

## Project overview

`react-dataflow-animator` is a React component that compiles a JSON specification into a deterministic, scrubbable animation of data flows.
The engine is a pure function `evaluate(timeline, t)`: no DOM, no real clock, backwards scrubbing comes for free.

The repository is an **npm workspaces monorepo**:

```text
packages/core/                      framework-agnostic core (private, source-only): spec
                                     types, JSON Schema, the pure engine, TeX/highlight,
                                     JSON export — inlined into the published bundle
packages/react-dataflow-animator/   the published npm package (React binding over core)
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
- [`packages/core/src/types.ts`](./packages/core/src/types.ts) and [`schema.ts`](./packages/core/src/schema.ts) — exact shape of the spec (source of truth; `packages/react-dataflow-animator/src/types.ts` and `schema.ts` are thin re-exports kept for a stable public import path).

## Hard rules before every commit

**You MUST execute this sequence from the root and get a full success before proposing a commit.** You cannot mark a task as completed if any of these checks fail.

```bash
npm run format:check     # Prettier
npm run lint             # ESLint on all workspaces
npm run deadcode         # knip: dead code / unused exports
npm run test:coverage    # vitest + coverage thresholds
npm run build            # build lib + site (typecheck included)
npm run test:integration -w react-dataflow-animator
npm run check:schema
npm run check:subicons   # generated sub-icon glyph data is fresh
```

### What to do in case of failure

- **`format:check`** fails → run `npm run format:write` then stage the introduced diff; do not mix it with logical changes.
- **`lint`** fails → fix the warnings instead of ignoring them. Do not add `eslint-disable` without a real justification (a comment explaining why).
- **`deadcode`** fails → either remove the dead code, or add it to `ignoreExports` in `knip.json` if it's an intentional public export, with a comment.
- **`test:coverage`** fails on thresholds → add tests, do not lower thresholds without explicit user agreement.
- **`build`** fails → fix before proposing the commit. A broken build is never mergeable.

## Code conventions

- **English for code and technical docs.** ALL code comments (`//`, `/* */`, JSDoc) and ALL internal documentation — `README.md`, `docs/*.md`, this `CLAUDE.md` file, commit messages — must be written in English. Never introduce new comments or new docs in French. **Exception (do not confuse):** the _user-facing_ content of the `apps/docs` site remains bilingual EN/FR via native i18n (see the "Internationalization" section below) — the French half (`src/i18n/fr.ts`, `i18n/fr/**`, the `fr:` of demo specs) is NOT code to "switch to English", it is the intentional translation.
- **Strict TypeScript.** No `any`. If you need an `as unknown as X`, write a comment explaining why.
- **`packages/core` must never import `react`**, not even in `import type`. It is the framework-agnostic
  layer, consumed by the React package via a source alias and inlined into its bundle — a React import
  there would leak into every downstream consumer regardless of framework. Precedent: `nodeColors`'s
  `nodeTint` returns `Record<string, string>` rather than `React.CSSProperties`; the React package casts
  at the call site instead. If a helper needs a React-specific type, it belongs in
  `packages/react-dataflow-animator/src`, not in core.
- **No breaking changes** on the public API (`packages/react-dataflow-animator/src/index.ts`) without changing the major version and documenting it.
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

The current locale for content (specs, localized fields) is obtained with `useLocale()` (`src/i18n`).

**Verification (mandatory when you touch i18n):**

- `cd apps/docs && npx tsc --noEmit` — the Docusaurus build does NOT type-check; it's this `tsc` that catches an `en.ts` misaligned with `fr.ts` and type errors. Run this before considering an i18n task complete.
- `npm run build:docs && (cd apps/docs && npx docusaurus serve)` — test both locales as in prod (`docusaurus start` only serves one).
- Hunt for residual French: `grep -rnE "[éèàçœêîôûù]" apps/docs/src/components apps/docs/src/pages` (excluding `fr.ts`, comments) should return nothing user-visible.

## Vigilance points (from code reviews)

Pitfalls already encountered in this repo — check them when you touch the affected area (case details are in `todo.md` as long as it exists):

- **No dead IR fields**: any data computed by the compiler must be consumed by the renderer, otherwise deleted. Do not export an unhooked API.
- **DOM measurement**: the `useStageGeometry` `signature` must reflect ANY spec field that influences the _position_ of nodes — a ResizeObserver only sees resizes, not displacements.
- **Consistent units in geometry**: horizontal/vertical decisions and offsets are taken in measured pixels, not in 0..1 ratios (or else by correcting by the Stage aspect). Two modules that decide differently contradict each other on non-square stages.
- **rAF loops**: cap the time delta (inactive tab → huge `dt` upon return).
- **Dual paths**: if a function has an optimized path and a fallback (e.g. `evaluate`), a test must prove their equivalence — the prod path is not necessarily the one tests exercise.
- **npm publication**: before any `npm publish`, verify the tarball with `npm pack --dry-run` (LICENSE present, `files`/`exports` correct).

## Available scripts (quick reference)

Monorepo root:

| Script                  | Effect                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Builds the lib then starts Docusaurus site in watch                                                                    |
| `npm run build`         | Full build (lib + site)                                                                                                |
| `npm run build:lib`     | Core isolated typecheck, then lib package build                                                                        |
| `npm run build:docs`    | Site build only                                                                                                        |
| `npm run lint`          | ESLint on all workspaces that expose it                                                                                |
| `npm run format:check`  | Checks Prettier formatting                                                                                             |
| `npm run format:write`  | Applies Prettier                                                                                                       |
| `npm test`              | vitest tests of `@react-dataflow-animator/core` and of `react-dataflow-animator` (each has its own coverage threshold) |
| `npm run test:coverage` | Same, with coverage thresholds                                                                                         |
| `npm run deadcode`      | knip — dead code detection                                                                                             |
| `npm run check:schema`  | Verifies core's generated JSON Schema is fresh                                                                         |

Package (`packages/core/`, private, source-only — no `build`/`dev` script, it is never bundled on its own):

| Script                      | Effect                                        |
| --------------------------- | --------------------------------------------- |
| `npm run lint`              | ESLint on src/                                |
| `npm run typecheck`         | Isolated tsc typecheck (core's tsconfig)      |
| `npm test`                  | Unit vitest tests                             |
| `npm run test:coverage`     | Tests + coverage                              |
| `npm run generate:schema`   | types.ts → schema.generated.json              |
| `npm run check:schema`      | CI guard: schema.generated.json is fresh      |
| `npm run generate:subicons` | react-icons glyphs → subIconData.generated.ts |
| `npm run check:subicons`    | CI guard: generated sub-icon data is fresh    |

Package (`packages/react-dataflow-animator/`):

| Script                     | Effect                                      |
| -------------------------- | ------------------------------------------- |
| `npm run build`            | Typecheck + vite build + .d.ts declarations |
| `npm run dev`              | vite build in watch mode                    |
| `npm run lint`             | ESLint on src/                              |
| `npm test`                 | Unit vitest tests                           |
| `npm run test:coverage`    | Tests + coverage                            |
| `npm run test:integration` | Integration tests on demos                  |
| `npm run harness`          | Visual validation harness (Vite, :5199)     |
| `npm run curves`           | Headless structural pass (`--demo <id>`)    |
| `npm run test:visual`      | Playwright visual regression (goldens)      |
| `npm run harness:selftest` | A/B gate calibration — must be 0.00%        |
| `npm run harness:compare`  | A/B pixel diff, React vs vanilla renderer   |
| `npm run harness:bench`    | Perf baseline of the player (per-frame)     |

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
