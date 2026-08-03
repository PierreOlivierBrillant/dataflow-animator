/**
 * TypeScript types of the DataFlow specification.
 * The JSON Schema (`schema.ts`, exposed by the API Doc page) is GENERATED from these types
 * via `ts-json-schema-generator` (`generate:schema` script). Do not edit the schema
 * manually — modify here then regenerate.
 */

export type Direction =
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top'
  | 'circular'
  | 'graph'
  | 'tree'
  // Free 2D grid schematic for electrical / logic circuits: orthogonal `wire`
  // connections by default, node placement by `x`/`y`, terminal-aware routing.
  | 'circuit';

/**
 * Node types (appearance). Decor arrows live in `connections`.
 *
 * Four families:
 * - **Pictograms** (`desktop` … `cloud`): a fixed SVG icon.
 * - **Text nodes** (`simple_node`, `complex_node`): a text box
 *   (body only, or header + body like an HTTP packet).
 * - **Geometric shapes** (`square` … `star`): a drawn shape that can
 *   contain short centered text (`body` field).
 * - **Electrical components** (`resistor` … `transformer`): schematic symbols
 *   with **named terminals** (see {@link Node.pins} — actually resolved from the
 *   type). A `Connection` targets a specific terminal with `"node:pin"` (e.g.
 *   `"R1:a"`, `"Q1:base"`). Best drawn in `direction: 'circuit'`.
 */
export type NodeType =
  | 'desktop'
  | 'laptop'
  | 'client'
  | 'server'
  | 'database'
  | 'mobile'
  | 'user'
  | 'admin'
  | 'users'
  | 'cloud'
  | 'alice'
  | 'bob'
  | 'eve'
  | 'simple_node'
  | 'complex_node'
  | 'square'
  | 'diamond'
  | 'circle'
  | 'triangle'
  | 'parallelogram'
  | 'height_rectangle'
  | 'width_rectangle'
  | 'star'
  // ─── Electrical components (schematic symbols with named terminals) ──────────
  | 'resistor'
  | 'potentiometer'
  | 'capacitor'
  | 'polarized_capacitor'
  | 'inductor'
  | 'fuse'
  | 'battery'
  | 'dc_source'
  | 'ac_source'
  | 'current_source'
  | 'diode'
  | 'led'
  | 'transistor_npn'
  | 'transistor_pnp'
  | 'opamp'
  | 'switch'
  | 'push_button'
  | 'lamp'
  | 'motor'
  | 'buzzer'
  | 'ground'
  | 'junction'
  | 'signal'
  | 'ammeter'
  | 'voltmeter'
  | 'antenna'
  | 'transformer'
  // ─── Digital logic gates (inputs `a`/`b` on the left, output `y` on the right) ─
  | 'and_gate'
  | 'or_gate'
  | 'not_gate'
  | 'nand_gate'
  | 'nor_gate'
  | 'xor_gate'
  | 'xnor_gate'
  | 'buffer_gate';

export type PacketKind =
  | 'http_packet'
  | 'sql_request'
  | 'sql_response'
  | 'simple_node'
  | 'complex_node'
  | 'subicon';

/** Line style (SVG/CSS terminology). `full` is accepted as an alias for `solid`. */
export type LineStyle = 'solid' | 'dotted' | 'dashed' | 'animated';

/**
 * Shape of the arrow / connection path — orthogonal to {@link LineStyle},
 * which only sets the stroke pattern (solid, dotted…). Default: 'bezier'.
 *
 * - `bezier`: smooth S curve, handles along the dominant axis (default);
 * - `simplebezier`: same idea, more subtle curvature;
 * - `straight`: direct segment (bypasses sandwiched labels);
 * - `step`: orthogonal path with right angles;
 * - `smoothstep`: orthogonal path with rounded angles.
 *
 * On two perfectly aligned nodes (same row/column), all shapes
 * merge into a straight line: curvature only appears in the presence of a
 * transverse offset (different lanes, fan-out, bidirectional tracks).
 */
export type PathShape =
  | 'bezier'
  | 'simplebezier'
  | 'straight'
  | 'step'
  | 'smoothstep';

/** Content modes for `set_content` (action) and `content` (static object). */
export type ContentType = 'image' | 'text' | 'code' | 'table';

/** Languages supported by the syntax highlighting engine (Prism). */
export type HighlightLanguage =
  | 'javascript'
  | 'js'
  | 'typescript'
  | 'ts'
  | 'json'
  | 'sql'
  | 'bash'
  | 'sh'
  | 'shell'
  | 'python'
  | 'py'
  | 'csharp'
  | 'cs'
  | 'html'
  | 'xml'
  | 'markup'
  | 'css'
  | 'jsx'
  | 'tsx'
  | 'http';

