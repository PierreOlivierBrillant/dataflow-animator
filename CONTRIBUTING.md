# Contributing

Thanks for looking. This document covers how to get the repository running, what
the checks are, and the handful of rules that are not obvious from the code.

Issues and pull requests are welcome. If you are planning something large —
a new layout mode, a new action type, anything that touches the spec — open an
issue first: the spec is a published surface and a change to it costs a major
version.

## Getting set up

Node **22** or newer (CI runs 24), with npm workspaces support.

```bash
git clone https://github.com/PierreOlivierBrillant/dataflow-animator.git
cd dataflow-animator
npm ci
npm run dev
```

Use `npm ci`, not `npm install`. `packages/angular` pins **vitest 4** while the
other three are on **vitest 3**; npm nests the two correctly from the lockfile,
but an `npm install` can resolve a tree that `npm ci` would reject — and the
package a bad hoist breaks is never the one you touched, it is one of its
neighbours.

`npm run dev` builds the libraries, then starts the core and React watchers and
the documentation site — the site only once both watchers have written their
first bundle, which is deliberate (see "A rebuilt `dist` is briefly empty"
below). The site is served at <http://localhost:3000/dataflow-animator/>.

Do not run `npm run build` while `npm run dev` is running: the build starts with
`rm -rf dist` and the dev server will fail with opaque errors. Stop it first.

## Repository layout

An npm workspaces monorepo. One engine, three bindings, one site.

| Path               | What it is                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core`    | `@dataflow-animator/core` — spec types, JSON Schema, the pure engine, the DOM renderer, the stylesheet. **No framework dependency.** |
| `packages/react`   | `@dataflow-animator/react` — `<DataFlowPlayer>`                                                                                      |
| `packages/element` | `@dataflow-animator/element` — the `<dataflow-player>` custom element                                                                |
| `packages/angular` | `@dataflow-animator/angular` — the `<dfa-player>` standalone component (built with ng-packagr)                                       |
| `apps/docs`        | The Docusaurus site: demos, playground, API reference                                                                                |
| `docs/`            | `SPEC.md` (functional source of truth), `ARCHITECTURE.md`, `AI-VALIDATION.md`, `SEARCH.md`                                           |

A binding adds no rendering of its own — it turns its framework's inputs into
the core's options and calls `mountPlayer`. A pixel gate in this repository
asserts that all of them produce byte-identical output, so a change that belongs
in the renderer belongs in `packages/core`, never in a binding.

## Before you open a pull request

Run this from the root and get a clean pass on all of it:

```bash
npm run format:check
npm run lint
npm run deadcode
npm run test:coverage
npm run build
npm run test:integration -w @dataflow-animator/react
npm run test -w @dataflow-animator/docs
npm run check:schema
npm run check:subicons
```

CI runs exactly this sequence. If `format:check` fails, run `npm run format:write`
and keep that diff in its own commit rather than mixing it with logic.

If you touched a `package.json` or the lockfile, run `npm ci` and rerun
`test:coverage` before believing any of it.

### The visual gates

Rendering changes need more than the unit tests, because none of them look at a
pixel. From `packages/react`:

| Command                       | What it proves                                                               |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm run harness`             | The interactive contact sheet of every demo, on <http://localhost:5199>      |
| `npm run test:visual`         | Golden screenshots — catches an unintended visual change                     |
| `npm run harness:selftest`    | The measurement has a zero noise floor (144 checks, must be `0.00%`)         |
| `npm run harness:element`     | `<dataflow-player>` renders what `mountPlayer` renders (70 cells, `0.0000%`) |
| `npm run harness:mountupdate` | `mount(t₀) + update(t)` equals `mount(t)`                                    |

The goldens depend on font rendering and the Chrome version. If `test:visual`
fails on your machine and you are confident nothing moved, say so in the pull
request rather than regenerating them — a regenerated golden hides the next real
regression. The harness does **not** hot-reload the core's sources: restart it
after editing `packages/core/src`.

`docs/AI-VALIDATION.md` explains what each gate does and does not prove.

## Rules that are not obvious

- **`packages/core` must never import React**, not even in `import type`. It is
  consumed by people with no framework and by bindings for other frameworks; a
  React import would land in every one of their bundles. If a helper needs a
  React type, it belongs in `packages/react/src`.
- **Every binding imports the core's top-level barrel only** — never
  `@dataflow-animator/core/dom/player` or any other subpath. Deep paths resolve
  inside this monorepo (a build alias short-circuits `exports`) and fail for
  everyone who installs the package, because the published `exports` map lists
  only `.`, `./styles.css` and `./schema.json`. If the barrel is missing
  something, add it to the barrel — that is a deliberate public commitment.
- **The stylesheet ships once, from the core.** `packages/core/src/styles/dataflow.css`
  is the only CSS in the suite. No binding emits any, and none re-exports it.
- **The JSON Schema is generated** from `packages/core/src/types.ts`. Run
  `npm run generate:schema` after changing the types; never edit the schema by
  hand. `npm run check:schema` is the guard.
- **A spec change is a documentation change.** Adding, removing or altering a
  field, an action type, an enum value or a default means updating `docs/SPEC.md`
  and the relevant MDX page under `apps/docs/docs/` — with at least one concrete
  example — in the same pull request. The generated API reference does not
  replace prose: a schema does not document intent.
- **Everything user-facing is bilingual.** The site is English (source, `/`) and
  French (`/fr/`), including the text inside example specs — node labels,
  comments, packet contents. Identical strings across the two are only acceptable
  for genuine invariants (`GET`, `SQL`, `npm`). Run `npx tsc --noEmit` in
  `apps/docs` when you touch i18n: the Docusaurus build does not typecheck, and
  it is that command which catches an `en.ts` misaligned with `fr.ts`.
- **Code and internal docs are in English** — comments, JSDoc, `docs/*.md`,
  commit messages. The French half of the site is the intentional translation,
  not something to convert.
- **SSR-safe.** No `window`, `document` or `requestAnimationFrame` outside an
  effect or a guarded call path. Importing any of the four packages on a server
  must be inert.
- **A rebuilt `dist` is briefly empty.** Rollup writes in place, so the file goes
  full → 0 bytes → full inside one millisecond. Anything reading a `dist` while a
  build is running can see a module that exports nothing, and webpack's
  persistent cache will then replay the resulting "export not found" warning
  forever. If you see those warnings, check the `dist` first; if the exports are
  there, run `npm run clear -w @dataflow-animator/docs`.

## Commit messages

Conventional commits, scoped by area: `fix(core):`, `feat(react):`,
`docs(site):`, `chore:`. Present tense, describing what the change does.

## Releasing

Maintainers only. Publishing is driven by a `v*` tag, which triggers
`.github/workflows/release.yml`: it reruns the full check suite plus both
external-consumer smoke tests, verifies the tag matches all four manifests, and
publishes with provenance. The procedure is in [`CLAUDE.md`](./CLAUDE.md).

## Licence

By contributing you agree that your contributions are licensed under the
[MIT Licence](./LICENSE).
