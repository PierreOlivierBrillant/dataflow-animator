# Functional Specification — DataFlow Animator

> Functional source of truth of the library. The complete **JSON Schema** (types,
> enumerations, default values) lives in the code: [`packages/core/src/schema.ts`](../packages/core/src/schema.ts)
> and feeds the "API Documentation" page of the site. The corresponding **TypeScript types**
> are in [`packages/core/src/types.ts`](../packages/core/src/types.ts).

## 1. Overview

The library **compiles** a JSON specification into a **deterministic animation** of
data flows (client/server/SQL...), encapsulated in a media player. The compiler,
the renderer and that player live in `@dataflow-animator/core` and mount with no
framework at all (`mountPlayer(container, spec, options)`); the three published
bindings — `<DataFlowPlayer>` (React), `<dataflow-player>` (custom element) and
`<dfa-player>` (Angular) — are glue over that same call and render the same
pixels. **This document specifies the engine and the player, not any one
binding**; where it says "prop", read "option" outside React.

Core principle: time `t` (ms) is the single source of truth. The engine is a
**pure** function `evaluate(timeline, t) → visual state`; playback merely
advances `t` via `requestAnimationFrame`, and `seek` merely sets it. This makes
scrubbing, step navigation, and SSR trivial and deterministic.

> **Assumed divergence vs initial spec:** the sequencer does **not use GSAP**. A
> custom deterministic engine was chosen (total control over `seek`/steps/lifecycle,
> testability without DOM, light bundle, SSR-safe). The debugging overlay therefore
> inspects this internal timeline.

## 2. The player

Displayed according to the `controls` option (default: `true`):

