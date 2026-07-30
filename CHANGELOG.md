# Changelog

All notable changes to `@dataflow-animator/core`, `@dataflow-animator/react`
(formerly `react-dataflow-animator`) and `@dataflow-animator/element` are
documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Internal note (no release): after 3.0.0, the now-unused React renderer
     (Stage, Controls, the JSX node/dynamic components, useClock…) was deleted
     from the source tree. None of it was exported, so there is no change for
     consumers and no version bump. -->

## `@dataflow-animator/element` 0.1.0

**New package.** `<dataflow-player>`, a custom element over
`@dataflow-animator/core` — the first binding that is not React, and the one that
covers plain HTML, Vue, Svelte, Angular and anything else that renders a tag.

```html
<script type="module">
  import '@dataflow-animator/element';
  import '@dataflow-animator/core/styles.css';
</script>

<dataflow-player height="420" theme="blueprint" spec="{ … }"></dataflow-player>
```

- **Light DOM, no Shadow DOM.** The core's global `.rdfa-*` stylesheet applies as
  it is, and you can style the player with ordinary CSS
  (`dataflow-player .rdfa-player { … }`). Encapsulating would have forced this
  package to carry its own copy of the CSS, which is exactly what "the stylesheet
  ships once" exists to prevent. Shadow DOM stays available as a later opt-in.
- **It ships neither the engine nor the CSS.** `@dataflow-animator/core` is a real
  dependency at `^0.1.0`, externalised from the bundle — 6.5 kB of JavaScript, and
  a `.d.ts` that references the core's types instead of copying them. Import
  `@dataflow-animator/core/styles.css` once; **without the stylesheet nothing has a
  size.**
- **Every option of the core's player is reachable**, as a kebab-case attribute or
  a camelCase property (`spec`, `theme`, `mode`, `density`, `height`, `width`,
  `player-class`, `speed`, `initial-t`, `controls`, `exportable`, `auto-play`,
  `loop`, `debug`, plus `highlight` as a property). `spec` takes a JSON string or a
  real object.
- **An absent boolean attribute means "unspecified", not `false`.** The core
  defaults `controls` to `true`, so `<dataflow-player>` with no `controls`
  attribute still shows the control bar — **write `controls="false"` to hide it.**
  Same for `exportable`, `auto-play`, `loop` and `debug`.
- **Changing an option remounts the player**, as in the React binding: several
  synchronous changes coalesce into one remount, the new player reopens at the
  previous instant and play state, and only the first mount honours `initial-t` /
  `auto-play`.
- **Two events**, because mounting is deferred by a microtask:
  `dataflow-player:mounted` (after every mount, remounts included) and
  `dataflow-player:error` (an unreadable `spec` attribute — reported and ignored,
  never blanking a working player).
- `defineDataFlowPlayer(tag?)` registers an extra tag name; the default
  `dataflow-player` is registered when you import the package.
- **SSR-safe**: importing the package on a server is inert, not fatal.

No CDN bundle in this release, deliberately: `esm.sh`/`jspm` rewrite bare module
specifiers, and an import map covers the rest, so a self-contained build would only
add a second copy of the engine. Both recipes are in the package README.

A demo of the element on the documentation site is not part of this release.

## `@dataflow-animator/react` 0.1.0

**Renamed package.** `react-dataflow-animator` becomes
`@dataflow-animator/react`, and the version restarts at `0.1.0` alongside the
core rather than continuing to `4.0.0` — the npm name is new, so nothing is
being upgraded in place. `react-dataflow-animator@3.0.0` is not maintained.

The React binding stops bundling the engine and now **depends** on the published
core. One engine and one stylesheet on disk instead of two.

### Migrating from `react-dataflow-animator@3.0.0`

```diff
-npm install react-dataflow-animator
+npm install @dataflow-animator/react
```

```diff
-import { DataFlowPlayer } from 'react-dataflow-animator';
-import 'react-dataflow-animator/styles.css';
+import { DataFlowPlayer } from '@dataflow-animator/react';
+import '@dataflow-animator/core/styles.css';
```

