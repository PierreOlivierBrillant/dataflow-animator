# Changelog

All notable changes to `@dataflow-animator/core`, `@dataflow-animator/react`,
`@dataflow-animator/element` and `@dataflow-animator/angular` are documented
here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 — 2026-08-17

First public release: a framework-agnostic core and three thin bindings.

### `@dataflow-animator/core`

The engine, the renderer and the stylesheet — everything every binding shares,
usable on its own with no framework at all.

- **A deterministic engine.** `compile(spec)` turns a JSON specification into a
  timeline of dated clips; `evaluate(timeline, t)` is a pure function of time.
  Seeking, stepping and backwards scrubbing are exact, not simulated.
- **A retained-mode DOM renderer.** `mountPlayer` (stage, control bar and
  clock) and `mountStage` (bring your own chrome) build the DOM once and mutate
  it in place as `t` moves — no per-frame rebuild.
- **Automatic layout** — linear by `direction` and `lane`, circular, trees —
  and **circuit schematics**: net-aware orthogonal routing, automatic pin
  assignment, and a fixed-aspect letterboxed frame so a schematic routes
  identically at any player size or shape.
- **An accessible, localisable chrome.** Keyboard shortcuts, a scrub bar with
  slider semantics, a modal JSON dialog with a focus trap; every user-visible
  string is overridable key by key via `labels` (English defaults, resolved in
  the core).
- **Extensible registries** for node icons and sub-icon badges
  (`registerNodeIcon`, `registerSubIcon`); Prism-based syntax highlighting,
  replaceable via `highlight`; `dataFlowSchema`, the JSON Schema generated from
  the spec types; `serializeSpec` and JSON export.
- **One stylesheet, shipped once**: `@dataflow-animator/core/styles.css`.
  Whichever binding you use, import it exactly once — without it the markup
  mounts and measures, but nothing has a size.
- **SSR-safe**: importing the package touches no DOM, and Prism is kept from
  auto-highlighting the host page's own code blocks.

### `@dataflow-animator/react`

`<DataFlowPlayer>`, the React binding. It mounts the core's player in an effect
and renders nothing per frame; the engine is a dependency, not a copy, so the
bundle stays a few kilobytes. `NodeView` renders a single node's visual outside
any stage. Every option is read at mount: changing one remounts the player,
which reopens at the current instant and play state (`spec` and `labels` are
compared structurally, so inline objects cost nothing). The first mount waits
two frames so its placeholder is really painted, and that placeholder carries a
loading indicator revealed by a CSS delay — nothing flashes on a fast mount, and
a slow one (compiling and measuring a heavy spec) says so instead of freezing on
an empty box. `fallback` replaces the indicator, `labels.loading` names it, and
a remount never waits, so a live-edited spec does not blink.

### `@dataflow-animator/element`

`<dataflow-player>`, a light-DOM custom element for plain HTML, Vue, Svelte, or
anything that renders a tag. Every option is a kebab-case attribute or a
camelCase property; `spec` takes a JSON string or a real object. An absent
boolean attribute means "unspecified" — the core's default applies — so
`controls="false"` is how the control bar is hidden, never by omission. Two
events, because mounting coalesces on a microtask: `dataflow-player:mounted`
and `dataflow-player:error`. Importing the package registers the tag;
`defineDataFlowPlayer(tag)` registers extra names.

### `@dataflow-animator/angular`

`<dfa-player>`, a standalone Angular component (Angular 22, signal inputs,
`output()` events). The animation clock runs outside the Angular zone, so
playback never triggers change detection; SSR is guarded by
`isPlatformBrowser`. Outputs: `mounted` and `error`. The selector is
deliberately not `dataflow-player`, which belongs to the custom element — a
consumer may use both packages.

All three bindings depend on the core rather than bundling it: one engine and
one stylesheet on disk, however many bindings a page uses.