export interface ObjectContent {
  /**
   * Content display mode: `code` (colored terminal), `text` (browser-like
   * window), `image` (illustration) or `table` (data table).
   */
  type?: ContentType;
  /**
   * Textual content according to `type`: source code (`code`), text (`text`) or
   * image path/URL (`image`).
   * @example "SELECT * FROM users;"
   */
  value?: string;
  /** Language for syntax highlighting. Recognized values: see {@link HighlightLanguage}. */
  language?: HighlightLanguage | (string & {});
  /**
   * (`text` mode) URL displayed in the window's address bar.
   * @example "https://app.example.com/login"
   */
  url?: string;
  /**
   * (`table` mode) Column headers.
   * @example ["id", "email"]
   */
  columns?: string[];
  /**
   * (`table` mode) Data rows.
   * @example [[1, "alice@corp.io"], [2, "bob@corp.io"]]
   */
  rows_data?: (string | number)[][];
}

export interface Node {
  /** Unique node identifier (e.g., 'web_server'). */
  id: string;
  /**
   * Node appearance: pictogram (server, client…), text node (panel)
   * or geometric shape. See previews of each value.
   */
  type: NodeType;
  /**
   * Label displayed below the node. Supports inline LaTeX between `$…$` —
   * `"$B_{in}$"` renders B with an "in" subscript (see the "Math notation"
   * page).
   * @example "Web server"
   */
  text?: string;
  /**
   * Initial visibility of the node. Default: true.
   * A hidden node can be displayed via the `set_visible` action.
   */
  visible?: boolean;
  /**
   * Overlaid badge: name of a known technology (e.g., 'react', 'postgres'),
   * name of a registered icon, or short free text (e.g., 'v2', 'API').
   * @example "react"
   */
  icon?: string;
  /** Placement row/column (positive integer). Default: 1. */
  lane?: number;
  /** (circular) Marks the node as a central node. Default: false. */
  main?: boolean;
  /**
   * Aligns this node on the transverse axis of another node (by ID): useful for
   * aligning two nodes from different lanes. Ignored in circular layout.
   */
  align_with?: string;
  /**
   * (`graph`) Horizontal position as a fraction of the Stage, from 0 (left edge)
   * to 1 (right edge). Used **only** when `direction` is `'graph'`. **Optional:**
   * omit it and the node is placed AUTOMATICALLY (the layout minimizes edge
   * crossings). Provide it to **pin** the node as a fixed anchor the
   * auto-placement of the other nodes routes around — handy to fix a source, a
   * target, or the overall orientation. Ignored by every other direction (which
   * derive positions from `lane` / `main` / the tree).
   * @minimum 0
   * @maximum 1
   * @example 0.25
   */
  x?: number;
  /**
   * (`graph`) Vertical position as a fraction of the Stage, from 0 (top edge) to
   * 1 (bottom edge). Companion of {@link Node.x}: used only when `direction` is
   * `'graph'`, omit for automatic placement, provide to pin the node. Ignored
   * otherwise.
   * @minimum 0
   * @maximum 1
   * @example 0.8
   */
  y?: number;
  /**
   * Edge convergence on the node's faces. When `true` (the default), all
   * connections / arrows / moves attaching to the same face of this node meet
   * at a **single anchor point**: a many-to-one flow (a flood, a load
   * balancer, a hub) visually converges instead of spreading out.
   *
   * Set to `false` to **fan out** the edges instead — each pair gets its own
   * attachment point along the face, ordered to reduce crossings. Useful when a
   * node has several distinct neighbours on the same side and you want to tell
   * the links apart.
   *
   * Independent from the spreading of multiple edges between the *same* two
   * nodes (bidirectional request/response tracks stay distinct regardless).
   * Default: true.
   */
  merge_edges?: boolean;
  /**
   * Connection points on a **round** node's outline (`type: 'circle'`), so edges
   * meet the circle wherever they naturally point instead of snapping to the four
   * cardinal sides — the reason graphs and binary trees look more organic.
   *
   * - `'direct'` (**the default for a circle**): the edge aims at the node centre
   *   and attaches exactly where that straight line crosses the outline — an
   *   *infinite* set of possible points, i.e. the most direct path.
   * - a positive integer `N`: exactly `N` attach points, spread evenly around the
   *   outline; each edge snaps to the nearest one (`4` reproduces N/E/S/W on the
   *   round contour). Edges landing on the same point merge, like `merge_edges`.
   *
   * Ignored on non-round node types (which keep cardinal-side anchoring).
   * @example "direct"
   * @example 6
   */
  ports?: 'direct' | number;
  /**
   * URL making the node clickable (opens in a new tab).
   * @example "https://status.example.com"
   */
  url?: string;
  /**
   * Background color of the node: shape fill, panel background
   * (`simple_node`/`complex_node`), pill behind a pictogram. Accepts a
   * **predefined** CSS color (name: `tomato`, `steelblue`, `teal`…) or an
   * **exact hex** value (`#3b82f6`). No effect on an active `set_content`.
   * @example "#3b82f6"
   */
  background_color?: string;
  /**
   * Node border / stroke color (shape stroke, panel borders,
   * stroke color of a pictogram). Same format as `background_color`.
   * If `background_color` is defined but not `border_color`,
   * a coordinated border (darker variant of the background) is automatically generated.
   * @example "steelblue"
   */
  border_color?: string;
  /**
   * Color of the text displayed IN the node (shape body, panel header/body),
   * **only when syntax highlighting is disabled** (no `language`: otherwise
   * syntax colors take precedence). Same format as `background_color` (predefined
   * name or hex). If not defined but a `background_color` is, a high-contrast
   * color with the background (black or white) is automatically chosen.
   */
  text_color?: string;
  /** Initial content displayed in the node (code terminal, window, etc.). */
  content?: ObjectContent;
  /**
   * Text displayed IN the node, as opposed to `text` which remains the label below
   * the node. For `simple_node` / `complex_node`: panel body (line breaks
   * respected, colored according to `language` if provided). For geometric
   * shapes (`square` … `star`): short centered text in the shape (keep it
   * brief so it doesn't overflow), which supports inline LaTeX between `$…$`
   * (see the "Math notation" page). A panel body does NOT: `$` is a legitimate
   * character there, and the text goes through syntax highlighting.
   * @example "Worker"
   */
  body?: string;
  /**
   * (`complex_node`) Header displayed above the `body`, separated by a line —
   * the node then looks like an HTTP packet. Ignored by `simple_node`.
   * Colored according to `language` if provided.
   * @example "POST /login"
   */
  header?: string;
  /**
   * (`simple_node` / `complex_node`) Syntax highlighting language applied
   * to ALL text areas of the node (`header` and `body`). Recognized values:
   * see {@link HighlightLanguage}.
   */
  language?: HighlightLanguage | (string & {});
  /**
   * Clockwise rotation of the node visual, in degrees. The label below the
   * node stays upright and arrow anchoring is unchanged (the layout box is not
   * rotated). Can be animated with the `rotate` action. Default: 0.
   *
   * **Exception — electrical components:** a component's **named terminals**
   * ({@link NodeType}: `resistor`, `transistor_npn`…) DO rotate with the
   * symbol, so a vertical resistor (`rotation: 90`) has its `a`/`b` terminals at
   * the top/bottom. This is the intended behavior for circuits.
   * @example 45
   */
  rotation?: number;
  /**
   * (Electrical `switch` / `push_button`) Initial state of the contact: `true` =
   * closed (conducting), `false` = open (the default). Animate it with the
   * `toggle` action — the lever swings and the state persists. Ignored by every
   * other node type.
   * @example true
   */
  closed?: boolean;
  /**
   * Component value shown in the label (mainly for electrical components): a
   * resistance, capacitance, voltage… Combined with {@link Node.unit} to form
   * `"<value> <unit>"`. If {@link Node.text} is also set, the value is appended
   * to it (`"R1 · 10 kΩ"`). Purely a label convenience.
   * @example "10"
   */
  value?: string | number;
  /**
   * Unit appended after {@link Node.value} in the label (`kΩ`, `µF`, `V`, `mA`…).
   * Ignored when `value` is absent.
   * @example "kΩ"
   */
  unit?: string;
}

