# DataFlowSpec — field reference

Generated from the JSON Schema. `field?` is optional; `A | B` is a union; a
name in backticks refers to the section of the same name. `Action` is a
discriminated union on `type`.

## DataFlowSpec

- `direction?`: `Direction` — Node placement direction. For the flow (`left-to-right` …), `circular` and `tree` modes you provide **no coordinates** — the engine arranges nodes from `lane` / `main` / the `TreeSpec`. Default: 'left-to-right'. Use `'tree'` to lay out a binary tree (in-order rank → horizontal, depth → vertical) and enable the `RotateSubtreeAction`. Use `'graph'` for an arbitrary graph (Dijkstra, A\*, minimum spanning tree…): nodes are auto-placed to minimize edge crossings, and a node MAY pin itself with `x` / `y`. Use `'circuit'` for an electrical schematic: `connections` drawn as orthogonal **wires** (no arrow head) by default, edges anchored on the components' **named terminals** (`"node:pin"`); a single loop or a feed-forward logic network is auto-placed, anything else is positioned with `x` / `y`.
- `diagonal_wires?`: `boolean` — (`direction: 'circuit'` only) Draw wires **octilinearly**: their corners are mitered into exact 45° segments (only 45 / 135 / 225 / 315°), so long L-shapes and staircases collapse into clean diagonal runs, while wires that are already straight (aligned terminals) stay straight. A short perpendicular stub is kept at each component pin, and a miter that would cross a body falls back to a right angle. Override per wire with `Connection.diagonal`. Default: false (strict horizontal/vertical wires). Ignored by every other direction.
- `nodes`: `Node[]` — Fixed elements of the scene (servers, clients, databases…). They form the permanent decor and are placed automatically according to `direction` and their `lane`.
- `tree?`: `TreeSpec` — Binary-tree topology, **required when `direction` is `'tree'`** (ignored otherwise). Drives the layout and the auto-drawn parent/child edges, and is the structure mutated by `rotate_subtree`. See `TreeSpec`.
- `packets`: `Packet[]` — Mobile elements (requests, responses, messages). Declared here, then moved from one node to another by a `move` action in the `timeline`.
- `connections?`: `Connection[]` — Permanent arrows/links (decor) displayed upon initialization.
- `zones?`: `Zone[]` — Rectangular regions displayed in the background around a group of nodes.
- `timeline`: `Action[]` — Animated scenario: ordered list of actions (moves, arrows, comments…) played sequentially. Each root action becomes a navigable step.
- `description?`: `string` — What this animation shows, in one or two sentences — the opening line of the player's text description, which is what a screen-reader user hears before any step. The rest of that description (the cast of elements and every step) is generated from the spec, so omitting this still produces a usable one; it loses only the part no structure can supply, which is what the animation is ABOUT. Per-step wording is `Action.description`.
- `pace?`: `number` (0.1..10) — Scales the reading time the engine DERIVES for actions that carry something to read — a `comment`'s text, a `set_content`'s panel — when they declare no `duration` of their own. Above 1 leaves more time (1.25 = a quarter longer), below 1 moves faster. Default: 1. It is the single knob for the whole animation's pace: derive everything, then nudge it in one place if the result reads too fast or too slow for your audience. It deliberately does NOT touch a `duration` you wrote yourself — that is an explicit intent, not an estimate to be scaled.

## Direction

How nodes are placed: along a flow (`left-to-right`, `right-to-left`, `top-to-bottom`, `bottom-to-top`, positioned by `lane`), on a ring around the `main` node (`circular`), as an auto-placed arbitrary graph (`graph`), as a binary tree (`tree`, driven by the `tree` block) or as an electrical schematic (`circuit`).

`"left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top" | "circular" | "graph" | "tree" | "circuit"`

## Node

