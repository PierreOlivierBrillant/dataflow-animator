# DataFlow Animator — authoring guide

DataFlow Animator compiles a **JSON spec** into a deterministic, step-by-step
animated diagram: packets travelling between servers, a protocol handshake, a
tree rebalancing, current flowing through a circuit. The player adds play/pause,
a scrub bar, Previous/Next step navigation, a text transcript and video export.
You write the spec; the engine does the layout, the routing and the timing.

This guide is what you need to write a GOOD spec. The exhaustive field list is
the field reference (`types.md`); circuit terminal names are in `pins.md`; real
specs are in the examples.

## 1. The model in one minute

A spec has five parts. Only `nodes`, `packets` and `timeline` are required.

| Part          | What it is                                                     |
| ------------- | -------------------------------------------------------------- |
| `nodes`       | The static cast: servers, users, databases, shapes, components |
| `packets`     | The payloads that travel. Invisible until a `move` carries one |
| `connections` | Permanent links drawn from the start (the diagram's decor)     |
| `zones`       | Background rectangles grouping nodes (a network, a cluster)    |
| `timeline`    | The story: an ordered list of actions                          |

Plus root options: `direction` (the layout), `description` (one or two
sentences on what the animation shows — always write it), `pace`, `tree`,
`diagonal_wires`.

**Every ROOT action of `timeline` is one navigable step.** Previous/Next stop
between them. A `parallel` action is one step whose children play together.

**You never give pixel coordinates.** Nodes are placed from `direction` plus
`lane` (flow layouts), `main` (circular), the `tree` block (tree), or
automatically (graph, circuit); `x`/`y` fractions only pin nodes in `graph` and
`circuit`.

## 2. How to write a good animation

1. **Decide the story before the JSON.** Write the 4–12 steps as sentences
   first: "the browser sends GET /users", "the server queries the database"… One
   idea per step. More than ~15 steps is a sign to split into two animations.
2. **Pick the layout** from the table in section 3.
3. **Cast the nodes**: one node per actor, with a short `text` label (2–3
   words). Add an `icon` badge when a technology is involved (`postgres`,
   `react`, `nginx`, `docker`, `aws`…; free text up to 4 characters works too).
4. **Declare a packet per distinct payload**, with the text the reader should
   see on it (`GET /users`, `SELECT * FROM users`, `200 OK`). A packet can be
   moved several times (there and back, then onward).
5. **Narrate with `comment`.** A short sentence on the node it concerns, at the
   moment it matters. Omit `object` for a stage-wide caption.
6. **Let the engine time it.** Leave `duration` out almost everywhere: a
   `comment` or `set_content` gets a reading time from its text, a `move` a
   travel time from its distance. Use `pace` (e.g. `1.3`) to slow everything
   down at once. Write `duration` only for a deliberate effect.
7. **Show state, not just traffic**: `set_content` puts code, a web page, a
   table or rich HTML on a node; `set_color` and `highlight` mark what changed;
   `set_icon` keeps a value (a distance, a counter) visible on a node;
   `set_visible` makes a component appear when the story introduces it.
8. **Write every visible string in the user's language** (labels, comments,
   packet text). Technical tokens (`GET`, `SQL`, `200 OK`, identifiers) stay as
   they are.

## 3. Choosing `direction`

| `direction`                                                                  | Use it for                                                  | Placement fields                                    | Closest examples                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `left-to-right` (default), `right-to-left`, `top-to-bottom`, `bottom-to-top` | Request/response flows, pipelines, protocols, architectures | `lane` (1, 2, 3… along the flow), `align_with`      | `clientServer`, `loadBalancer`, `tls`, `microservices` |
| `circular`                                                                   | A hub and its spokes, a cluster of peers                    | `main: true` on the centre node                     | `signalr`, `raft`, `circular`                          |
| `tree`                                                                       | Binary trees (BST, AVL, red-black), with rotations          | the `tree` block; no `connections`                  | `bstInsert`, `avlTree`, `redBlackRotation`             |
| `graph`                                                                      | Weighted/arbitrary graphs: Dijkstra, A\*, spanning trees    | none (auto); `x`/`y` to pin a node                  | `mst`, `dijkstra`, `astar`                             |
| `circuit`                                                                    | Electrical schematics and logic diagrams                    | none for a loop or feed-forward logic; else `x`/`y` | `circuit`, `halfAdder`, `rcCircuit`, `srLatch`         |