```diff
-import schema from 'react-dataflow-animator/schema.json';
+import schema from '@dataflow-animator/core/schema.json';
```

Every **export name** is unchanged — `DataFlowPlayer`, `NodeView`,
`registerNodeIcon`/`getNodeIcon`, `registerSubIcon`/`getSubIcon`, `compile`,
`evaluate`, `computeLayout`, `dataFlowSchema`, every spec and timeline type. Only
the package name, the stylesheet path and the schema path move.

### Changed

- **`@dataflow-animator/core` is a runtime `dependency`** (`^0.1.0`), externalised
  from the bundle instead of inlined into it. It installs automatically.
- **The published `.d.ts` REFERENCES the core's types** instead of copying them,
  so a consumer resolves one set of spec types whichever package they import
  from. 106 kB → 6 kB.
- `dist/index.js`: **290 kB → 3.7 kB**. The engine, the DOM renderer and the
  stylesheet are no longer duplicated here.

### Removed

- **`@dataflow-animator/react/styles.css`** — the package emits no stylesheet.
  Import `@dataflow-animator/core/styles.css`, which is the same bytes, shipped
  once. **This is the one change that silently breaks a page rather than the
  build**: without it the markup mounts and measures, but nothing has a size, a
  colour or a transition.
- **`@dataflow-animator/react/schema.json`** — use
  `@dataflow-animator/core/schema.json`.
- `prismjs` as a direct dependency: nothing in this package imports it, and the
  core already declares it, so it still arrives transitively.

## `@dataflow-animator/core` 0.1.0

The framework-agnostic core becomes a package of its own — the direct entry
point for a consumer with no framework, and the common dependency every wrapper
will be built on. Until now it was a private, source-only workspace that
`react-dataflow-animator` inlined at build time.

### Added

- **A public API** (`packages/core/src/index.ts`): `mountPlayer` / `mountStage`
  and their option and handle types, `createPlayerClock`, `renderNodeVisual`,
  the icon registries (`registerNodeIcon`, `registerSubIcon`, the `render*`
  getters returning an `SVGElement`, `IconSource`), `highlightCode` /
  `escapeHtml`, the engine (`compile`, `evaluate`, `stepIndexAt`, `nextStop`,
  `prevStop`, `computeLayout`, `Timeline` and the whole `Clip` union),
  `serializeSpec`, every specification type, and `dataFlowSchema`. The
  renderer's plumbing stays private.
- **A build**: ESM bundle, a flattened self-contained `dist/index.d.ts`,
  `dist/styles.css` and `dist/schema.json`, exported as
  `@dataflow-animator/core`, `@dataflow-animator/core/styles.css` and
  `@dataflow-animator/core/schema.json`. `prismjs` stays external.
- **The renderer's stylesheet** moved here from the React package, next to the
  markup it styles.

### Changed

- `mountVanillaPlayer` → `mountPlayer`, `mountVanillaStage` → `mountStage`, and
  their `Vanilla*` option/handle types lose the prefix. None of these names was
  public, so no consumer is affected: this package **is** the
  framework-agnostic one, and the name should not have said "vanilla".

### Note for `react-dataflow-animator` consumers

Nothing changes in this release. The React package still inlines the core's
source, so it ships its own copy of the engine and of the stylesheet. Making it
depend on the published core — one engine, one stylesheet, and a different CSS
import path — is a breaking change, and lands as its own major version.

## [3.0.0]

`DataFlowPlayer` no longer renders a React tree. It mounts a framework-agnostic
DOM renderer and drives it imperatively, which makes a frame **5–7× cheaper in
script time** — a clock tick now mutates the DOM in place instead of
re-rendering. The rendering itself is unchanged: a 200-cell pixel-diff gate
holds the new renderer bit-identical to the old one across five demos, five
instants, both themes and the full player chrome.

Upgrading costs you nothing unless you use `useClock`, the icon registries, or
rely on the player being server-rendered.

### Changed (breaking)