/** Rectangular region enclosing a group of nodes and/or other zones. */
export interface Zone {
  /** Optional identifier (required to be referenced in the `contains` of another zone). */
  id?: string;
  /** IDs of the enclosed nodes and/or zones. */
  contains: string[];
  /** CSS color of the border and semi-transparent background. */
  color?: string;
  /** Label displayed at the top left of the zone. Supports inline LaTeX
   *  between `$…$` (see the "Math notation" page). */
  label?: string;
}

/** Left/right children of a node in a binary tree. */
export interface TreeChildren {
  /** ID of the left child (smaller key), if any. */
  left?: string;
  /** ID of the right child (greater key), if any. */
  right?: string;
}

/**
 * Visual styling for the parent→child edges auto-drawn in a `'tree'` layout.
 * Orthogonal to the topology (`children` stays a pure structure): it is applied
 * at RENDER time, so it survives {@link RotateSubtreeAction} re-routing — a style
 * keyed to a child follows that node as its depth changes. Used both as the
 * tree-wide default ({@link TreeSpec.edge_style}) and as a per-edge override
 * ({@link TreeSpec.edges}), the override merged over the default field by field.
 *
 * Same vocabulary as a {@link Connection}, but tree edges have their own
 * defaults: a **`straight`** path (not `bezier`) and **no** arrow head (they are
 * plain hierarchy links, not directed arrows).
 */