**Flow layouts.** `lane` is the position along the flow. Nodes sharing a lane
stack across it (two backends side by side = same lane). Lanes are integers ≥ 1;
keep them contiguous. `align_with: "<id>"` lines a node up with another one in a
different lane.

**Tree.** `tree: { root: "8", children: { "8": { left: "3", right: "13" }, … } }`.
Node ids are the tree's keys. Edges are drawn for you — style them with
`tree.edge_style` / `tree.edges` (keyed by CHILD id), never with `connections`.
`rotate_subtree` performs a rotation (`object` = pivot, `rotation`: `left` |
`right`). To insert a node, declare it with `visible: false` AND already place it
in `tree.children`, then reveal it with `set_visible` when the story inserts it.

**Graph.** Edges are `connections` with `arrow_head: "none"`, `path:
"straight"`, the weight in `text`, and an `id` so `set_color` / `highlight` can
light them up. Nodes are usually `circle`s with the name in `body`.

**Circuit.** See section 7.

## 4. Nodes

`id` (unique, short, snake*case) and `type` are required. `text` is the label
UNDER the node; it supports inline math between `$…$` (`"$V*{out}$"`; in JSON a
backslash is doubled: `"$\\overline{A}$"`).

Node type families (full enum: `NodeType` in the reference):

- **Pictograms**: `desktop`, `laptop`, `mobile`, `client`, `server`, `cloud`,
  `database`, `user`, `admin`, `users`, and the characters `alice`, `bob`, `eve`
  (for cryptography and protocol stories).
- **Text panels**: `simple_node` (a box showing `body`) and `complex_node`
  (`header` + `body`, looks like an HTTP message). `language` syntax-highlights
  both (`json`, `sql`, `http`, `javascript`, `python`…, enum `HighlightLanguage`).
- **Shapes**: `square`, `circle`, `diamond`, `triangle`, `parallelogram`,
  `width_rectangle`, `height_rectangle`, `star`. `body` is a SHORT centred text
  (a word, a number) — longer text is cropped; use a `simple_node` instead.
- **Circuit components and logic**: resistors, sources, transistors, gates,
  flip-flops, `signal` pads, `junction`s, and `block` (a box with declared
  `pins`). Terminals in `pins.md`.

Useful node fields: `icon` (corner badge), `background_color` / `border_color` /
`text_color` (CSS names or hex; border and text derive from the background if
omitted), `content` (an initial panel, same shape as `set_content`), `visible:
false` (hidden until `set_visible`), `rotation` (degrees), `url` (clickable),
`merge_edges: false` (fan out several links on one face instead of converging),
`value` + `unit` (component labels: `220` + `Ω` → "220 Ω").

## 5. Packets

| `kind`         | Shows                      | Content field(s)                                                                                                |
| -------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `http_packet`  | Request/response envelope  | `packet_content: { header, body?: { type: "text" \| "image", value, language? } }`                              |
| `sql_request`  | A query                    | `request_content: "SELECT …"`                                                                                   |
| `sql_response` | A result set               | `response_content: { header?, rows?, body?: { type: "table", columns, rows_data } \| { type: "text", value } }` |
| `simple_node`  | A travelling text box      | `body`, `language`                                                                                              |
| `complex_node` | A travelling header + body | `header`, `body`, `language`                                                                                    |
| `subicon`      | A travelling tech badge    | `icon`                                                                                                          |

Use the field that matches the kind — `packet_content` on anything but an
`http_packet` is ignored. Keep packet text to a few lines: it is read while the
packet is in flight.

## 6. The timeline

Each action has a `type` and its own fields (reference: `MoveAction`,
`CommentAction`…), plus the common timing fields.