- `id`: `string` — Unique node identifier (e.g., 'web_server').
- `type`: `NodeType` — Node appearance: pictogram (server, client…), text node (panel) or geometric shape. See previews of each value.
- `text?`: `string` — Label displayed below the node. Supports inline LaTeX between `$…$` — `"$B_{in}$"` renders B with an "in" subscript (see the "Math notation" page).
- `visible?`: `boolean` — Initial visibility of the node. Default: true. A hidden node can be displayed via the `set_visible` action.
- `icon?`: `string` — Overlaid badge: name of a known technology (e.g., 'react', 'postgres'), name of a registered icon, or short free text (e.g., 'v2', 'API').
- `lane?`: `number` — Placement row/column (positive integer). Default: 1.
- `main?`: `boolean` — (circular) Marks the node as a central node. Default: false.
- `align_with?`: `string` — Aligns this node on the transverse axis of another node (by ID): useful for aligning two nodes from different lanes. Ignored in circular layout.
- `x?`: `number` (0..1) — (`graph`, `circuit`) Horizontal position as a fraction of the Stage, from 0 (left edge) to 1 (right edge). Used **only** when `direction` is `'graph'` or `'circuit'`. **Optional:** omit it and the node is placed AUTOMATICALLY (in `graph`, the layout minimizes edge crossings; in `circuit`, a single loop or a feed-forward logic network is auto-arranged). Provide it to **pin** the node as a fixed anchor — handy to fix a source, a target, or the overall orientation, and required for a `circuit` that is neither a loop nor feed-forward. Ignored by every other direction (which derive positions from `lane` / `main` / the tree).
- `y?`: `number` (0..1) — (`graph`, `circuit`) Vertical position as a fraction of the Stage, from 0 (top edge) to 1 (bottom edge). Companion of `Node.x`: used only when `direction` is `'graph'` or `'circuit'`, omit for automatic placement, provide to pin the node. Ignored otherwise.
- `merge_edges?`: `boolean` — Edge convergence on the node's faces. When `true` (the default), all connections / arrows / moves attaching to the same face of this node meet at a **single anchor point**: a many-to-one flow (a flood, a load balancer, a hub) visually converges instead of spreading out. Set to `false` to **fan out** the edges instead — each pair gets its own attachment point along the face, ordered to reduce crossings. Useful when a node has several distinct neighbours on the same side and you want to tell the links apart. Independent from the spreading of multiple edges between the *same* two nodes (bidirectional request/response tracks stay distinct regardless). Default: true.
- `ports?`: `"direct" | number` — Connection points on a **round** node's outline (`type: 'circle'`), so edges meet the circle wherever they naturally point instead of snapping to the four cardinal sides — the reason graphs and binary trees look more organic. - `'direct'` (**the default for a circle**): the edge aims at the node centre and attaches exactly where that straight line crosses the outline — an *infinite* set of possible points, i.e. the most direct path. - a positive integer `N`: exactly `N` attach points, spread evenly around the outline; each edge snaps to the nearest one (`4` reproduces N/E/S/W on the round contour). Edges landing on the same point merge, like `merge_edges`. Ignored on non-round node types (which keep cardinal-side anchoring).
- `url?`: `string` — URL making the node clickable (opens in a new tab).
- `background_color?`: `string` — Background color of the node: shape fill, panel background (`simple_node`/`complex_node`), pill behind a pictogram. Accepts a **predefined** CSS color (name: `tomato`, `steelblue`, `teal`…) or an **exact hex** value (`#3b82f6`). No effect on an active `set_content`.
- `border_color?`: `string` — Node border / stroke color (shape stroke, panel borders, stroke color of a pictogram). Same format as `background_color`. If `background_color` is defined but not `border_color`, a coordinated border (darker variant of the background) is automatically generated.
- `text_color?`: `string` — Color of the text displayed IN the node (shape body, panel header/body), **only when syntax highlighting is disabled** (no `language`: otherwise syntax colors take precedence). Same format as `background_color` (predefined name or hex). If not defined but a `background_color` is, a high-contrast color with the background (black or white) is automatically chosen.
- `content?`: `ObjectContent` — Initial content displayed in the node (code terminal, window, etc.).
- `body?`: `string` — Text displayed IN the node, as opposed to `text` which remains the label below the node. For `simple_node` / `complex_node`: panel body (line breaks respected, colored according to `language` if provided). For geometric shapes (`square` … `star`): short centered text in the shape (keep it brief so it doesn't overflow), which supports inline LaTeX between `$…$` (see the "Math notation" page). A panel body does NOT: `$` is a legitimate character there, and the text goes through syntax highlighting.
- `header?`: `string` — (`complex_node`) Header displayed above the `body`, separated by a line — the node then looks like an HTTP packet. Ignored by `simple_node`. Colored according to `language` if provided.
- `language?`: `HighlightLanguage` — (`simple_node` / `complex_node`) Syntax highlighting language applied to ALL text areas of the node (`header` and `body`). Recognized values: see `HighlightLanguage`.
- `rotation?`: `number` — Clockwise rotation of the node visual, in degrees. The label below the node stays upright and arrow anchoring is unchanged (the layout box is not rotated). Can be animated with the `rotate` action. Default: 0. **Exception — electrical components:** a component's **named terminals** ( `NodeType`: `resistor`, `transistor_npn`…) DO rotate with the symbol, so a vertical resistor (`rotation: 90`) has its `a`/`b` terminals at the top/bottom. This is the intended behavior for circuits.
- `pins?`: `BlockPin[]` — (`block`) Terminals of a generic functional block, in declaration order per face. The box SIZES ITSELF from them: its height follows the busiest of the `left` / `right` faces, its width the longest labels plus the `body` text, so a 4:1 multiplexer and an 8-bit register are the same node type at two different sizes. Wire a terminal by name like any other component (`"mux:i3"`, `"reg:clk"`). Ignored by every other node type — which carry their terminals in the library instead, `d_flip_flop` and `mux_2to1` included.
- `closed?`: `boolean` — (Electrical `switch` / `push_button`) Initial state of the contact: `true` = closed (conducting), `false` = open (the default). Animate it with the `toggle` action — the lever swings and the state persists. Ignored by every other node type.
- `value?`: `string | number` — Component value shown in the label (mainly for electrical components): a resistance, capacitance, voltage… Combined with `Node.unit` to form `"<value> <unit>"`. If `Node.text` is also set, the value is appended to it (`"R1 · 10 kΩ"`). Purely a label convenience.
- `unit?`: `string` — Unit appended after `Node.value` in the label (`kΩ`, `µF`, `V`, `mA`…). Ignored when `value` is absent.

## NodeType

Node types (appearance). Decor arrows live in `connections`. Four families: - **Pictograms** (`desktop` … `cloud`): a fixed SVG icon. - **Text nodes** (`simple_node`, `complex_node`): a text box (body only, or header + body like an HTTP packet). - **Geometric shapes** (`square` … `star`): a drawn shape that can contain short centered text (`body` field). - **Electrical components** (`resistor` … `transformer`): schematic symbols with **named terminals** (see `Node.pins` — actually resolved from the type). A `Connection` targets a specific terminal with `"node:pin"` (e.g. `"R1:a"`, `"Q1:base"`). Best drawn in `direction: 'circuit'`.

`"desktop" | "laptop" | "client" | "server" | "database" | "mobile" | "user" | "admin" | "users" | "cloud" | "alice" | "bob" | "eve" | "simple_node" | "complex_node" | "square" | "diamond" | "circle" | "triangle" | "parallelogram" | "height_rectangle" | "width_rectangle" | "star" | "resistor" | "potentiometer" | "capacitor" | "polarized_capacitor" | "inductor" | "fuse" | "battery" | "dc_source" | "ac_source" | "current_source" | "diode" | "led" | "transistor_npn" | "transistor_pnp" | "opamp" | "switch" | "push_button" | "lamp" | "motor" | "buzzer" | "ground" | "junction" | "signal" | "ammeter" | "voltmeter" | "antenna" | "transformer" | "mosfet_n" | "mosfet_p" | "transmission_gate" | "and_gate" | "or_gate" | "not_gate" | "nand_gate" | "nor_gate" | "xor_gate" | "xnor_gate" | "buffer_gate" | "and3_gate" | "or3_gate" | "nand3_gate" | "nor3_gate" | "xor3_gate" | "d_flip_flop" | "jk_flip_flop" | "t_flip_flop" | "sr_latch" | "mux_2to1" | "demux_1to2" | "half_adder" | "full_adder" | "block"`

## ObjectContent

- `type?`: `ContentType` — Content display mode: `code` (colored terminal), `text` (browser-like window), `image` (illustration), `table` (data table) or `html` (rich markup, sanitized).
- `value?`: `string` — Textual content according to `type`: source code (`code`), text (`text`), image path/URL (`image`) or markup (`html`).
- `language?`: `HighlightLanguage` — Language for syntax highlighting. Recognized values: see `HighlightLanguage`.
- `url?`: `string` — (`text` mode, and `html` when provided) URL displayed in the window's address bar. An `html` panel with no `url` renders bare, without chrome.
- `screen_width?`: `number` — (`html` mode) Width, in px, of the DESIGN SPACE the markup is laid out in. Setting it turns the panel into a SCREEN: the layout is computed once at this width and then scaled uniformly to fit the room the node has, so the same arrangement is recognisable at every player size instead of re-flowing. Clamped to `[40, 4000]`.
- `screen_height?`: `number` — (`html` mode) Height of the design space, in px. Default: `screen_width × 0.625` — a 16:10 lid. A screen is a fixed box: what does not fit is cropped, as it is on a real one.
- `frames?`: `string[]` — (`image` mode) Frame sequence played from the ANIMATION's clock rather than the browser's: it pauses with the player, rewinds when scrubbed backwards and exports frame-accurately — none of which an animated GIF in `value` can do. Each entry is an image source, ideally a `data:` URI (a remote one cannot be rasterized by the video export). `value` is the still shown when the list is empty.
- `fps?`: `number` — (`image` mode) Playback rate of `frames`, in frames per second. Clamped to `[0.1, 60]`. Default: 12.
- `loop?`: `boolean` — (`image` mode) Whether `frames` repeats. `false` holds the last frame once the sequence has played through. Default: true.
- `columns?`: `string[]` — (`table` mode) Column headers.
- `rows_data?`: `((string | number)[])[]` — (`table` mode) Data rows.

## ContentType

Content modes for `set_content` (action) and `content` (static object).

`"image" | "text" | "code" | "table" | "html"`

## HighlightLanguage

Languages supported by the syntax highlighting engine (Prism).

`"javascript" | "js" | "typescript" | "ts" | "json" | "sql" | "bash" | "sh" | "shell" | "python" | "py" | "csharp" | "cs" | "html" | "xml" | "markup" | "css" | "jsx" | "tsx" | "http"`

## BlockPin

One declared terminal of a `type: 'block'` node. The fixed-pin symbols (`d_flip_flop`, `mux_2to1`, `full_adder`…) carry their terminals in the library because their COUNT never varies. A block is the escape hatch for everything whose count does — a 4:1 multiplexer, an n→2ⁿ decoder, an N-bit register, an ALU — which would otherwise need one node type per size, forever.

- `name`: `string` — Terminal name, used in `"node:pin"` endpoint references (`"mux:i3"`). Must be unique within the block.
- `side?`: `BlockSide` — Face the terminal sits on. Terminals of the same face are spread evenly over it, in DECLARATION order (top to bottom on `left` / `right`, left to right on `top` / `bottom`). Default: `'left'`.
- `label?`: `string` — Text drawn inside the box next to the terminal. Defaults to BlockPin.name — set it when the wiring name and the printed name differ (`name: 'i0'`, `label: 'D0'`). Supports inline LaTeX between `$…$`.

## BlockSide

Face of a `block` a terminal sits on.

`"left" | "right" | "top" | "bottom"`

## TreeSpec

Binary-tree topology (used when `direction` is `'tree'`). Single source of truth for the structure: parent/child **edges are derived from it** (and drawn automatically — no `connections` to maintain), and the layout places each node by its **in-order rank** (horizontal) and **depth** (vertical). The `RotateSubtreeAction` mutates this topology at runtime and the engine re-lays-out and re-routes the edges from this same model.

- `root`: `string` — ID of the root node.
- `children`: `{ [id]: TreeChildren }` — Left/right child of each (internal) node, by node ID. A node absent from this map — or with an empty entry — is a leaf.
- `edge_style?`: `TreeEdgeStyle` — Default styling applied to EVERY parent→child edge — the place to set the `path` (or the line style / color) once for the whole tree. Tree edges otherwise default to a `straight` path and no arrow head. Overridden per edge by `TreeSpec.edges`. See `TreeEdgeStyle`.
- `edges?`: `{ [id]: TreeEdgeStyle }` — Per-edge styling override, keyed by the **child** node ID: since every node has exactly one parent, its id names the incoming edge unambiguously (and the style follows the node through `RotateSubtreeAction`). Each entry is merged OVER `TreeSpec.edge_style`, field by field. See `TreeEdgeStyle`.

## { [id]: TreeChildren }

`{ [key]: TreeChildren }`

## TreeChildren

Left/right children of a node in a binary tree.

- `left?`: `string` — ID of the left child (smaller key), if any.
- `right?`: `string` — ID of the right child (greater key), if any.

## TreeEdgeStyle

Visual styling for the parent→child edges auto-drawn in a `'tree'` layout. Orthogonal to the topology (`children` stays a pure structure): it is applied at RENDER time, so it survives `RotateSubtreeAction` re-routing — a style keyed to a child follows that node as its depth changes. Used both as the tree-wide default ( `TreeSpec.edge_style`) and as a per-edge override ( `TreeSpec.edges`), the override merged over the default field by field. Same vocabulary as a `Connection`, but tree edges have their own defaults: a **`straight`** path (not `bezier`) and **no** arrow head (they are plain hierarchy links, not directed arrows).

- `style?`: `LineStyle` — Line style. Default: 'solid'.
- `path?`: `PathShape` — Shape of the edge path. Default (tree): 'straight'. See `PathShape`.
- `arrow_head?`: `"forward" | "backward" | "both" | "none"` — Arrow head. Default (tree): 'none' — parent→child links carry no head.
- `text?`: `string` — Optional median label drawn on the edge. Supports inline LaTeX between `$…$` (see the "Math notation" page).
- `color?`: `string` — Line color (predefined CSS name or hex). Tints the whole path and its arrow head(s). Default: the theme's neutral connection color.
- `highlighted?`: `boolean` — Emphasizes the edge permanently — accent color, thicker stroke and glow — like a statically `Connection.highlighted` link. Default: false.

## LineStyle

Line style (SVG/CSS terminology). `full` is accepted as an alias for `solid`.

`"solid" | "dotted" | "dashed" | "animated"`

## PathShape

Shape of the arrow / connection path — orthogonal to `LineStyle`, which only sets the stroke pattern (solid, dotted…). Default: 'bezier'. - `bezier`: smooth S curve, handles along the dominant axis (default); - `simplebezier`: same idea, more subtle curvature; - `straight`: direct segment (bypasses sandwiched labels); - `step`: orthogonal path with right angles; - `smoothstep`: orthogonal path with rounded angles. On two perfectly aligned nodes (same row/column), all shapes merge into a straight line: curvature only appears in the presence of a transverse offset (different lanes, fan-out, bidirectional tracks).

`"bezier" | "simplebezier" | "straight" | "step" | "smoothstep"`

## { [id]: TreeEdgeStyle }

`{ [key]: TreeEdgeStyle }`

## Packet

- `id`: `string` — Unique identifier of the packet.
- `kind`: `PacketKind` — Packet category, which sets its appearance and expected content: `http_packet` (header + body via `packet_content`), `sql_request` (textual request via `request_content`), `sql_response` (response via `response_content`), a **text panel** (`simple_node` / `complex_node`) that travels: same look and content fields as the homonymous `NodeType` (`body`, plus `header` for `complex_node`, optionally syntax-highlighted via `language`), or a **tech badge** (`subicon`) that travels: the same `Node.icon` badge (known technology, registered icon, or short free text), via `icon`.
- `request_content?`: `string` — Textual request (e.g., for sql_request).
- `response_content?`: `SqlResponse` — Content of a `sql_response`: number of rows, header and body (text or table).
- `packet_content?`: `PacketContent` — Content of an `http_packet`: header (e.g., 'GET /api') and optional body.
- `body?`: `string` — (`simple_node` / `complex_node`) Panel body text (line breaks respected, colored according to `language` if provided). Same role as `Node.body`.
- `header?`: `string` — (`complex_node`) Header displayed above the `body`, separated by a line — the packet then looks like an HTTP packet. Ignored by `simple_node`. Same role as `Node.header`.
- `language?`: `HighlightLanguage` — (`simple_node` / `complex_node`) Syntax highlighting language applied to ALL text areas of the panel (`header` and `body`). Recognized values: see `HighlightLanguage`. Same role as `Node.language`.
- `icon?`: `string` — (`subicon`) The tech badge that travels: name of a known technology (e.g., 'react', 'postgres'), name of a registered icon, or short free text (e.g., 'v2', 'API'). Same role as `Node.icon`.

## PacketKind

`"http_packet" | "sql_request" | "sql_response" | "simple_node" | "complex_node" | "subicon"`

## SqlResponse

- `rows?`: `number` — Number of rows returned.
- `header?`: `string` — Optional header visible in the packet.
- `body?`: `SqlResponseBody` — Response body (pure text or table).

## SqlResponseBody

- `type?`: `"text" | "table"`
- `value?`: `string` — Pure text if type is 'text'
- `columns?`: `string[]` — Table columns if type is 'table'
- `rows_data?`: `((string | number)[])[]` — Data rows if type is 'table'

## PacketContent

- `header?`: `string` — Header visible in the packet (e.g., 'GET /api').
- `body?`: `PacketBody`

## PacketBody

- `type?`: `"text" | "image"`
- `value?`: `string` — Text or image path.
- `language?`: `HighlightLanguage` — Language for text syntax highlighting (optional). Recognized values: see `HighlightLanguage`.

## Connection

Permanent link/arrow (decor), displayed upon initialization.

- `id?`: `string` — Optional identifier.
- `from`: `string` — Source node ID.
- `to`: `string` — Destination node ID.
- `style?`: `LineStyle` — Line style. Default: 'solid'.
- `path?`: `PathShape` — Shape of the link path. Default: 'bezier'. See `PathShape`.
- `diagonal?`: `boolean` — (`direction: 'circuit'` only) Draw THIS wire octilinearly (`true`, 45° miters) or force it strictly orthogonal (`false`), **overriding** the circuit-wide `DataFlowSpec.diagonal_wires`. Unset = inherit that circuit default. Ignored outside `circuit`.
- `arrow_head?`: `"forward" | "backward" | "both" | "none"` — Arrow head. Default: 'forward'.
- `text?`: `string` — Optional median text. Supports inline LaTeX between `$…$` (see the "Math notation" page).
- `color?`: `string` — Line color (predefined CSS name or hex). Tints the whole path and its arrow head(s); the median `text` label keeps the theme color for legibility. Default: the theme's neutral connection color. A runtime `set_color` on this connection's `id` recolors it, and an active `highlight` (accent) takes precedence over both.
- `highlighted?`: `boolean` — Emphasizes the connection permanently, from initialization — the same accent color, thicker stroke and glow the `HighlightAction` applies, but static (no timeline action needed). Default: false.

## Zone

Rectangular region enclosing a group of nodes and/or other zones.

- `id?`: `string` — Optional identifier (required to be referenced in the `contains` of another zone).
- `contains`: `string[]` — IDs of the enclosed nodes and/or zones.
- `color?`: `string` — CSS color of the border and semi-transparent background.
- `label?`: `string` — Label displayed at the top left of the zone. Supports inline LaTeX between `$…$` (see the "Math notation" page).

## Action

Discriminated union of actions (by `type`).

`MoveAction | ArrowAction | ParallelAction | LoadingAction | SetContentAction | CommentAction | HighlightAction | SetVisibleAction | SetColorAction | SetIconAction | RotateAction | RotateSubtreeAction | FlowAction | ToggleAction | WaitAction`

## Common action fields

Every action accepts these, in addition to its own fields.

- `id?`: `string` — Action ID to refer to it (wait_for / keep_until).
- `description?`: `string` — What this step means, in one sentence, for the player's text description (see `DataFlowSpec.description`). The description is generated from the action itself when this is omitted — "GET /users travels from Browser to Web server" — so an animation is described whether or not anyone writes anything. Provide it when the generated sentence would be accurate and still miss the point: the structure knows a packet moved, only you know it moved BECAUSE the cache missed. A `comment` action needs it least of all: its `text` is already your own narration, and it is used verbatim.
- `duration?`: `number` (≥ 1) — Animation duration in ms (default: 500, 1200 for loading).
- `wait_for?`: `string` — ID of another action: this action starts at the end of that one.
- `keep_until?`: `string` — ID of a future action: this action remains visible until its start.
- `keep_until_next?`: `boolean` — Remains visible until the start of the next root step. Default: false for `move`/`loading`, true for `arrow`/`comment`/`set_content`.
- `keep_until_end?`: `boolean` — If true, remains visible until the end of the timeline.
- `delay_ms?`: `number` (≥ 0) — Start offset in ms, added after resolving `wait_for` and the step clamp. Mainly useful in a `parallel` block to stagger actions against each other (staggered sequence animations). Also applies to an entire `parallel` action to delay the whole group.
- `fade_in_ms?`: `number` (≥ 0) — Fade-in duration in ms. Default: 250 ms — or the element's appearance pause when that pause is shorter. The fade never fills the whole pause: a packet held at its origin to be read appears first, then stays legible for the rest of it. 0 = instant appearance.
- `fade_out_ms?`: `number` (≥ 0) — Fade-out duration in ms. Default: 250. 0 = instant disappearance. No effect if `keep_until_end` is true.

## MoveAction

Moves a packet from `from` to `to`.

- `type`: `"move"`
- `object`: `string` — ID of the packet (declared in `packets`) to move.
- `from`: `string` — Start node ID.
- `to`: `string` — Arrival node ID.
- …plus the common action fields.

## ArrowAction

Draws an animated arrow between two nodes.

- `type`: `"arrow"`
- `from`: `string` — Start node ID of the arrow.
- `to`: `string` — Arrival node ID of the arrow.
- `text?`: `string` — Label displayed in the middle of the arrow. Supports inline LaTeX between `$…$` (see the "Math notation" page).
- `style?`: `LineStyle` — Line style: solid, dotted, dashed or animated. Default: 'solid'.
- `path?`: `PathShape` — Path shape: bezier, simplebezier, straight, step, smoothstep. Default: 'bezier'.
- `arrow_head?`: `"forward" | "backward" | "both" | "none"` — Side(s) where to draw the arrow head. Default: 'forward'.
- …plus the common action fields.

## ParallelAction

Executes multiple actions at the same time.

- `type`: `"parallel"`
- `actions`: `Action[]`
- …plus the common action fields.

## LoadingAction

Displays a loading spinner on a node.

- `type`: `"loading"`
- `object`: `string`
- …plus the common action fields.

## SetContentAction

Mutates the content of a node (code, text, image).

- `type`: `"set_content"`
- `object`: `string`
- `content`: `ObjectContent`
- …plus the common action fields.

## CommentAction

Displays a comment bubble near a node, or at the top of the stage if `object` is omitted.

- `type`: `"comment"`
- `object?`: `string` — ID of the node near which to display the comment. Omitted = omniscient comment (top of the stage).
- `text`: `string` — Supports inline LaTeX between `$…$` (see the "Math notation" page).
- …plus the common action fields.

## HighlightAction

Highlights a static node or a connection (by ID).

- `type`: `"highlight"`
- `object`: `string` — ID of a static node OR a connection to highlight.
- …plus the common action fields.

## SetVisibleAction

Shows or hides a static node with a fade.

- `type`: `"set_visible"`
- `object`: `string` — ID of the node to show or hide.
- `visible`: `boolean` — true = show, false = hide.
- …plus the common action fields.

## SetColorAction

Recolors a static node — or a permanent `Connection` — at runtime, over `duration` ms, with a deterministic eased cross-fade between the previous color and the new one (via CSS `color-mix`, so it stays scrubbable in both directions). What `object` refers to selects the channels that apply: a node uses `background_color` / `border_color` / `text_color`; a connection uses `color` (its single line color). Only the channels you provide change; the others keep their current value. Same value space as the static colors: a predefined CSS color name (`tomato`, `steelblue`…) or an exact hex (`#1a1a1a`). Node auto-derivations apply exactly as for a static node (a `background_color` without `border_color` derives a coordinated border; without `text_color`, a high-contrast ink — the latter only outside syntax-highlighted areas). The reached color persists until the end of the timeline, like `SetVisibleAction`. This is the core operation for algorithm visualizations that recolor elements — e.g. the red/black recoloring of a red-black tree, or lighting up the edge a traversal just followed.

- `type`: `"set_color"`
- `object`: `string` — ID of the node or connection to recolor.
- `background_color?`: `string` — New background color (shape fill, panel background, pill behind a pictogram). Predefined CSS name or hex. Omit to leave it unchanged.
- `border_color?`: `string` — New border / stroke color. Predefined CSS name or hex. Omit to leave it unchanged. If `background_color` is set without `border_color`, a coordinated border (darker background) is derived automatically.
- `text_color?`: `string` — New color of the text inside the node (shape body, panel header/body), effective only when syntax highlighting is disabled. Predefined CSS name or hex. Omit to leave it unchanged.
- `color?`: `string` — New line color when `object` is a `Connection` id (recolors the path and its arrow head). Predefined CSS name or hex. Ignored for a node — use the three channels above. Omit to leave it unchanged.
- …plus the common action fields.

## SetIconAction

Updates a node's corner **icon badge** at runtime — the small overlaid badge ( `Node.icon`: a known technology, a registered icon, or short free text). The badge swaps to the new value when the clip starts and, like `SetVisibleAction` / `SetColorAction`, the reached value persists until the end of the timeline; successive `set_icon` on the same node chain (each replaces the previous badge). It is scrubbable in both directions. This is how an algorithm visualization keeps a **per-node scalar that evolves** legible right on the node — the tentative distance of a Dijkstra node (∞ → 7 → 5…), the `f = g + h` of an A\* node — instead of relying only on a comment.

- `type`: `"set_icon"`
- `object`: `string` — ID of the node whose badge changes.
- `icon`: `string` — New badge value: a known technology (e.g. 'react'), a registered icon name, or short free text (a number like '7', a symbol like '∞'). An empty string clears the badge.
- …plus the common action fields.

## RotateAction

Animates the visual rotation of a node. Two mutually exclusive modes: - **Target angle** (`to`): a single eased rotation toward an absolute angle. The starting angle is the node's current rotation (its static `rotation`, or the target of a previous `rotate`), so successive rotations chain. - **Continuous spin** (`spin`): the node turns at a constant speed (linear, no easing) for as long as the action lasts. How long is driven by the usual timing fields — `duration` (spin that long), `keep_until` (spin until another action starts), or `keep_until_end` (spin until the end of the timeline). Only the visual rotates; the label stays upright. The angle reached when the rotation ends persists until the end of the timeline.

- `type`: `"rotate"`
- `object`: `string` — ID of the node to rotate.
- `to?`: `number` — Target angle in degrees (absolute, clockwise). Mutually exclusive with `spin` (which takes precedence if both are set).
- `spin?`: `number` — Continuous spin speed in degrees per second: positive turns clockwise, negative counter-clockwise. Mutually exclusive with `to`. The spin lasts for `duration` ms (default 600), or until `keep_until` / `keep_until_end` when set; the angle reached then persists.
- …plus the common action fields.

## RotateSubtreeAction

Restructures a binary `TreeSpec` with a left or right **tree rotation** around a pivot node, then animates the nodes gliding to their new places while the parent/child edges re-route. Only valid when `direction` is `'tree'`. A rotation preserves the in-order traversal of the tree, so horizontal positions (assigned by in-order rank) stay put — the motion is essentially the pivot and the moved subtree changing depth. The engine recomputes the layout AND the edges from the single tree model, so positions and links can never disagree. Successive `rotate_subtree` actions chain (each starts from the topology left by the previous one), which is how AVL double rotations (LR / RL) are expressed: two `rotate_subtree` in a row.

- `type`: `"rotate_subtree"`
- `object`: `string` — ID of the pivot node. A **left** rotation requires it to have a right child; a **right** rotation requires a left child.
- `rotation`: `"left" | "right"` — Rotation direction.
- …plus the common action fields.

## FlowAction

Animates an **electric current** circulating along a chain of wires — the signature animation of a schematic. A train of evenly-spaced charges rides the `route` (an ordered list of `node` / `node:pin` references forming a path, a branch or a closed loop), advancing one full lap per `duration` ms and, by default, looping continuously. Deterministic in `t` (the phase is a pure function of time), so it scrubs both ways like everything else. Each consecutive pair of the `route` must be joined by an actual wire (`Connection`) so the charges follow the real path. Use `keep_until_end` (or `keep_until_next`) to keep the current flowing across the whole step.

- `type`: `"flow"`
- `route`: `string[]` — Ordered wire path the current follows: node ids or `"node:pin"` terminal references. A closed loop repeats the first id at the end.
- `reverse?`: `boolean` — Reverses the travel direction (e.g. electron flow − → + instead of conventional current + → −). Default: false.
- `loop?`: `boolean` — Continuous circulation: the charges wrap around the `route` forever (until the clip ends). Set to `false` for a single pass. Default: true.
- `count?`: `number` (≥ 1) — Number of charge dots spread along the route. Default: derived from the route length (roughly one per segment).
- `color?`: `string` — Charge color (predefined CSS name or hex). Default: the theme's accent.
- …plus the common action fields.

## ToggleAction

Flips an electrical `switch` / `push_button` between open and closed, swinging the lever over `duration` ms. Like `SetVisibleAction` the reached state persists until the end of the timeline (or the next contrary `toggle`), and it is scrubbable in both directions. Pair it with a `flow` that starts once the contact is closed to show the circuit energizing.

- `type`: `"toggle"`
- `object`: `string` — ID of the `switch` / `push_button` node to actuate.
- `closed`: `boolean` — Target state: `true` = close the contact, `false` = open it.
- …plus the common action fields.

## WaitAction

Dead time: nothing happens for `duration` ms (default: 1000). Does not produce any clip; simply inserts a pause between two steps (elements maintained via `keep_until_next` remain displayed during the wait).

- `type`: `"wait"`
- …plus the common action fields.
