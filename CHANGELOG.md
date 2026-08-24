# Changelog

All notable changes to `@dataflow-animator/core`, `@dataflow-animator/react`,
`@dataflow-animator/element` and `@dataflow-animator/angular` are documented
here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Changed

- **An action that carries something to read now stays on screen long enough to
  be read.** A `comment` or a `set_content` that declares no `duration` no longer
  falls back to a flat 500 ms: the engine derives one from the content itself —
  a fixed cost to notice what appeared, plus the length divided by a reading
  speed. Code is given more time than prose, a table more than a label, and the
  result is bounded so a two-word badge does not flash past and a long paragraph
  does not hold the animation hostage.

  **This changes the timing of existing specs** wherever such an action had no
  `duration`, which is why it is a breaking change rather than an addition. An
  explicit `duration` is untouched — it is a stated intent, not an estimate — so
  a spec that times every action itself renders exactly as before. Nothing moves
  in space: only *when* each step happens changes, never *what* is drawn.

### Added

- **`pace`** (spec level): scales every derived reading time in one place, for
  when the default pace reads too fast or too slow for an audience. Above 1
  leaves more time, below 1 moves faster. It deliberately does not touch a
  `duration` written by hand.

## 1.1.0 — 2026-08-23

### Added

- **The animation can now be exported as a video.** A new `videoExport` option
  / prop / attribute / input, on all four packages, adds a button to the control
  bar that opens a settings panel — format, resolution, frame rate — and writes
  the animation to a **WebM**, **MP4** or **GIF** file. It is off by default, so
  no existing player changes appearance. `true` offers everything; an object
  narrows what the panel proposes
  (`{ formats: ['mp4'], resolutions: [1080], frameRates: [30] }`), and a
  single-entry list is shown as text rather than as a dropdown of one.
- **The panel estimates how long the export will take and how large the file
  will be**, and updates both as the settings change — the thing that makes a
  resolution or frame-rate choice meaningful. Measured cost model to start with
  (video is nearly flat in resolution; GIF is linear in pixels), replaced by
  what the machine actually did once it has exported once.
- **`'auto'` mode now exports in the theme the host site is showing.** It is
  resolved per export, from the ancestor `data-theme` the stylesheet already
  reads, falling back to the OS only when there is none — so a reader who
  switched the site to dark stops getting a light file, and a theme toggle moves
  the next export with it.
- **`exportVideo(spec, options)`** and **`downloadExport(result)`**, exported
  from `@dataflow-animator/core` for callers with no player on screen — a build
  script, a "download every diagram" action. `exportVideo` mounts a player of
  its OWN off screen and walks it through virtual time, which is why an export
  never disturbs playback and never waits for real time: measured across the
  documentation demos it takes roughly a tenth to a third of the animation's own
  duration. It reports progress and accepts an `AbortSignal`.
- **Fifteen new `PlayerLabels` keys** (`exportVideo`, `exportFormat`,
  `exportResolution`, `exportFrameRate`, `exportFps`, `exportEstimate`,
  `exportSeconds`, `exportMinutes`, `exportKilobytes`, `exportMegabytes`,
  `startExport`, `exporting`, `finalisingExport`, `cancelExport`,
  `exportFailed`), so the export chrome
  localises through the same object as the rest. The format NAMES are not among
  them: `MP4` is `MP4` in every language.

GIF defaults to 960×540 at 20 fps rather than the postage stamp the format is
usually associated with: measured, that costs 31% of the animation's own
duration against 58% for 1280×720, and 20 fps is exactly the 5 centiseconds GIF
stores delays in. MP4 negotiates its H.264 level against the requested size —
baseline 3.1 tops out at 720p, so a 1080p MP4 would otherwise be refused
outright.

The three muxers (`webm-muxer`, `mp4-muxer`, `gifenc`) are runtime dependencies
of the core, reached through `import()` and left external by the build — a
consumer who never exports downloads none of that code. WebM and MP4 need the
**WebCodecs** API; GIF does not.

- **The animation is now rendered as text, not just as pixels.**
  `describeAnimation(spec, timeline, labels)` (exported from
  `@dataflow-animator/core`) turns a compiled timeline into a summary and one
  sentence per step — a pure function, in the spirit of `evaluate`, so the two
  renderings cannot drift apart.
- **The player carries that description.** Its root is now a named `region`,
  and it renders a summary plus one BUTTON per step that pauses and seeks to
  that step: the same navigation the control bar offers, exposed as text. A
  `polite` live region announces the step the playhead enters. Controlled by
  the new `transcript` option / prop / attribute — `'sr-only'` (default),
  `'visible'`, `'none'` — on all four packages.
- **Two optional spec fields**, `DataFlowSpec.description` and
  `Action.description`, for the intent a generated sentence cannot infer. Both
  are optional: an animation with neither is still fully described.
- **32 new `PlayerLabels` templates** (`describeMove`, `describeArrow`…), so
  the description localises through the same object as the rest of the chrome,
  with word order left to the translator.

### Fixed

- **A moving element is now always named.** A packet with no readable content
  used to be announced by its id — `rows travels from Database to API`, which
  names nothing — and a label made only of spaces or symbols was read out
  character by character ("space", "right arrow"). Both now fall through to
  what the packet IS: `a SQL response of 12 rows travels from Database to API`.
- **Counted sentences agree in number** ("1 step", not "1 steps"), through a
  singular template beside each counted one.

### Changed

- **The stage is now `aria-hidden`.** Its labels are absolutely positioned, so
  a screen reader read them in DOM order as a bag of loose strings in which the
  animation appeared nowhere. The text description is the accessible
  equivalent; the stage is decor. No visible rendering changes — the closed
  transcript is clipped to nothing, and the visual goldens are unchanged.

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