export interface TreeEdgeStyle {
  /** Line style. Default: 'solid'. */
  style?: LineStyle;
  /** Shape of the edge path. Default (tree): 'straight'. See {@link PathShape}. */
  path?: PathShape;
  /** Arrow head. Default (tree): 'none' — parent→child links carry no head. */
  arrow_head?: 'forward' | 'backward' | 'both' | 'none';
  /**
   * Optional median label drawn on the edge. Supports inline LaTeX between
   * `$…$` (see the "Math notation" page).
   * @example "L"
   */
  text?: string;
  /**
   * Line color (predefined CSS name or hex). Tints the whole path and its arrow
   * head(s). Default: the theme's neutral connection color.
   * @example "steelblue"
   */
  color?: string;
  /**
   * Emphasizes the edge permanently — accent color, thicker stroke and glow —
   * like a statically {@link Connection.highlighted} link. Default: false.
   */
  highlighted?: boolean;
}

/**
 * Binary-tree topology (used when `direction` is `'tree'`). Single source of
 * truth for the structure: parent/child **edges are derived from it** (and drawn
 * automatically — no `connections` to maintain), and the layout places each node
 * by its **in-order rank** (horizontal) and **depth** (vertical). The
 * {@link RotateSubtreeAction} mutates this topology at runtime and the engine
 * re-lays-out and re-routes the edges from this same model.
 */
export interface TreeSpec {
  /** ID of the root node. */
  root: string;
  /**
   * Left/right child of each (internal) node, by node ID. A node absent from
   * this map — or with an empty entry — is a leaf.
   * @example { "g": { "left": "p", "right": "u" }, "p": { "left": "n" } }
   */
  children: Record<string, TreeChildren>;
  /**
   * Default styling applied to EVERY parent→child edge — the place to set the
   * `path` (or the line style / color) once for the whole tree. Tree edges
   * otherwise default to a `straight` path and no arrow head. Overridden per edge
   * by {@link TreeSpec.edges}. See {@link TreeEdgeStyle}.
   * @example { "path": "step" }
   */
  edge_style?: TreeEdgeStyle;
  /**
   * Per-edge styling override, keyed by the **child** node ID: since every node
   * has exactly one parent, its id names the incoming edge unambiguously (and the
   * style follows the node through {@link RotateSubtreeAction}). Each entry is
   * merged OVER {@link TreeSpec.edge_style}, field by field. See
   * {@link TreeEdgeStyle}.
   * @example { "6": { "style": "dashed", "color": "crimson" } }
   */
  edges?: Record<string, TreeEdgeStyle>;
}

/** Permanent link/arrow (decor), displayed upon initialization. */
export interface Connection {
  /** Optional identifier. */
  id?: string;
  /** Source node ID. */
  from: string;
  /** Destination node ID. */
  to: string;
  /** Line style. Default: 'solid'. */
  style?: LineStyle;
  /** Shape of the link path. Default: 'bezier'. See {@link PathShape}. */
  path?: PathShape;
  /**
   * (`direction: 'circuit'` only) Draw THIS wire octilinearly (`true`, 45° miters)
   * or force it strictly orthogonal (`false`), **overriding** the circuit-wide
   * {@link DataFlowSpec.diagonal_wires}. Unset = inherit that circuit default.
   * Ignored outside `circuit`.
   */
  diagonal?: boolean;
  /** Arrow head. Default: 'forward'. */
  arrow_head?: 'forward' | 'backward' | 'both' | 'none';
  /**
   * Optional median text. Supports inline LaTeX between `$…$` (see the
   * "Math notation" page).
   * @example "HTTPS"
   */
  text?: string;
  /**
   * Line color (predefined CSS name or hex). Tints the whole path and its arrow
   * head(s); the median `text` label keeps the theme color for legibility.
   * Default: the theme's neutral connection color. A runtime `set_color` on this
   * connection's `id` recolors it, and an active `highlight` (accent) takes
   * precedence over both.
   * @example "steelblue"
   */
  color?: string;
  /**
   * Emphasizes the connection permanently, from initialization — the same accent
   * color, thicker stroke and glow the {@link HighlightAction} applies, but
   * static (no timeline action needed). Default: false.
   */
  highlighted?: boolean;
}

export interface PacketBody {
  type?: 'text' | 'image';
  /**
   * Text or image path.
   * @example "{ \"token\": \"abc123\" }"
   */
  value?: string;
  /** Language for text syntax highlighting (optional). Recognized values: see {@link HighlightLanguage}. */
  language?: HighlightLanguage | (string & {});
}

export interface PacketContent {
  /**
   * Header visible in the packet (e.g., 'GET /api').
   * @example "GET /api/users"
   */
  header?: string;
  body?: PacketBody;
}

export interface SqlResponseBody {
  type?: 'text' | 'table';
  /** Pure text if type is 'text' */
  value?: string;
  /**
   * Table columns if type is 'table'
   * @example ["id", "name"]
   */
  columns?: string[];
  /**
   * Data rows if type is 'table'
   * @example [[1, "Alice"], [2, "Bob"]]
   */
  rows_data?: (string | number)[][];
}

