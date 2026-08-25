# Changelog

All notable changes to `@dataflow-animator/core`, `@dataflow-animator/react`,
`@dataflow-animator/element` and `@dataflow-animator/angular` are documented
here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- **Sixteen microelectronics symbols**, all with named terminals. Three MOS
  parts — `mosfet_n`, `mosfet_p` and the CMOS pass gate `transmission_gate` —
  so a logic gate can be drawn as the transistors it is actually made of. Five
  three-input gates — `and3_gate`, `or3_gate`, `nand3_gate`, `nor3_gate`,
  `xor3_gate` — with inputs `a` / `b` / `c`, the middle one at mid-height so a
  straight wire into it needs no bend. And eight **functional blocks**, drawn as
  a labelled box rather than as the gates inside them: `d_flip_flop`,
  `jk_flip_flop`, `t_flip_flop`, `sr_latch` (outputs `q` / `qn`), `mux_2to1`,
  `demux_1to2` (select line entering from below), `half_adder` and `full_adder`.

  A pMOS's `source` is its UPPER terminal while an nMOS's `drain` is — mirrored
  on purpose, because that is what lets a CMOS pull-up and pull-down stack be
  wired straight down the page instead of routing back around itself.

  Only blocks whose terminal COUNT is fixed are modelled. A parametric one — an
  N-bit register, a 4:1 multiplexer, an n→2ⁿ decoder — would need one type per
  size, and belongs to a future block whose pins are declared in the spec.

- **`type: 'block'` — a functional block whose terminals are declared in the
  spec.** The fixed-pin symbols cover what never varies; a 4:1 multiplexer, an
  n→2ⁿ decoder, an N-bit register or an ALU each have a different terminal count,
  and one node type per size is not a catalogue that ends. A block takes a
  `pins` list — `{ name, side?, label? }`, `side` one of `left` (the default),
  `right`, `top`, `bottom` — spreads each face's terminals evenly in declaration
  order, and **sizes its box from them**: taller with the busiest vertical face,
  wider with the longest labels and the `body` designator.

  The size and every terminal position come from a single pure function that
  both the renderer and the wire router read, so a printed pin name and the wire
  that lands on it cannot drift apart. Nothing is measured from the DOM, so the
  geometry is known before mount and identical under SSR.

  A block does not take part in the circuit layout's lead-straightening nudges:
  those compare terminal offsets as fractions of each body, which only holds
  while every symbol renders at one size. The router draws the steps instead.

- **A new gallery demo, "Multiplexer 4:1"**, stepping through the four select
  values and lighting the one input path that reaches the output.

- **A new gallery demo, "CMOS NAND gate"**: the same NAND the rest of the
  electronics demos are built from, drawn as its four transistors, lighting up
  the ones that conduct for each of the four input combinations.

- **A `content` / `set_content` panel can now be rich HTML.** A new content
  `type: 'html'` renders the markup in `value` — headings, lists, tables,
  images, inline SVG — instead of a flat string. The markup is parsed INERT and
  then REBUILT from an allow-list: a spec is data, and it may well arrive from a
  CMS or a form, so an element, an attribute or a CSS declaration that is not on
  a list never reaches the document. `<script>`, `<style>`, `<iframe>`, every
  `on*` handler and any URL whose scheme is not `http`, `https` or
  `data:image/…` are dropped silently.

  `class` and `id` are dropped too, and that one is not about security: a
  rasterised video frame carries only the CSS rules whose selector contains
  `rdfa`, so a class the host page styles would render on screen and render
  UNSTYLED in the exported video — the same spec, two different pictures. Inline
  `style` travels with the element, so it is what authors get instead (itself
  filtered: no `position`, no custom properties, no `url(…)`).

  Unlike `text`, an `html` panel shows the browser chrome only when given a
  `url`.

- **An `image` panel can now animate, on the ANIMATION's clock.** `frames` is an
  ordered list of image sources, played at `fps` (default 12) and looping unless
  `loop: false`. The frame on screen is `floor(elapsed × fps) mod frames.length`
  — a pure function of `t`, like every other rendered value — so it pauses with
  the player, rewinds when the scrub bar goes backwards, and exports
  frame-accurately.

  An animated GIF in `value` does none of that: a GIF's playhead is not
  reachable from JavaScript, so it keeps running while the player is paused and
  an exported frame catches whichever moment the decoder happened to be on.
  `frames` exists to replace it. Prefer `data:` URIs — a rasterised frame cannot
  load anything from another origin.

- **An `html` panel can declare a design space and become a SCREEN.**
  `screen_width` (plus optional `screen_height`, defaulting to
  `screen_width × 0.625`) lays the markup out once at that size and then only
  ever changes the uniform SCALE, instead of re-flowing inside whatever box the
  node's allowance grants. For a simulated interface the arrangement IS the
  message — a student has to recognise the same screen in a thumbnail and on a
  projector — and that is exactly what a paragraph-shaped panel cannot promise.

  The scale is `min(maxW/w, maxH/h)` over the node's existing `ContentLimit`:
  pure arithmetic, never a measurement, so a screen scrubs and exports like the
  rest of the renderer. The address bar moves INSIDE the screen so it scales
  with the page, the player's own `--rdfa-content-scale` is neutralised within
  it, and what overflows is cropped — as a real screen crops what is below the
  fold.

- **One new `PlayerLabels` key**, `describeContentAnimation`, so the transcript
  tells an animated panel apart from a still image. An `html` panel is
  transcribed as its WORDS, with the markup stripped.