- **Playback bar**: clickable timeline to jump to any instant.
- **Restart**: starts from the beginning and replays.
- **Play / Pause**.
- **Step navigation** (Previous / Next): navigates by "logical steps"
  (= root actions). "Next" plays until the end of the current step then
  stops; "Previous" goes back to the beginning of the step (then to the previous one).
  A `parallel` action is **atomic**: it counts as a single step (one stop at the
  group's end), so stepping never stops inside it on individual children.
- **Time readout**: the current instant and total duration are shown rounded to
  whole seconds (no decimals).
- **Fullscreen** (Fullscreen API).
- **Debug** (`debug` option): overlays inspecting the internal state of the timeline.

### 2.1 Text description (`transcript` option)

The player renders the animation TWICE: as pixels on the stage, and as an
ordered text built from the same compiled timeline by
[`describeAnimation`](../packages/core/src/a11y/describe.ts). The second
rendering is what makes an animation readable without sight.

- The root is a `region` named after `spec.description`, or a generic default.
- The stage carries `aria-hidden`: its labels are absolutely positioned, so in
  DOM order they are unordered strings in which the animation does not appear.
  The description, not the stage, is the accessible equivalent.
- The description holds a **summary** (`spec.description`, the cast of visible
  nodes, the step count) and **one entry per root step**. Each entry is a
  BUTTON that pauses and seeks the clock to that step — the same navigation the
  control bar offers, exposed as text.
- A `polite` live region announces the step the playhead enters. It is written
  only on a crossing, never on every frame.

Values: `'sr-only'` (default — present for assistive technology, revealed by a
button), `'visible'` (rendered open), `'none'` (omitted; leaves no accessible
equivalent at all, since the stage is hidden decor).

An element is named from the first speakable thing it offers: the text it
carries (header, query, badge, `text`), then WHAT IT IS (`a SQL response of 12
rows`, `an HTTP packet`). A packet's id is never a name — it is the author's
handle. A label with no letter or digit (spaces, punctuation, a lone symbol) is
not text either: a screen reader spells it out, so it falls through to the kind.

Sentences come from `{placeholder}` templates in `PlayerLabels`
(`describeMove`, `describeArrow`…), so they localise through the same object as
the rest of the chrome, and word order is the translator's. `spec.description`
and `Action.description` override the generated text where an author wants to
state intent the structure cannot carry.

## 3. Spatial rendering engine (Layout Engine)

Positions nodes **without (x, y) coordinates as input**, using relative ratios to
the container (pure CSS placement). See [`packages/core/src/engine/layout.ts`](../packages/core/src/engine/layout.ts).

- **Linear grids** (`left-to-right`, `right-to-left`, `top-to-bottom`,
  `bottom-to-top`): `lane` = position along the flow; nodes of the same lane
  are stacked on the transverse axis. Both axes share ONE step, measured in
  pixels rather than in ratios, and the grid is centred on the stage — so the
  gap between two neighbours is the same horizontally and vertically, and does
  not depend on how many nodes there are. The step is the largest that fits both
  axes, margins included.
- **Circular** (`circular`): the `is_main` node is placed at the center; the others are
  equidistant on a circle (trigonometry), ratio corrected to remain round.
- **Graph** (`graph`): free 2D layout for an **arbitrary graph** (Dijkstra, A\*,
  minimum spanning tree…) that has no natural flow, ring or tree order. Nodes are
  placed **automatically** — a deterministic force-directed pass that minimizes
  edge crossings (several seeded layouts, the fewest-crossing one kept, then a
  local search to clear residual crossings; aspect-independent so resizing never
  reshuffles the graph). A node MAY still declare `x` / `y` (fractions of the
  Stage, `0`..`1`) to **pin** itself as a fixed anchor the auto-placement routes
  around; when every node is anchored this degrades to a pure passthrough of the
  authored coordinates. `lane`, `align_with` and `main` are ignored. Edges are
  ordinary `connections` (weighted via `text`, undirected via `arrow_head:
'none'`, recolorable via `set_color`).
  Like `circular`, the connection anchor axis falls back to the dominant **pixel**
  axis (no flow direction).
- **Tree** (`tree`): a binary tree described by the `tree` root block (`root` +
  per-node `left`/`right` children). Each node is placed by its **in-order rank**
  (horizontal) and **depth** (vertical); the parent→child **edges are drawn
  automatically** from the block (no `connections`). The topology is the single
  source of truth for positions and edges, and can be restructured at runtime by
  the [`rotate_subtree` action](#5-animation-engine-and-actions) — a rotation
  preserves the in-order order, so only depths change and the nodes glide. `lane`
  and `align_with` are ignored.
  The auto-drawn edges are **stylable** without leaving the `tree` block: a
  `tree.edge_style` object sets a default for **every** edge (line `style`,
  `path`, `color`, `arrow_head`, `text`, `highlighted`), and `tree.edges` overrides
  it **per edge**, keyed by the **child** node id (each node has one parent edge, so
  the child names it — and the style follows the node through `rotate_subtree`).
  The override merges over the default field by field. Tree edges default to a
  **`straight`** path with **no** arrow head (unlike the `bezier` default of
  ordinary `connections`).
- **Circuit** (`circuit`): an **electrical schematic**. Two things change versus a
  dataflow diagram: (1) `connections` default to an **orthogonal wire**
  (`path: 'step'`) with **no arrow head**; (2) edges anchor on the components'
  **named terminals** via the `"node:pin"` endpoint syntax (see [§4](#4-routing-and-collision-prevention)).
  Placement (when no node has `x` / `y`): a single simple **loop** is auto-placed
  around a **rectangle** (in loop order; a component on a non-top edge is
  auto-rotated 90°/180°/270° so its terminals face the wire —
  `NodePlacement.rotation`); a connected **feed-forward** network (a logic
  diagram: inputs → gates → outputs) is auto-placed **left-to-right in layers**
  (longest-path layering + barycenter ordering). Anything else (a series-parallel
  network, a disconnected gallery) is positioned by the author with `x` / `y` (a
  fraction of the Stage, like a hand-authored `graph`), using `junction` dots for
  corners. A `junction` anchors every wire at its exact **centre** (a
  dimensionless point), so a labelled junction never skews the wires. Set
  **`diagonal_wires: true`** (spec level) to draw wires **octilinearly**: their
  corners are mitered into exact **45°** segments (only 45 / 135 / 225 / 315°), so
  long L-shapes and staircases collapse into clean diagonal runs while
  already-straight (aligned) wires stay straight; a short perpendicular stub is
  kept at each pin, and a miter that would cross a body falls back to a right
  angle. Override it per wire with **`Connection.diagonal`** (`true`/`false`).
  Where two wires of **different electrical nets** cross, one of them (the flatter
  segment, so normally the horizontal one) arches over the other in a small
  half-circle **bridge**, the way a schematic does: a wire that merely passes over
  another cannot then be misread as connected to it. Wires of the **same** net are
  never bridged — a fan-out T-junction stays flat, which is exactly what tells the
  two apart. Bridges are automatic; no spec field turns them on. The
  current is animated with the
  [`flow` action](#5-animation-engine-and-actions) and switches actuated with
  [`toggle`](#5-animation-engine-and-actions).
- **`align_with`**: aligns a node on the transverse axis of another (vertical if the
  direction is horizontal) → align two nodes from different lanes.
- **Zones** (`zones` root array): background rectangles encompassing a
  group of nodes and/or other zones (`contains`), with optional `color` and `label`.
  Automatically sized (fixed point to handle nesting),
  rendered below arrows and nodes.

**Node types**: thirteen **pictograms** (`desktop`, `laptop`, `client`, `server`,
`database`, `mobile`, `user`, `admin`, `users`, `cloud`, `alice`, `bob`, `eve` — the
last three represent **named characters**: Alice (bun), Bob (cap),
Eve (headset, spy), useful for cryptography and network protocol diagrams), two **textual** nodes
(`simple_node` = text box without pictogram, `complex_node` = header + body like
an HTTP packet), eight **geometric shapes** (`square`, `diamond`,
`circle`, `triangle`, `parallelogram`, `width_rectangle`, `height_rectangle`, `star`)
and a family of **electrical component** symbols (`resistor`, `potentiometer`,
`capacitor`, `polarized_capacitor`, `inductor`, `fuse`, `battery`, `dc_source`,
`ac_source`, `current_source`, `diode`, `led`, `transistor_npn`, `transistor_pnp`,
`opamp`, `switch`, `push_button`, `lamp`, `motor`, `buzzer`, `ground`, `junction`,
`signal` (a labelled logic I/O pad showing a bit, updated by `set_icon` and lit by
`set_color`), `ammeter`, `voltmeter`, `antenna`, `transformer`, `mosfet_n`,
`mosfet_p` (`gate` / `drain` / `source` — the two channel terminals are mirrored
between N and P so a CMOS pull-up and pull-down stack wire top-to-bottom) and
`transmission_gate`, plus **digital logic gates**
`and_gate`, `or_gate`, `not_gate`, `nand_gate`, `nor_gate`, `xor_gate`,
`xnor_gate`, `buffer_gate` — inputs `a` / `b` on the left, output `y` on the
right — their **three-input** counterparts `and3_gate`, `or3_gate`, `nand3_gate`,
`nor3_gate`, `xor3_gate` (inputs `a` / `b` / `c`), and a family of **fixed-pin
functional blocks** drawn as a labelled box rather than as the gates inside it:
`d_flip_flop`, `jk_flip_flop`, `t_flip_flop`, `sr_latch` (outputs `q` / `qn`),
`mux_2to1`, `demux_1to2` (select line entering from below) and `half_adder`,
`full_adder` (sum on the upper output row, carry on the lower).
Only blocks whose terminal COUNT is fixed belong to that family. A parametric one
— an N-bit register, a 4:1 mux, an n→2ⁿ decoder, an ALU — is `type: 'block'`
instead: a **generic box whose terminals are declared by {@link Node.pins}**
(`{ name, side?, label? }`, `side` defaulting to `'left'`). Terminals of one face
are spread evenly over it in declaration order, and the box SIZES ITSELF from
them — taller with the busiest of the left/right faces, wider with the longest
labels and the `body` designator.

The size and every terminal fraction come from one pure function,
[`engine/blockGeometry.ts`](../packages/core/src/engine/blockGeometry.ts), which
both the renderer and `resolvePin` read: a label and the wire that lands on it
cannot drift apart, because there is no second formula. Nothing is measured from
the DOM, so a block's geometry is known before mount and identical under SSR. A
block is excluded from the layout's lead-straightening nudges (`hasUniformBody`):
those compare terminal offsets as fractions of each body, which is only sound
while every symbol renders at one size.
Component symbols expose **named terminals** (see [§4](#4-routing-and-collision-prevention));
`switch` / `push_button` carry a `closed` state animated by the [`toggle` action](#5-animation-engine-and-actions).
Any node may also set `value` + `unit` to build its label (`"10 kΩ"`), combined
with `text` if both are present (`"R1 · 10 kΩ"`).
Each node can receive: a `text` (label), a `subicon` (known tech, registered icon
**or free text**), an `url` (making the node clickable), an
initial `content`, **colors** `background_color` / `border_color`, a
`rotation` (orientation in degrees), `merge_edges` (edge convergence on its
faces — default `true`, see [§4](#4-routing-and-collision-prevention)), and, on a
`circle`, `ports` (connection points on the outline — default `'direct'`, see
[§4](#4-routing-and-collision-prevention)).

**Rotation** (`rotation`, degrees, clockwise, default 0): orients the node's
**visual** (pictogram, shape or panel) without rotating its label (which stays
upright) nor its layout box — arrow anchoring is computed on the unrotated box, so
a rotated node connects exactly like a straight one. The orientation can be
**animated** at runtime via the [`rotate` action](#5-animation-engine-and-actions).
In a **`circuit`**, a component whose effective rotation is **vertical** (≈90°/270°,
so its terminals point up/down and it is wired top and bottom) draws its label to a
**side** — left near the left edge of the schematic, right otherwise — instead of
below, so the label never sits on the outgoing vertical wire. The wire router models
the label obstacle on that same side.

**Colors** (`background_color`, `border_color`, `text_color`): change the background,
border, and text of the node — fill/stroke of a shape, background/border of a
panel, badge + strokes of a pictogram, and color of the internal text. Each field
accepts a **predefined** CSS color (name: `tomato`, `steelblue`...) or an exact
**hexadecimal** value (`#3b82f6`). Automatic derivations (pure CSS, no JS,
valid for names as well as hex) when a `background_color` is provided without the
corresponding color: `border_color` → darkened background (`color-mix`); `text_color`
→ black or white depending on the background's luminance (`oklch(from …)`), for very strong
contrast. `text_color` applies **only if syntax highlighting is disabled**
(no `language`); otherwise the token colors take precedence. No effect when an
active `set_content` occupies the node.

**Textual nodes** (`simple_node`, `complex_node`): the content goes in `body`
(body) and, for `complex_node` only, `header` (header, separated from the body by a
line). The `language` field applies **syntax highlighting** to _all_ text areas
of the node (header + body). The `subicon` remains available; an active `set_content`
takes priority over the textual panel (just as it hides the pictogram).

These two types are **also valid packet kinds**: a packet declared with
`kind: 'simple_node'` or `kind: 'complex_node'` carries the same `body` / `header`
/ `language` fields and is rendered by the very same `NodePanel`, so a text box can
**travel** via a `move` action instead of being declared as an `http_packet`. The
moving wrapper drops its own box (`rdfa-packet--panel`) to avoid a box-in-a-box; the
panel is otherwise identical to the static node.

The node `subicon` likewise **doubles as a packet kind**: a packet declared with
`kind: 'subicon'` carries an `icon` field (same value space as the node `icon`:
known technology, registered icon, or short free text) and is resolved by the very
same `getSubIcon`, so a tech badge can **travel** on its own. The wrapper becomes a
round badge (`rdfa-packet--subicon`) — like the node's corner badge, but standalone
and larger.

**Geometric shapes** (`square`, `diamond`, `circle`, `triangle`, `parallelogram`,
`width_rectangle`, `height_rectangle`, `star`): an SVG shape drawn that can
contain a **short centered text** via `body` (`text` remains the label under the shape).
The shape expands to accommodate the text, but the latter is bounded (`max-width`)
and **cropped** (`overflow:hidden`) to never overflow the visible path — the `body`
is therefore intended for a brief label, not a paragraph. The `subicon` remains
available and an active `set_content` replaces the shape. All these families share
the same rendering path (`renderNodeVisual`, in the core's `dom/nodeElement`):
`isPanelNode`/`isShapeType` (`nodeKinds` module) arbitrate panel/shape/pictogram.
The exported `NodeView` component mounts that same function, so an isolated node
preview and a node inside the player cannot drift apart.

**Responsive scaling**: a "cell" (smallest distance between two
nodes, in px) drives a global scale factor (`--rdfa-scale`: larger icons/fonts in
fullscreen, smaller if space is tight) and caps the width of
panels/packets (`--rdfa-maxw`) so they never overlap neighbors.

**Spacing & bounds**: for few lanes, nodes spread towards the edges to
use available space (maximum distance between them). No element goes outside the
canvas: panel width accounts for edges, and each node's position
is bounded according to its measured size (comments fall under the node if necessary).
The font of panels/comments follows the scale moderately (max ~1.15×) so as
not to overflow.

## 4. Routing and collision prevention

Connections are drawn between the actual `BoundingClientRect` of the nodes (measured
client-side). Arrows and packets stop at a **margin** of a few pixels from the
node (`NODE_GAP`). See [`packages/core/src/engine/geometry.ts`](../packages/core/src/engine/geometry.ts).

- **Bidirectional shifting (path shifting)**: the compiler scans the entire spec
  (permanent connections + `move`/`arrow` actions). If a segment A↔B is used in
  both directions, both paths are shifted perpendicularly (`SHIFT_RATIO` × node
  size); the sign depends on the alphabetical order of ids → two parallel
  lanes. The perpendicular is calculated in a canonical frame of reference to never
  overlap A→B and B→A.
- **Edge convergence vs fan-out (`merge_edges`)**: when several links attach to
  the **same face** of a node, they meet at a single anchor point by default
  (`merge_edges: true`) — a many-to-one flow converges instead of spreading
  out. A node with `merge_edges: false` **fans out** its links instead: each
  pair gets its own attachment point along the face, ordered by the other end's
  transverse position to reduce crossings (`PORT_SPACING`). The decision is
  per-node-face (a link converges at the end whose node merges) and is
  independent of the intra-pair spreading above, which always applies. See
  [`packages/core/src/engine/portOffsets.ts`](../packages/core/src/engine/portOffsets.ts).
- **Outline anchoring on round nodes (`ports`)**: cardinal N/S/E/W anchoring
  fits boxes, not discs — an edge meeting a `circle` at an angle would leave a
  visible gap. A round node therefore anchors each edge on its **outline**,
  where the straight line to the other node's centre crosses it (radial). This
  is the default (`ports: 'direct'`, infinitely many points — "the most direct
  path"), which is what makes trees and graphs of circles look organic. Setting
  `ports` to a positive integer `N` exposes `N` evenly-spread points instead and
  snaps each edge to the nearest (edges on the same point merge; `4` reproduces
  N/E/S/W on the disc). The intra-pair bidirectional spread still applies (as a
  tangential nudge). Non-round nodes ignore `ports`. Implemented in
  `ellipseAttach` / `connection` in
  [`geometry.ts`](../packages/core/src/engine/geometry.ts);
  bezier handles leave along the radial normal (`pathShapes.ts`).

- **Named terminals on components (`"node:pin"`)**: electrical component symbols
  expose fixed, named terminals (a resistor's `a` / `b`, a battery's `+` / `-`, a
  transistor's `base` / `collector` / `emitter`). A `connection` (or `arrow` /
  `move` / `flow` step) targets one with the `"node:pin"` endpoint syntax
  (`"R1:a"`, `"battery:+"`); a bare `"node"` keeps the ordinary face/outline
  anchoring. The terminal map per type lives in
  [`packages/core/src/engine/pins.ts`](../packages/core/src/engine/pins.ts);
  the anchor (position + outward normal) is computed by `pinAttach` in
  `geometry.ts`. Each map follows the DRAWING of its own symbol rather than a
  shared skeleton: a bipolar transistor is drawn vertically, so its `collector` /
  `emitter` leave through the top and bottom faces, while a MOS transistor's
  channel terminals leave through the right one. The anchor **rotates with the
  node** — so a vertical resistor
  (`rotation: 90`) has its `a` / `b` terminals top and bottom, and its wires leave
  vertically. Terminal endpoints are distinct points by construction, so the
  bidirectional/fan-out port spread does not apply to them.

- **Net tinting is driven by an explicit list of logic drivers**, not by a name
  test: `isLogicDriver` in `pins.ts` names every type whose output defines a net
  (the gates, the `signal` pad, the flip-flops, the mux and the adders). A
  `transmission_gate` PASSES a net rather than driving one, and the transistors of
  a CMOS gate SHARE one output node, so neither tints — tinting per source node
  would paint one net in several colours.

## 5. Animation engine and actions

The timeline compiles an array of ordered actions. See
[`packages/core/src/engine/compiler.ts`](../packages/core/src/engine/compiler.ts).

1. **move**: moves a dynamic object (packet/request) from `from` to `to`;
   interpolation over `duration` ms; follows the shifted lane if bidirectional.
2. **arrow**: draws an SVG line between two nodes (progressive drawing `x2/y2`).
   Stroke styles `solid` / `dotted` / `dashed` / `animated` and path shape
   `path` (`bezier` by default, `simplebezier` / `straight` / `step` / `smoothstep`),
   optional middle text. **Permanent** arrows (decor) are declared in the
   `connections` root array (displayed from init); each also accepts a `color`
   (line color, predefined name or hex) and `highlighted` (permanent accent +
   glow, the static form of the `highlight` action).
3. **parallel**: encapsulates child actions executed at the same timestamp.
4. **loading**: spinner attached to a target node (simulates processing).
5. **set_content**: mutates the content of a node. Mode `code` (terminal + Prism highlighting,
   **without URL bar**; the code never wraps, its font
   adjusts to fit), `text`/`image` (browser window with URL bar
   configurable via `content.url`), `table`, or `html` — see §5.1.
6. **comment**: fading text bubble near a node (`object`).
7. **highlight**: highlights (pulsing halo) a static node or connection (by `object` = id).
8. **wait**: dead time — no clip emitted, the step simply occupies `duration` ms
   (default 1000) to freeze the image before the next step.
9. **set_visible**: shows or hides a static node (`object`) with a fade.
   The visibility state persists until the end of the chronology (or a
   contrary `set_visible`); complements the initial `visible` field of the nodes.
10. **set_color**: recolors a static node — or a permanent connection —
    (`object`) at runtime. A node uses any of `background_color` /
    `border_color` / `text_color`; a connection uses `color` (its single line
    color). Only the channels provided change. Eased, **deterministic**
    cross-fade between the previous color and the new one (CSS `color-mix`, so it
    stays scrubbable both ways). Same value space and auto-derivations as the
    static node colors (a `background_color` without border/text derives a
    coordinated border and a high-contrast ink). Like `set_visible`, the reached
    color persists until the end of the chronology, and successive `set_color` on
    the same target chain (each fades from the previous color). Core operation
    for recoloring visualizations (e.g. the red/black recoloring of a red-black
    tree, or lighting the edges a graph traversal follows).
11. **set_icon**: updates a static node's corner **icon badge** (`object`) at
    runtime — the small overlaid badge (`icon`: known technology, registered
    icon, or short free text). The badge swaps to the new value when the clip
    starts and, like `set_color`, the reached value persists until the end of
    the chronology; successive `set_icon` on the same node chain. Deterministic
    and scrubbable both ways. This is how a visualization keeps a **per-node
    scalar that evolves** legible on the node itself — a Dijkstra node's
    tentative distance (∞→7→5), an A\* node's `f = g + h` — instead of only in a
    comment. An empty string clears the badge.
12. **rotate**: animates the visual rotation of a node (`object`). Two mutually
    exclusive modes:
    - **target angle** `to` (degrees): a single _eased_ rotation. The start
      angle is the node's current rotation (its static `rotation`, or a previous
      `rotate`), so successive rotations chain in declaration order;
    - **continuous spin** `spin` (degrees per second, signed — positive turns
      clockwise, negative counter-clockwise): the node turns at a constant speed
      (_linear_, no easing). How long it spins reuses the usual timing fields —
      `duration` (spin that long, default 600 ms), `keep_until` (until another
      action starts), or `keep_until_end` (until the end of the chronology).

    `spin` takes precedence if both are given. Like `set_visible`, the angle
    reached when the rotation ends persists until the end of the chronology.
    Chaining after a spin is exact only in the `duration` mode (the stop angle of
    an open-ended `keep_until`/`keep_until_end` spin is not known at compile
    time, so a later `rotate` on that node resumes from the pre-spin angle).

13. **rotate_subtree**: restructures the binary `tree` (only in `direction: 'tree'`)
    with a left/right **tree rotation** around the pivot `object`, then animates
    the nodes gliding to their new depths while the edges re-route. The engine
    mutates the topology and recomputes BOTH positions and edges from that single
    model, so they can never disagree. A `left` rotation lifts the pivot's right
    child, `right` its left child (missing child → non-blocking warning).
    Successive `rotate_subtree` chain (each from the previous topology) — AVL
    double rotations `LR`/`RL` are just two in a row. A rotation preserves the
    in-order traversal, so horizontal slots are stable and only depths change.

14. **flow**: animates an **electric current** along a `route` (an ordered list of
    `node` / `node:pin` refs forming a path or loop). A train of `count` charge
    dots rides the concatenated wire path, one full lap per `duration` ms, looping
    by default (`loop: false` = single pass). `reverse` flips the direction
    (electron flow − → + vs conventional + → −), `color` tints the charges. The
    dot phase is a pure function of `t`, so it scrubs both ways; each consecutive
    pair of the route must be joined by a real wire. Signature animation of a
    `circuit`.
15. **toggle**: opens or closes a `switch` / `push_button` (`object`), swinging the
    lever over `duration` ms. Like `set_visible`, the reached state persists until
    the end of the chronology (or a contrary `toggle`) and is scrubbable both ways.

### 5.1 Content modes (`content` and `set_content`)

Both the static `node.content` and the `set_content` action carry an
`ObjectContent`, whose `type` selects one of five panels:

| `type`  | Panel                                     | Reads                            |
| ------- | ----------------------------------------- | -------------------------------- |
| `text`  | Fake browser window, URL bar always shown | `value`, `url`                   |
| `code`  | Terminal, no URL bar, font fitted         | `value`, `language`              |
| `table` | Data grid                                 | `columns`, `rows_data`           |
| `image` | Illustration in a browser window          | `value`, `frames`, `fps`, `loop` |
| `html`  | Rich markup, URL bar only if `url` is set | `value`, `url`                   |

**`html` — a sanitized subset, not a browser.** The markup in `value` is parsed
INERT (`DOMParser`), then REBUILT from an allow-list: an element, an attribute or
a CSS declaration that is not on a list never reaches the document. A spec is
data — it may come from a CMS or a database row — so this is a security boundary,
not a convenience. What is allowed:

- **Elements**: block and inline formatting (`p`, `h1`–`h6`, `ul`/`ol`/`li`,
  `dl`, `table`…, `b`, `em`, `code`, `mark`, `sub`, `sup`…), `img`, `figure`,
  and a narrow SVG subset (`svg`, `g`, `path`, `rect`, `circle`, `ellipse`,
  `line`, `polyline`, `polygon`, `text`, `tspan`, `title`, `desc`).
- **Attributes**: `style`, `title`, `lang`, `dir`; `src`/`alt`/`width`/`height`
  on `img`; `colspan`/`rowspan` on cells; the SVG presentation attributes.
- **CSS**: an allow-list of properties. `position` is absent (content must not
  escape its node), custom properties are absent (they would repaint the
  player), `url(…)` is refused in every value, and `!important` is stripped.

Refused, and each for a reason worth stating: `script`, `style`, `iframe`,
`form` and their contents (dropped outright); every `on*` handler; any URL whose
scheme is not `http`, `https` or `data:image/…`; `class` and `id`. `class` is
not a security question — **a class the host page styles renders on screen and
renders unstyled in the exported video**, because a rasterized frame carries only
the rules whose selector contains `rdfa`. Inline `style` travels with the
element, so it is what authors get instead. An unrecognised HTML element is
unwrapped (its text survives); `<a>` is unwrapped for the same reason a node
already has a `url` field.

**`html` — a screen, when it declares one.** By default the panel flows like a
paragraph: its box is capped by the node's allowance and its type keeps the
stylesheet's size, so the same markup re-flows differently at different player
sizes. `screen_width` (plus optional `screen_height`, defaulting to
`screen_width × 0.625`) turns it into a fixed DESIGN SPACE: the markup is laid
out once at that width and the renderer only changes the uniform SCALE
(`min(maxW/w, maxH/h)`, from the node's `ContentLimit` — pure arithmetic, never
a measurement). The arrangement is therefore identical at every size, which is
what a simulated interface needs and a paragraph does not. The address bar moves
INSIDE the screen so it scales with the page, the player's own
`--rdfa-content-scale` is neutralised inside it, and what overflows the box is
cropped.

**`image` — a still, or a sequence.** `value` alone is a still image. `frames` is
an ordered list of image sources played from the **animation's clock**: the frame
on screen is `floor(elapsed × fps) mod frames.length`, a pure function of `t`
like every other rendered value. It therefore pauses with the player, rewinds
when the scrub bar goes backwards, and exports frame-accurately. `fps` defaults
to 12 (clamped to `[0.1, 60]`); `loop: false` holds the last frame instead of
repeating.

An animated GIF in `value` does none of that — a GIF's playhead is not reachable
from JavaScript, so it keeps running while the player is paused and an exported
frame catches whichever moment the decoder was on. `frames` exists precisely to
replace it.

**Export constraint, both modes**: a rasterized frame is a `data:` SVG that can
load nothing external, so an `img` (or a `frames` entry) pointing at a remote URL
renders on screen and fails the video export. `data:` URIs are the form
guaranteed to survive.

## 6. Temporal lifecycle

- **Derived reading time**: an action carrying something to read and declaring no
  `duration` gets one worked out from its own content, rather than a per-type
  constant. The estimate is `ACQUIRE_MS + length / speed`, clamped to
  `[MIN_MS, MAX_MS]` and then scaled by `spec.pace` (default 1):
  - `comment` — the length of `text`, read as prose;
  - `set_content` — the length of the panel (`value`, plus a table's `columns`
    and `rows_data`), read at a speed that depends on `content.type`: code
    slowest, then tables, then text. An `html` panel is counted on its TEXT,
    with the markup stripped, and read at prose speed. An `image` has no length,
    so it gets a flat beat instead — unless it carries `frames`, in which case it
    gets the time the sequence needs to play through (still subject to the
    ceiling below).

  For a `comment`, that time is the **fully-present** stretch: the bubble is
  given an appearance phase first (its `fade_in_ms`, or `FADE_MS` by default),
  and `duration` starts once it is fully opaque. Otherwise a long reading time
  produced a long fade — the text becoming legible only at the moment it was due
  to have been read.

  An explicit `duration` always takes precedence, and `pace` never scales it — it
  is a stated intent, not an estimate. An action with nothing to read (empty text,
  empty panel) falls back to the per-type default. The estimate is deliberately
  **local**: it reads one action's own content and never what happens beside it,
  so an author can predict a duration from the action alone.

- **A fade never fills an appearance pause.** The fade-in lasts `FADE_MS` (or
  the pause itself, when that is shorter) — it is not stretched across the whole
  hold. The hold is the time an element is FULLY THERE; a fade spread over it
  would make a packet legible only once it was due to have been read.
- **Packet reading time**: a `move`'s ORIGIN hold is at least as long as the
  packet's own content needs — a header, a query, a row count are text the reader
  meets while the packet is still standing still. Charged on a packet's FIRST
  appearance only: a later leg shows the same text, and charging twice would pad
  the animation. Capped tighter than a comment's (the packet stays legible while
  it travels), and with no floor of its own — the proportional hold is the floor.
- **Derived travel time**: a `move` with no `duration` derives one from the
  LENGTH of its trip, so a scene holds one apparent speed instead of one
  duration. Distances are measured in a **fixed reference frame** (16:9), never
  in the player's real pixels: `compile()` has no geometry, and feeding it the
  live aspect would recompile the timeline on every resize — total duration and
  navigation stops would shift mid-playback. Same fixed-frame reasoning as the
  circuit router's letterbox.
- **Easing has roles, not one curve.** A packet's position follows a dedicated
  asymmetric curve (`easeTravel`): a decided departure, then a long settle,
  because arriving is the part that carries the information. Everything not yet
  given a role — opacity fades, tree edges, rotations, content cross-fades —
  still uses `easeInOutCubic`. Roles are added by writing a new curve and
  applying it at ONE call site, never by editing a shared one.
- **Proportioned holds**: the pauses framing a `move` (at its origin before
  leaving, at its destination before fading) are fractions of that move's own
  duration rather than flat constants, bounded at both ends, with the arrival
  given slightly more than the departure. `STEP_GAP` is deliberately NOT
  proportioned: it separates navigation stops, which is a functional role, not a
  decorative one.

- **`wait_for`**: the action starts at the **end** of the referenced action (by id).
  - _On a root action_ (directly in `timeline`): effective `startMs` =
    `max(ref.endMs, stepStart)`. `wait_for` can only **delay** the action,
    never make it start before the beginning of its own step. This bound prevents
    a wait_for to a very early action from producing a clip outside its step range
    (zero duration step, incorrect navigation).
  - _On a `parallel` child_: strict semantics — `startMs = ref.endMs`,
    without floor. The clip can then start before the beginning of the parallel block if the
    reference is earlier.
- **`keep_until`**: remains visible until the **beginning** of the targeted action.
- **Inter-step pause** (`STEP_GAP`): a short pause separates two root steps,
  so that the "Next" stop shows the "posed" step alone (without overlapping
  the appearance of the next one).
- **`keep_until_next`**: remains visible until the beginning of the next root step
  (thus across the pause). `wait` steps are **skipped** in this
  resolution: the posed content remains displayed during the dead time.
- **`keep_until_end`** (boolean): remains visible until the end of the chronology.
  Defaults: `move` → `false`; `arrow`/`comment`/`set_content` → `true`; `loading` → `false`.

## 7. Showcase site (GitHub Pages)

`apps/docs/` — Docusaurus site: **Home**, **Demos** (gallery),
**Playground** (live editor), **Documentation** (intro, concepts,
API reference generated from the JSON Schema). Built via
`npm run build:docs` and deployed on GitHub Pages by
`.github/workflows/ci-cd.yml`.

## 8. Math notation in prose fields (inline LaTeX)

Every **prose** field of a spec accepts a LaTeX subset between `$…$`, the same
delimiters GitHub markdown uses — `"$B_{in}$"` renders B with an "in" subscript.
Implemented in [`packages/core/src/tex/`](../packages/core/src/tex/),
with no external dependency: each command resolves to a literal character, so no
math font is downloaded.

**Where it applies**: `Node.text`, `Node.value`, `Node.unit`, `Node.body` (geometric
shapes only), `Zone.label`, `Connection.text`, `TreeEdgeStyle.text`, and the `text`
of the `comment` and `arrow` actions.

**Where it does NOT**: the `header`/`body` of a panel (`simple_node`,
`complex_node`) and of packets. Those go through syntax highlighting, where `$` is
a legitimate code character (PHP variables, shell) — math there would fight the
highlighter.

**Grammar.** Outside the `$`, text is **literal**: no existing label changes
meaning, so `snake_case` keeps its underscore. Inside:

| Syntax                               | Result                             |
| ------------------------------------ | ---------------------------------- |
| `_x`, `_{…}`                         | subscript                          |
| `^x`, `^{…}`                         | superscript                        |
| `{…}`                                | group                              |
| `\overline{…}`                       | overbar — the logic complement (Ā) |
| `\text{…}`, `\mathrm{…}`             | upright text                       |
| `\alpha`…`\omega`, `\Gamma`…`\Omega` | Greek letters                      |
| `\cdot`, `\times`, `\leq`, `\to`…    | operators, relations, arrows       |
| `\,` `\;` `\quad` `\!`               | spacing                            |

**Styling** follows LaTeX: latin letters and lowercase Greek are variables and
render _italic_; digits, operators and uppercase Greek stay upright — which is what
keeps `10 kΩ` reading as a unit rather than a product of variables.

**Escaping**: `\$` is a literal dollar. An unpaired `$` stays literal too, so a
label mentioning a price is never swallowed by a half-open span.

**Not supported**, deliberately: `\frac`, matrices, and `$$…$$` display math. A
label on a diagram is one line tall; a construct needing two would break the
layout it sits in rather than serve it. `$$` is left literal instead of being
silently dropped.

**Two renderers, one AST.** Prose reaches the screen through both HTML (node
labels) and SVG (connection labels), and SVG has no `<sub>`. The SVG renderer
therefore flattens the tree into sibling `<tspan>`s with an explicit cumulative
`dy` — see `dom/richtext.ts` (`appendRichTextSvg`) for why a naive recursion
fails there.

**Authoring trap (JS/TS specs)**: in a JavaScript string, `'\overline'` silently
becomes `'overline'` — an unrecognized escape drops its backslash. Any command
must be written `'\\overline{A}'` (or the string be a raw `String.raw`). In JSON
files, likewise `"\\overline{A}"`.

## 9. Implementation notes and evolutions

- **Textual** nodes `simple_node` / `complex_node`: text box (`body`, plus
  `header` for `complex_node`) instead of a pictogram, optional highlighting via
  `language` (applied to all areas). `complex_node` takes on the appearance of an
  HTTP packet. Rendered by the panel branch of `dom/nodeElement.ts`.
- **Geometric shapes** (`square` ... `star`): SVG shape (`preserveAspectRatio="none"`,
  `non-scaling-stroke`) with a short centered `body`. Security margin by shape +
  `max-width` + `overflow:hidden` guarantee the text does not overflow the path.
  Drawn by the shape branch of `renderNodeVisual`; the `isShapeType` predicate
  lives in the core's `render/nodeKinds` (single source of truth, like
  `isPanelNode`).
- **Node colors** (`background_color` / `border_color` / `text_color`): placed
  as CSS variables `--rdfa-fill` / `--rdfa-stroke` / `--rdfa-ink` on the root
  `.rdfa-node` (`nodeColors.ts`), read by the CSS of shapes/panels/pictograms with
  fallback to the theme. Auto derivations (pure CSS, SSR-safe, format independent):
  border = `color-mix(in srgb, <background>, #000 32%)`; text = `oklch(from var(--rdfa-fill)
clamp(0, (0.62 − l) × 1000, 1) 0 0)` (black/white according to luminance). `--rdfa-ink`
  is read **only outside code areas** (`:not(.rdfa-code)`): syntax highlighting
  takes precedence. A `background_color` on a pictogram adds a badge (`rdfa-node--tinted`).
- `is_navigable` has been **removed from the spec**: navigability is a `controls` option.
- Decor arrows have migrated from `static_objects` to the `connections` root array.
- `comment` uses `object` (and no longer `next_to`) to target its node.
- `style`: SVG/CSS terminology `solid`/`dotted`/`dashed` (`full` tolerated as alias).
- `path`: shape of the path of an arrow/connection (`bezier` by default,
  `simplebezier`/`straight`/`step`/`smoothstep`) — orthogonal to `style`. The
  curvature only appears with a transverse offset; `move` packets
  follow the `bezier` path by default.
- `subicon` accepts **free text** in addition to icons (react-icons).
- `response_content.data` removed (never rendered); only `rows` is displayed.
- Actions modeled as **discriminated union** (TS + schema `oneOf`) → actual validation.
- **`language`: TS ↔ schema divergence (intentional).** The TypeScript type is
  `HighlightLanguage | (string & {})` — any string is valid at
  compile time so as not to break consumers. But the script
  `packages/core/scripts/schema-patches.mjs` removes the free
  `{type:string}` branch from the generated schema and keeps only the `$ref` to
  `HighlightLanguage`. Consequence: a language outside the enum passes the
  TypeScript compiler but is rejected by Ajv. This is intended: the schema is stricter
  than the types to preserve auto-completion and validation.
- A missing reference (missing required field, unknown `wait_for` id...) produces a
  **non-blocking warning** (visible with `debug`) rather than a crash.
- Syntax highlighting: **Prism** (dependency), replaceable via the `highlight` option.
- **Scoped** styles under `.rdfa-` + CSS variables. Two independent axes: the
  `theme` option picks a **palette** (`default`, `dots`, `blueprint`, `pcb`,
  `chalk`, `terminal`, `paper`, `neon`), the `mode` option picks its **light or
  dark variant**. Each palette declares both variants once, via `light-dark()`.
- **`auto` mode (default)**: the mode is resolved into `color-scheme` in CSS
  only (SSR-safe, no JS) — it follows a `[data-theme]` ancestor (Docusaurus
  convention) → syncs with the host's theme toggle, and `prefers-color-scheme`
  otherwise.
- Moving objects (packets) are rendered **in the foreground** (above
  `set_content` panels). `set_content` appears/disappears with a **fade**.