export interface SqlResponse {
  /**
   * Number of rows returned.
   * @example 42
   */
  rows?: number;
  /** Optional header visible in the packet. */
  header?: string;
  /** Response body (pure text or table). */
  body?: SqlResponseBody;
}

export interface Packet {
  /** Unique identifier of the packet. */
  id: string;
  /**
   * Packet category, which sets its appearance and expected content:
   * `http_packet` (header + body via `packet_content`), `sql_request` (textual
   * request via `request_content`), `sql_response` (response via `response_content`),
   * a **text panel** (`simple_node` / `complex_node`) that travels: same look
   * and content fields as the homonymous {@link NodeType} (`body`, plus `header`
   * for `complex_node`, optionally syntax-highlighted via `language`), or a
   * **tech badge** (`subicon`) that travels: the same {@link Node.icon} badge
   * (known technology, registered icon, or short free text), via `icon`.
   */
  kind: PacketKind;
  /**
   * Textual request (e.g., for sql_request).
   * @example "SELECT * FROM users WHERE id = 42"
   */
  request_content?: string;
  /** Content of a `sql_response`: number of rows, header and body (text or table). */
  response_content?: SqlResponse;
  /** Content of an `http_packet`: header (e.g., 'GET /api') and optional body. */
  packet_content?: PacketContent;
  /**
   * (`simple_node` / `complex_node`) Panel body text (line breaks respected,
   * colored according to `language` if provided). Same role as {@link Node.body}.
   * @example "Worker"
   */
  body?: string;
  /**
   * (`complex_node`) Header displayed above the `body`, separated by a line —
   * the packet then looks like an HTTP packet. Ignored by `simple_node`.
   * Same role as {@link Node.header}.
   * @example "POST /login"
   */
  header?: string;
  /**
   * (`simple_node` / `complex_node`) Syntax highlighting language applied to ALL
   * text areas of the panel (`header` and `body`). Recognized values: see
   * {@link HighlightLanguage}. Same role as {@link Node.language}.
   */
  language?: HighlightLanguage | (string & {});
  /**
   * (`subicon`) The tech badge that travels: name of a known technology
   * (e.g., 'react', 'postgres'), name of a registered icon, or short free text
   * (e.g., 'v2', 'API'). Same role as {@link Node.icon}.
   * @example "react"
   */
  icon?: string;
}

export type ActionType =
  | 'move'
  | 'arrow'
  | 'parallel'
  | 'loading'
  | 'set_content'
  | 'comment'
  | 'highlight'
  | 'set_visible'
  | 'set_color'
  | 'set_icon'
  | 'rotate'
  | 'rotate_subtree'
  | 'flow'
  | 'toggle'
  | 'wait';

/** Common fields to all actions (sequencing and lifecycle). */
interface ActionBase {
  /** Action ID to refer to it (wait_for / keep_until). */
  id?: string;
  /**
   * Animation duration in ms (default: 500, 1200 for loading).
   * @minimum 1
   * @multipleOf 1
   */
  duration?: number;
  /** ID of another action: this action starts at the end of that one. */
  wait_for?: string;
  /** ID of a future action: this action remains visible until its start. */
  keep_until?: string;
  /**
   * Remains visible until the start of the next root step.
   * Default: false for `move`/`loading`, true for `arrow`/`comment`/`set_content`.
   */
  keep_until_next?: boolean;
  /** If true, remains visible until the end of the timeline. */
  keep_until_end?: boolean;
  /**
   * Start offset in ms, added after resolving `wait_for` and the
   * step clamp. Mainly useful in a `parallel` block to stagger
   * actions against each other (staggered sequence animations).
   * Also applies to an entire `parallel` action to delay the whole group.
   * @minimum 0
   * @multipleOf 1
   */
  delay_ms?: number;
  /**
   * Fade-in duration in ms. Default: initial hold period
   * for `move` (300 ms), 250 ms for other actions. 0 = instant appearance.
   * @minimum 0
   * @multipleOf 1
   */
  fade_in_ms?: number;
  /**
   * Fade-out duration in ms. Default: 250. 0 = instant disappearance.
   * No effect if `keep_until_end` is true.
   * @minimum 0
   * @multipleOf 1
   */
  fade_out_ms?: number;
}

/** Moves a packet from `from` to `to`. */
interface MoveAction extends ActionBase {
  type: 'move';
  /** ID of the packet (declared in `packets`) to move. */
  object: string;
  /** Start node ID. */
  from: string;
  /** Arrival node ID. */
  to: string;
}