### Changed

- **The derived reading time reads the new modes properly.** An `html` panel is
  counted on its text rather than on its markup, so `<strong>` no longer buys a
  two-word panel the ceiling of a paragraph. An `image` carrying `frames` is
  given the time its sequence needs to play through once, instead of the flat
  beat a still gets.

### Fixed

- **Net tinting now covers every type that drives a net.** It was decided by
  `type.endsWith('_gate')`, which silently excluded anything that is not spelled
  like a gate — a flip-flop's `q` is as much a net driver as a NAND's `y` — and
  would have wrongly included `transmission_gate`, which passes a net rather
  than driving one. The rule is now an explicit list.

## 2.0.0 — 2026-08-24

### Changed

- **An action that carries something to read now stays on screen long enough to
  be read.** A `comment` or a `set_content` that declares no `duration` no longer
  falls back to a flat 500 ms: the engine derives one from the content itself —
  a fixed cost to notice what appeared, plus the length divided by a reading
  speed. Code is given more time than prose, a table more than a label, and the
  result is bounded so a two-word badge does not flash past and a long paragraph
  does not hold the animation hostage.

  A comment's time is counted once the bubble is FULLY THERE: it fades in first,
  and the reading time starts from there. The bubble's opacity used to ride the
  clip's own progress, spreading the fade across the entire clip — so a comment
  meant to stay four seconds took four seconds to become legible, which the
  derived reading times above would have made glaring.

  **This changes the timing of existing specs** wherever such an action had no
  `duration`, which is why it is a breaking change rather than an addition. An
  explicit `duration` is untouched — it is a stated intent, not an estimate — so
  a spec that times every action itself renders exactly as before. Nothing moves
  in space: only _when_ each step happens changes, never _what_ is drawn.

- **A fade-in no longer fills the pause it belongs to.** It used to last the
  whole appearance hold, which was harmless while that hold was a flat 300 ms
  and wrong as soon as it became a reading pause: a packet held 1600 ms to let
  its query be read took 1600 ms to become legible. The fade is capped at 250 ms
  (or the hold, when shorter), and the rest of the hold is fully opaque —
  measured on `microservices`' SQL packet: opaque at 250 ms, then legible for the
  remaining 1350 ms.

- **Movements are slower.** The derived travel speed was 300 px/s in the
  reference frame, calibrated against the median speed authors had been writing
  by hand across the corpus (284 px/s). An earlier pass shipped 430, a number
  that matched no measurement and read as visibly hurried. Only moves that
  declare no `duration` of their own are affected.

- **A packet now waits at its origin long enough to be read.** Its origin hold
  was a fraction of the trip — 120 ms for a 600 ms hop — which does not cover
  `SELECT * FROM users WHERE email=…`, text the reader meets while the packet is
  still standing still. The hold is now at least the time that content needs,
  charged once per packet: a later leg of the same route shows the same text.

- **A movement's duration now follows the distance it covers.** A `move` with no
  `duration` no longer takes a flat 500 ms whatever the length of its trip: it is
  derived from that length, so a scene holds one apparent SPEED instead of one
  duration. Measured across the demos, the speed authors were imposing varied by
  a factor of 8.1 between the slowest and the fastest hop; the eye reads a speed,
  and one that changes for no reason reads as a mistake.

  Distances are measured in a **fixed 16:9 reference frame**, never in the
  player's real pixels — `compile()` has no geometry, and feeding it the live
  aspect would recompile the timeline on every resize, shifting total duration
  and navigation stops mid-playback. Same reasoning as the circuit router's
  letterbox.

- **Linear layouts now use one spacing step for both axes.** Nodes were
  distributed over the whole stage, each axis independently, which made the gap
  between neighbours a function of how many there were — 0.6 of the stage at two
  nodes, 0.14 at six — and, because the same ratio is a different number of
  pixels on each axis, made the vertical gap **1.84x** the horizontal one on a
  16:9 stage. Two nodes "equally spaced" simply were not.

  One step in pixels now governs both directions, the largest that fits, with the
  grid centred on the stage. Adding a lane makes the diagram grow within the
  stage instead of redistributing everything across it. Only the linear
  directions change: `graph` stays aspect-independent by design, and the circuit
  layouts are untouched.

- **A packet's motion has its own easing curve.** `easeInOutCubic` governed five
  unrelated things — position, opacity, tree edges, rotations, content
  cross-fades — so it was not a choice, it was the absence of one. Position now
  follows a dedicated asymmetric curve: a decided departure, then a long settle,
  because arriving is the part that carries the information. The other four keep
  the cubic until each is given a role of its own.

- **The pauses framing a movement are now proportioned to it.** A packet was held
  300 ms at its origin and 300 ms at its destination whatever it was doing —
  which on a busy demo added up to 9.2 s of waiting against 9.9 s of actual
  movement. They are bounded fractions of the move's own duration instead: a
  long, slow trip earns a beat to settle, a quick hop chains straight on. The
  arrival gets slightly more than the departure, being the part that carries the
  information. `STEP_GAP` is deliberately unchanged — it separates navigation
  stops, a functional role rather than a decorative one.

### Added

- **`pace`** (spec level): scales every derived duration in one place — reading
  time and travel time alike — for when the default pace reads too fast or too
  slow for an audience. Above 1 leaves more time, below 1 moves faster. It
  deliberately does not touch a `duration` written by hand.

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