- **The player renders nothing on the server.** The DOM renderer mounts in a
  client effect, so the static HTML contains only a correctly-sized placeholder
  (plus `fallback`, if given) and the diagram appears on hydration. There is no
  hydration mismatch — there is nothing to match. Previously the server emitted
  the full stage markup, hidden until measurement, plus a **visible control
  bar**; that bar is the one thing that genuinely disappears from prerendered
  pages. Use `fallback` to put a poster or skeleton in the static HTML.
- **`registerNodeIcon` / `registerSubIcon` take SVG markup or a factory**,
  instead of a `ReactNode`:

  ```diff
  - registerSubIcon('kafka', <SiApachekafka color="#231F20" />);
  + registerSubIcon('kafka', '<svg viewBox="0 0 24 24">…</svg>');
  + registerSubIcon('kafka', () => buildMyIcon());   // or a factory
  ```

  They now drive the core's registry. Had they kept pointing at the React one,
  they would have gone silently inert — the player no longer renders through it.

- **`getNodeIcon` / `getSubIcon` return an `SVGElement`** rather than a
  `ReactNode`. To place one in a React tree, mount it in an effect (this is what
  `NodeView` does).
- **A registered node icon now overrides `switch` and `push_button`.** In v2
  those two were resolved before the registry, so registering over them was
  silently ignored — an accident of ordering rather than a contract.
- **`NodeView` mounts its content in an effect** and therefore also emits
  nothing on the server. Its props are unchanged.
- **`style` values are converted with an explicit unitless table** (`opacity`,
  `zIndex`, `flex*`, `order`, `lineHeight`, `fontWeight`, `zoom`, `grid*`) rather
  than React's full one. Anything else numeric gets `px`.

### Removed

- **`useClock` and the `Clock` type.** The player's clock lives in the core and
  is no longer a React hook, so the exported hook drove nothing the player did.

### Added

- **`width`** — sizes the player before its first measurement. Setting a width
  afterwards would anchor a `set_content` node's icon→panel morph to a box the
  player never actually had.
- **`initialT`** — the instant the player opens at, in ms. Uncontrolled: it
  seeds the clock at mount. Opening _at_ `t` is not the same rendering as opening
  at 0 and seeking to `t`, which is why it is a mount option and not a seek.
- **`IconSource`** — `string | (() => SVGElement)`, the type the icon registries
  accept.

### Notes

- **Changing `spec` remounts the player**, carrying the current instant and play
  state across. Remounting is keyed on the spec's _structure_, not the object's
  identity, so rebuilding an equal spec on every render costs nothing. One
  visible consequence: a `set_content` in flight when the spec changes will
  flicker once, because the icon→panel anchor is recaptured at the resumed
  instant rather than walked to.
- **`highlight` is read when the player mounts.** An inline arrow function would
  otherwise be a new value on every render, and since every option change
  remounts, the player would remount forever. Change it together with `spec`.
- The new rendering path honours `density` (`'spacious'` included) and a custom
  `highlight` for panel content exactly as v2's did.
- Icon glyph geometry now ships inside the published bundle, so the icon packs'
  attribution ships with it — see `LICENSE`.

### Known issues (unchanged from v2, deliberately)

Fixing these would move pixels the migration gate pins, so they are carried over
verbatim and left for a follow-up:

- the player's chrome has hardcoded French labels (`Lecture`, `Étape suivante`,
  `Plein écran`…);
- `ArrowRight` **jumps** to the next stop while the next-step _button_ **plays**
  to it;
- the JSON dialog closes on backdrop or button only — no `Escape`, no focus
  trap;
- the fullscreen toggle exits fullscreen whenever _any_ element is fullscreen,
  not only this player.

## [2.0.0]

- Spec types, JSON Schema, the pure engine, TeX parsing, syntax highlighting and
  JSON export extracted into a private `@react-dataflow-animator/core`
  workspace, inlined into the published bundle. No public API change.
- Backward-compatible type aliases from 1.x (`StaticObject`, `DynamicObject` and
  friends) removed.

## [1.0.0]

- First public release.