| `type`           | Does                                           | Key fields                                                 |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `move`           | Carries a packet between two nodes             | `object` (a PACKET id), `from`, `to` (node ids)            |
| `comment`        | Speech bubble near a node, or a stage caption  | `text`, `object?`                                          |
| `arrow`          | Draws an arrow at that moment                  | `from`, `to`, `text?`, `style?`, `path?`                   |
| `loading`        | Spinner on a node ("processing")               | `object`                                                   |
| `set_content`    | Puts a panel on a node                         | `object`, `content: { type, … }`                           |
| `highlight`      | Pulsing halo on a node or connection           | `object` (node or connection id)                           |
| `set_color`      | Recolours a node or a connection, persistently | `object`, `background_color?`… or `color` for a connection |
| `set_icon`       | Changes a node's badge, persistently           | `object`, `icon` (`""` clears)                             |
| `set_visible`    | Shows / hides a node, persistently             | `object`, `visible`                                        |
| `rotate`         | Rotates a node (`to` degrees, or `spin` deg/s) | `object`, `to?`, `spin?`                                   |
| `rotate_subtree` | Tree rotation (tree layout only)               | `object` (pivot), `rotation`                               |
| `flow`           | Current flowing along wires (circuit)          | `route` (ids / `"node:pin"`), `color?`, `loop?`            |
| `toggle`         | Opens / closes a `switch` / `push_button`      | `object`, `closed`                                         |
| `parallel`       | Plays its children together (one step)         | `actions`                                                  |
| `wait`           | A pause                                        | `duration`                                                 |

`content` of `set_content` (and of a node's `content`): `{ type: "code", value,
language }`, `{ type: "text", value, url? }` (a browser window), `{ type:
"table", columns, rows_data }`, `{ type: "image", value }` (a URL or `data:`
URI), or `{ type: "html", value, url?, screen_width? }` (sanitized markup with
inline `style` — no scripts, no classes).

**Coordinating actions**

- Sequence is the default: root actions play one after another.
- `parallel` for things that happen at once (a request leaves while a spinner
  starts). Add `delay_ms` to children to stagger them (a fan-out).
- `wait_for: "<action id>"` starts an action when another ends — typically a
  response that waits for a `loading`.
- **Persistence.** A `move` disappears on arrival; `comment`, `arrow`,
  `set_content` and `highlight` stay until the next root step. Extend with
  `keep_until: "<action id>"` (until that action starts) or `keep_until_end:
true`. `set_color`, `set_icon`, `set_visible`, `toggle`, `rotate` are STATE:
  they persist until changed, no flag needed.

## 7. Circuits

- Wire to named terminals with `"node:pin"` (`"R1:a"`, `"batt:+"`, `"g1:y"`) —
  ONLY names listed in `pins.md` for that type. A `signal`, `junction` or other
  type without terminals is wired by its bare id.
- `connections` are orthogonal wires with no arrow head by default; do not set
  `arrow_head`/`path` on them.
- **No coordinates needed** for a single loop (battery → switch → resistor → LED
  → back) or a feed-forward logic network (signals → gates → signals). Anything
  else (parallel branches, feedback, mixed) needs `x`/`y` (0..1) on EVERY node,
  as the gallery's hand-placed circuits do: keep `x` within ~0.1–0.9 and `y`
  within ~0.15–0.9, space components ≥ 0.12 apart, line up the terminals a wire
  joins so it runs straight, and use `junction` nodes for wire corners and
  T-splits. Start from the closest example (`srLatch`, `cmosNand`, `mux4to1`).
- Animate with `toggle` (close a switch), then `flow` along a `route` that
  follows real wires (a loop repeats its first element at the end). For logic,
  show bits with `set_icon` on `signal` pads (`"1"` / `"0"`) and light the wires
  carrying a 1 with `set_color` (`color`) on connection ids.
- `diagonal_wires: true` gives 45° wires where they help (feedback loops).

## 8. Mistakes that break or spoil a spec

- **Wrong id kind**: `move.object` must be a PACKET id; `from`/`to`, `comment`,
  `loading`, `set_content`… target NODE ids; `highlight`/`set_color` accept a
  node or a connection `id` (so give such connections an `id`).
- **Invented fields.** The schema rejects unknown fields. It is `icon`, not
  `subicon`; `main`, not `is_main`; `object`, not `target`/`node`; `text`, not
  `label`; `packets`, not `messages`.
- **Coordinates in a flow layout** (`x`/`y` are ignored outside `graph` and
  `circuit`), or `lane` in `circular`/`tree`/`graph` (ignored).
- **`connections` in a tree** — the tree draws its own edges.
- **A packet never moved** — it is never shown.
- **Long text in a shape's `body`** — cropped. Use a `simple_node`.
- **`wait` after a `comment`** to "give time to read" — remove both the `wait`
  and any `duration`: the comment already gets its reading time.
- **Everything in one `parallel`** — it becomes one step and loses the
  step-by-step navigation.
- **Invalid JSON**: no comments, no trailing commas, no `…` placeholders, double
  quotes only. A newline inside a string is `"\n"`; a LaTeX backslash is doubled
  (`"$\\alpha$"`).