/** Draws an animated arrow between two nodes. */
interface ArrowAction extends ActionBase {
  type: 'arrow';
  /** Start node ID of the arrow. */
  from: string;
  /** Arrival node ID of the arrow. */
  to: string;
  /** Label displayed in the middle of the arrow. Supports inline LaTeX
   *  between `$…$` (see the "Math notation" page). */
  text?: string;
  /** Line style: solid, dotted, dashed or animated. Default: 'solid'. */
  style?: LineStyle;
  /** Path shape: bezier, simplebezier, straight, step, smoothstep. Default: 'bezier'. */
  path?: PathShape;
  /** Side(s) where to draw the arrow head. Default: 'forward'. */
  arrow_head?: 'forward' | 'backward' | 'both' | 'none';
}

/** Executes multiple actions at the same time. */
interface ParallelAction extends ActionBase {
  type: 'parallel';
  actions: Action[];
}

/** Displays a loading spinner on a node. */
interface LoadingAction extends ActionBase {
  type: 'loading';
  object: string;
}

/** Mutates the content of a node (code, text, image). */
interface SetContentAction extends ActionBase {
  type: 'set_content';
  object: string;
  content: ObjectContent;
}

/** Displays a comment bubble near a node, or at the top of the stage if `object` is omitted. */
interface CommentAction extends ActionBase {
  type: 'comment';
  /** ID of the node near which to display the comment. Omitted = omniscient comment (top of the stage). */
  object?: string;
  /** Supports inline LaTeX between `$…$` (see the "Math notation" page).
   *  @example "Le serveur valide le token" */
  text: string;
}

/** Highlights a static node or a connection (by ID). */
interface HighlightAction extends ActionBase {
  type: 'highlight';
  /** ID of a static node OR a connection to highlight. */
  object: string;
}

/** Shows or hides a static node with a fade. */
interface SetVisibleAction extends ActionBase {
  type: 'set_visible';
  /** ID of the node to show or hide. */
  object: string;
  /** true = show, false = hide. */
  visible: boolean;
}

/**
 * Recolors a static node — or a permanent {@link Connection} — at runtime, over
 * `duration` ms, with a deterministic eased cross-fade between the previous
 * color and the new one (via CSS `color-mix`, so it stays scrubbable in both
 * directions). What `object` refers to selects the channels that apply: a node
 * uses `background_color` / `border_color` / `text_color`; a connection uses
 * `color` (its single line color). Only the channels you provide change; the
 * others keep their current value.
 *
 * Same value space as the static colors: a predefined CSS color name
 * (`tomato`, `steelblue`…) or an exact hex (`#1a1a1a`). Node auto-derivations
 * apply exactly as for a static node (a `background_color` without
 * `border_color` derives a coordinated border; without `text_color`, a
 * high-contrast ink — the latter only outside syntax-highlighted areas). The
 * reached color persists until the end of the timeline, like
 * {@link SetVisibleAction}.
 *
 * This is the core operation for algorithm visualizations that recolor elements
 * — e.g. the red/black recoloring of a red-black tree, or lighting up the edge a
 * traversal just followed.
 */
interface SetColorAction extends ActionBase {
  type: 'set_color';
  /** ID of the node or connection to recolor. */
  object: string;
  /**
   * New background color (shape fill, panel background, pill behind a
   * pictogram). Predefined CSS name or hex. Omit to leave it unchanged.
   * @example "#1a1a1a"
   */
  background_color?: string;
  /**
   * New border / stroke color. Predefined CSS name or hex. Omit to leave it
   * unchanged. If `background_color` is set without `border_color`, a
   * coordinated border (darker background) is derived automatically.
   * @example "crimson"
   */
  border_color?: string;
  /**
   * New color of the text inside the node (shape body, panel header/body),
   * effective only when syntax highlighting is disabled. Predefined CSS name or
   * hex. Omit to leave it unchanged.
   * @example "white"
   */
  text_color?: string;
  /**
   * New line color when `object` is a {@link Connection} id (recolors the path
   * and its arrow head). Predefined CSS name or hex. Ignored for a node — use
   * the three channels above. Omit to leave it unchanged.
   * @example "crimson"
   */
  color?: string;
}

/**
 * Updates a node's corner **icon badge** at runtime — the small overlaid badge
 * ({@link Node.icon}: a known technology, a registered icon, or short free
 * text). The badge swaps to the new value when the clip starts and, like
 * {@link SetVisibleAction} / {@link SetColorAction}, the reached value persists
 * until the end of the timeline; successive `set_icon` on the same node chain
 * (each replaces the previous badge). It is scrubbable in both directions.
 *
 * This is how an algorithm visualization keeps a **per-node scalar that
 * evolves** legible right on the node — the tentative distance of a Dijkstra
 * node (∞ → 7 → 5…), the `f = g + h` of an A\* node — instead of relying only on
 * a comment.
 */
