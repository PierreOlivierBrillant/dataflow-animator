# Changelog

All notable changes to `react-dataflow-animator` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Internal note (no release): after 3.0.0, the now-unused React renderer
     (Stage, Controls, the JSX node/dynamic components, useClock…) was deleted
     from the source tree. None of it was exported, so there is no change for
     consumers and no version bump. -->

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