interface SetIconAction extends ActionBase {
  type: 'set_icon';
  /** ID of the node whose badge changes. */
  object: string;
  /**
   * New badge value: a known technology (e.g. 'react'), a registered icon name,
   * or short free text (a number like '7', a symbol like '∞'). An empty string
   * clears the badge.
   * @example "7"
   */
  icon: string;
}

/**
 * Animates the visual rotation of a node. Two mutually exclusive modes:
 *
 * - **Target angle** (`to`): a single eased rotation toward an absolute angle.
 *   The starting angle is the node's current rotation (its static `rotation`, or
 *   the target of a previous `rotate`), so successive rotations chain.
 * - **Continuous spin** (`spin`): the node turns at a constant speed (linear, no
 *   easing) for as long as the action lasts. How long is driven by the usual
 *   timing fields — `duration` (spin that long), `keep_until` (spin until another
 *   action starts), or `keep_until_end` (spin until the end of the timeline).
 *
 * Only the visual rotates; the label stays upright. The angle reached when the
 * rotation ends persists until the end of the timeline.
 */
interface RotateAction extends ActionBase {
  type: 'rotate';
  /** ID of the node to rotate. */
  object: string;
  /**
   * Target angle in degrees (absolute, clockwise). Mutually exclusive with
   * `spin` (which takes precedence if both are set).
   * @example 90
   */
  to?: number;
  /**
   * Continuous spin speed in degrees per second: positive turns clockwise,
   * negative counter-clockwise. Mutually exclusive with `to`. The spin lasts for
   * `duration` ms (default 600), or until `keep_until` / `keep_until_end` when
   * set; the angle reached then persists.
   * @example 360
   */
  spin?: number;
}

/**
 * Restructures a binary {@link TreeSpec} with a left or right **tree rotation**
 * around a pivot node, then animates the nodes gliding to their new places while
 * the parent/child edges re-route. Only valid when `direction` is `'tree'`.
 *
 * A rotation preserves the in-order traversal of the tree, so horizontal
 * positions (assigned by in-order rank) stay put — the motion is essentially the
 * pivot and the moved subtree changing depth. The engine recomputes the layout
 * AND the edges from the single tree model, so positions and links can never
 * disagree. Successive `rotate_subtree` actions chain (each starts from the
 * topology left by the previous one), which is how AVL double rotations
 * (LR / RL) are expressed: two `rotate_subtree` in a row.
 */
interface RotateSubtreeAction extends ActionBase {
  type: 'rotate_subtree';
  /**
   * ID of the pivot node. A **left** rotation requires it to have a right child;
   * a **right** rotation requires a left child.
   */
  object: string;
  /** Rotation direction. */
  rotation: 'left' | 'right';
}

/**
 * Animates an **electric current** circulating along a chain of wires — the
 * signature animation of a schematic. A train of evenly-spaced charges rides the
 * `route` (an ordered list of `node` / `node:pin` references forming a path, a
 * branch or a closed loop), advancing one full lap per `duration` ms and, by
 * default, looping continuously. Deterministic in `t` (the phase is a pure
 * function of time), so it scrubs both ways like everything else.
 *
 * Each consecutive pair of the `route` must be joined by an actual wire
 * (`Connection`) so the charges follow the real path. Use `keep_until_end` (or
 * `keep_until_next`) to keep the current flowing across the whole step.
 */
interface FlowAction extends ActionBase {
  type: 'flow';
  /**
   * Ordered wire path the current follows: node ids or `"node:pin"` terminal
   * references. A closed loop repeats the first id at the end.
   * @example ["battery:+", "R1:a", "R1:b", "led:a", "led:b", "battery:-"]
   */
  route: string[];
  /**
   * Reverses the travel direction (e.g. electron flow − → + instead of
   * conventional current + → −). Default: false.
   */
  reverse?: boolean;
  /**
   * Continuous circulation: the charges wrap around the `route` forever (until
   * the clip ends). Set to `false` for a single pass. Default: true.
   */
  loop?: boolean;
  /**
   * Number of charge dots spread along the route. Default: derived from the
   * route length (roughly one per segment).
   * @minimum 1
   * @multipleOf 1
   */
  count?: number;
  /**
   * Charge color (predefined CSS name or hex). Default: the theme's accent.
   * @example "#f59e0b"
   */
  color?: string;
}

/**
 * Flips an electrical `switch` / `push_button` between open and closed, swinging
 * the lever over `duration` ms. Like {@link SetVisibleAction} the reached state
 * persists until the end of the timeline (or the next contrary `toggle`), and it
 * is scrubbable in both directions. Pair it with a `flow` that starts once the
 * contact is closed to show the circuit energizing.
 */
interface ToggleAction extends ActionBase {
  type: 'toggle';
  /** ID of the `switch` / `push_button` node to actuate. */
  object: string;
  /** Target state: `true` = close the contact, `false` = open it. */
  closed: boolean;
}

/**
 * Dead time: nothing happens for `duration` ms (default: 1000). Does not produce
 * any clip; simply inserts a pause between two steps (elements
 * maintained via `keep_until_next` remain displayed during the wait).
 */
interface WaitAction extends ActionBase {
  type: 'wait';
}

/** Discriminated union of actions (by `type`). */
export type Action =
  | MoveAction
  | ArrowAction
  | ParallelAction
  | LoadingAction
  | SetContentAction
  | CommentAction
  | HighlightAction
  | SetVisibleAction
  | SetColorAction
  | SetIconAction
  | RotateAction
  | RotateSubtreeAction
  | FlowAction
  | ToggleAction
  | WaitAction;

export interface DataFlowSpec {
  /**
   * Node placement direction. For the flow (`left-to-right` …), `circular` and
   * `tree` modes you provide **no coordinates** — the engine arranges nodes from
   * `lane` / `main` / the {@link TreeSpec}. Default: 'left-to-right'. Use `'tree'`
   * to lay out a binary tree (in-order rank → horizontal, depth → vertical) and
   * enable the {@link RotateSubtreeAction}. Use `'graph'` to place nodes yourself
   * via their `x` / `y` (free 2D layout) — the escape hatch for an arbitrary
   * graph (Dijkstra, A\*, minimum spanning tree…). Use `'circuit'` for an
   * electrical schematic: nodes placed by `x` / `y` on a grid, `connections`
   * drawn as orthogonal **wires** (no arrow head) by default, and edges anchored
   * on the components' **named terminals** (`"node:pin"`).
   */
  direction?: Direction;
  /**
   * (`direction: 'circuit'` only) Draw wires **octilinearly**: their corners are
   * mitered into exact 45° segments (only 45 / 135 / 225 / 315°), so long
   * L-shapes and staircases collapse into clean diagonal runs, while wires that
   * are already straight (aligned terminals) stay straight. A short perpendicular
   * stub is kept at each component pin, and a miter that would cross a body falls
   * back to a right angle. Override per wire with {@link Connection.diagonal}.
   * Default: false (strict horizontal/vertical wires). Ignored by every other
   * direction.
   */
  diagonal_wires?: boolean;
  /**
   * Fixed elements of the scene (servers, clients, databases…). They form the permanent
   * decor and are placed automatically according to `direction` and their `lane`.
   */
  nodes: Node[];
  /**
   * Binary-tree topology, **required when `direction` is `'tree'`** (ignored
   * otherwise). Drives the layout and the auto-drawn parent/child edges, and is
   * the structure mutated by `rotate_subtree`. See {@link TreeSpec}.
   */
  tree?: TreeSpec;
  /**
   * Mobile elements (requests, responses, messages). Declared here, then moved
   * from one node to another by a `move` action in the `timeline`.
   */
  packets: Packet[];
  /** Permanent arrows/links (decor) displayed upon initialization. */
  connections?: Connection[];
  /** Rectangular regions displayed in the background around a group of nodes. */
  zones?: Zone[];
  /**
   * Animated scenario: ordered list of actions (moves, arrows, comments…)
   * played sequentially. Each root action becomes a navigable step.
   */
  timeline: Action[];
}

/** Syntax highlighting function: source code -> HTML. */
export type Highlighter = (code: string, language: string) => string;

/**
 * Visual palette of the player. Every theme ships **both** a light and a dark
 * variant; {@link DataFlowPlayerProps.mode} picks which one is shown, so the
 * palette and the light/dark question stay two independent choices.
 *
 * - `default` — neutral slate & blue.
 * - `dots` — neutral canvas with a dotted grid (design-tool look).
 * - `blueprint` — cyan on Prussian blue over a drafting grid.
 * - `pcb` — solder mask and gold traces; pairs with `direction: 'circuit'`.
 * - `chalk` — blackboard and chalk (light variant: whiteboard and markers).
 * - `terminal` — phosphor CRT with scanlines (light variant: amber on cream).
 * - `paper` — ink on graph paper (dark variant: the black notebook).
 * - `neon` — saturated magenta/cyan with a halo.
 */
export type PlayerTheme =
  | 'default'
  | 'dots'
  | 'blueprint'
  | 'pcb'
  | 'chalk'
  | 'terminal'
  | 'paper'
  | 'neon';

/** Which variant of a {@link PlayerTheme} to display. */
export type PlayerMode = 'light' | 'dark' | 'auto';

// ─── Legacy aliases (original object vocabulary) ─────────────────────────────
/** @deprecated Use {@link Node} instead. */
export type StaticObject = Node;
/** @deprecated Use {@link NodeType} instead. */
export type StaticObjectType = NodeType;
/** @deprecated Use {@link Packet} instead. */
export type DynamicObject = Packet;
/** @deprecated Use {@link PacketKind} instead. */
export type DynamicObjectType = PacketKind;
