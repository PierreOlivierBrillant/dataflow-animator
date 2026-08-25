import { DataFlowSpec } from '@dataflow-animator/react';

/** `move`: a packet travels from one node to another (appearance + arrival). */
export const moveExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Browser', icon: 'chrome', lane: 1 },
    { id: 'api', type: 'server', text: 'API', icon: 'node', lane: 2 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api', duration: 700 },
  ],
};

/** `arrow`: an animated arrow is drawn progressively between two nodes. */
export const arrowExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'client', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'server', type: 'server', text: 'Server', lane: 2 },
  ],
  packets: [],
  timeline: [
    {
      type: 'arrow',
      from: 'client',
      to: 'server',
      style: 'animated',
      arrow_head: 'forward',
      text: 'request',
      duration: 800,
    },
  ],
};

/** `parallel`: a `move` and an `arrow` of different types fire at the same instant. */
export const parallelExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'laptop', text: 'Client', lane: 1 },
    { id: 'b', type: 'server', text: 'API', lane: 2 },
    { id: 'c', type: 'server', text: 'Worker', lane: 1 },
    { id: 'd', type: 'database', text: 'Queue', icon: 'redis', lane: 2 },
  ],
  packets: [
    { id: 'p1', kind: 'http_packet', packet_content: { header: 'POST /job' } },
  ],
  timeline: [
    {
      type: 'parallel',
      actions: [
        { type: 'move', object: 'p1', from: 'a', to: 'b', duration: 800 },
        {
          type: 'arrow',
          from: 'c',
          to: 'd',
          style: 'animated',
          arrow_head: 'forward',
          text: 'enqueue',
          duration: 800,
        },
      ],
    },
  ],
};

/** `loading`: a spinner runs on the database while it "processes" the query. */
export const loadingExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'api', type: 'server', text: 'API', icon: 'node', lane: 1 },
    { id: 'db', type: 'database', text: 'Database', icon: 'postgres', lane: 2 },
  ],
  packets: [
    { id: 'q', kind: 'sql_request', request_content: 'SELECT * FROM users' },
    {
      id: 'rows',
      kind: 'sql_response',
      response_content: { header: '42 rows' },
    },
  ],
  timeline: [
    {
      id: 'send',
      type: 'move',
      object: 'q',
      from: 'api',
      to: 'db',
      duration: 600,
    },
    {
      type: 'loading',
      id: 'work',
      object: 'db',
      duration: 1200,
      wait_for: 'send',
    },
    {
      type: 'move',
      object: 'rows',
      from: 'db',
      to: 'api',
      duration: 600,
      wait_for: 'work',
    },
  ],
};

/** `set_content`: the three content modes (`code`, `text`, `table`) shown in turn. */
export const setContentExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'editor', type: 'laptop', text: 'Editor', lane: 1 },
    { id: 'browser', type: 'laptop', text: 'Browser', icon: 'chrome', lane: 2 },
    { id: 'admin', type: 'server', text: 'Admin', lane: 3 },
  ],
  packets: [],
  timeline: [
    {
      type: 'set_content',
      object: 'editor',
      content: {
        type: 'code',
        language: 'javascript',
        value: 'const add = (a, b) => a + b;',
      },
      keep_until_end: true,
    },
    {
      type: 'set_content',
      object: 'browser',
      content: { type: 'text', url: 'example.com/users', value: 'Alice\nBob' },
      keep_until_end: true,
    },
    {
      type: 'set_content',
      object: 'admin',
      content: {
        type: 'table',
        columns: ['id', 'name'],
        rows_data: [
          [1, 'Alice'],
          [2, 'Bob'],
        ],
      },
      keep_until_end: true,
    },
  ],
};

/**
 * Eight frames of a rotating dot, built as inline SVG.
 *
 * A `data:` URI rather than a file: a rasterised video frame cannot load
 * anything from another origin, so a sequence made of remote images plays on
 * screen and fails the export.
 */
const spinnerFrames = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * 2 * Math.PI;
  const x = (50 + 32 * Math.cos(angle)).toFixed(1);
  const y = (50 + 32 * Math.sin(angle)).toFixed(1);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="#cbd5e1" stroke-width="6"/><circle cx="${x}" cy="${y}" r="9" fill="#3b82f6"/></svg>`
  )}`;
});

/** `set_content`: the `html` mode and a `frames` sequence, side by side. */
export const richContentExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'card', type: 'server', text: 'Health check', lane: 1 },
    { id: 'worker', type: 'server', text: 'Worker', lane: 2 },
  ],
  packets: [],
  timeline: [
    {
      type: 'set_content',
      object: 'card',
      content: {
        type: 'html',
        value:
          '<h3>Cache warmed</h3>' +
          '<ul><li><b>Hit rate</b> 94&nbsp;%</li><li><b>Keys</b> 12&nbsp;480</li></ul>' +
          '<p style="color:#16a34a">All shards green</p>',
      },
      keep_until_end: true,
    },
    {
      type: 'set_content',
      object: 'worker',
      content: { type: 'image', frames: spinnerFrames, fps: 8 },
      keep_until_end: true,
    },
  ],
};

/**
 * A tiny video app, drawn in a fixed 480x300 design space.
 *
 * The whole point of `screen_width`: the shell below is laid out ONCE at 480px
 * and only ever scaled, so a student recognises the same screen in a thumbnail
 * and on a projector. Nothing here is a full mock-up — the grey blocks say
 * "not loaded yet" and the black one says "loaded", which is the entire lesson.
 */
const videoShell = (main: string): string => `
  <div style="height:100%;display:flex;flex-direction:column;background:#fff;color:#111">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #e5e5e5">
      <span style="display:inline-block;width:18px;height:13px;background:#e11d48;border-radius:3px"></span>
      <b style="font-size:13px">Videos</b>
    </div>
    <div style="flex:1;display:flex;min-height:0">
      <div style="width:96px;border-right:1px solid #e5e5e5;padding:10px 8px;font-size:11px;color:#555">
        <div style="margin-bottom:6px">Home</div><div style="margin-bottom:6px">Subscriptions</div><div>History</div>
      </div>
      <div style="flex:1;padding:12px">${main}</div>
    </div>
  </div>`;

/** Grey placeholders: the shell is there, the data is not. */
const skeleton = `
  <div style="width:100%;height:126px;background:#e5e7eb;border-radius:6px"></div>
  <div style="height:10px;width:70%;background:#e5e7eb;border-radius:3px;margin-top:10px"></div>
  <div style="height:10px;width:40%;background:#e5e7eb;border-radius:3px;margin-top:6px"></div>`;

/** The same slots, filled. */
const loadedVideo = `
  <div style="width:100%;height:126px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center">
    <span style="display:inline-block;width:0;height:0;border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent"></span>
  </div>
  <div style="font-size:12px;font-weight:600;margin-top:10px">How a single-page app works</div>
  <div style="font-size:11px;color:#666;margin-top:3px">Web channel &middot; 12k views</div>`;

/** `screen_width`: a page drawn in a fixed design space, then scaled. */
export const screenExample: DataFlowSpec = {
  direction: 'left-to-right',
  // The screen sits in the MIDDLE on purpose. A panel grows around its node's
  // centre, so a node pinned near a stage edge can only use the room between
  // itself and that edge — half of what a central one gets.
  nodes: [
    { id: 'cdn', type: 'cloud', text: 'CDN', lane: 1 },
    { id: 'browser', type: 'laptop', text: 'Browser', lane: 2 },
    { id: 'api', type: 'server', text: 'API', lane: 3 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /video/42' },
    },
    { id: 'res', kind: 'http_packet', packet_content: { header: '200 OK' } },
    {
      id: 'stream',
      kind: 'http_packet',
      packet_content: { header: 'video.mp4' },
    },
  ],
  timeline: [
    {
      type: 'set_content',
      object: 'browser',
      // Instant, not a crossfade: the shell is identical from one step
      // to the next, so an abrupt swap reads as a region updating in
      // place — which is exactly what a single-page app does.
      fade_in_ms: 0,
      content: {
        type: 'html',
        url: 'videos.example/watch?v=42',
        screen_width: 480,
        screen_height: 300,
        value: videoShell(skeleton),
      },
      duration: 700,
    },
    { type: 'move', object: 'req', from: 'browser', to: 'api' },
    { type: 'move', object: 'res', from: 'api', to: 'browser' },
    { type: 'move', object: 'stream', from: 'cdn', to: 'browser' },
    {
      type: 'set_content',
      object: 'browser',
      fade_in_ms: 0,
      content: {
        type: 'html',
        url: 'videos.example/watch?v=42',
        screen_width: 480,
        screen_height: 300,
        value: videoShell(loadedVideo),
      },
      keep_until_end: true,
    },
  ],
};

/** `comment`: an omniscient bubble (no `object`) then bubbles attached to nodes. */
export const commentExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'user', type: 'user', text: 'User', lane: 1 },
    { id: 'app', type: 'server', text: 'App', lane: 2 },
  ],
  packets: [],
  timeline: [
    { type: 'comment', text: 'Step 1 — Sign in', duration: 1000 },
    {
      type: 'comment',
      object: 'user',
      text: 'The user clicks "Log in"',
      duration: 1000,
    },
    {
      type: 'comment',
      object: 'app',
      text: 'Session created ✓',
      keep_until_end: true,
    },
  ],
};

/** `set_visible`: a node declared `visible: false` is revealed mid-timeline. */
export const setVisibleExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'app', type: 'server', text: 'App', lane: 1 },
    {
      id: 'cache',
      type: 'database',
      text: 'Cache',
      icon: 'redis',
      lane: 2,
      visible: false,
    },
  ],
  packets: [],
  timeline: [
    { type: 'comment', text: 'No cache yet', duration: 1000 },
    { type: 'set_visible', object: 'cache', visible: true },
    {
      type: 'comment',
      object: 'cache',
      text: 'Redis cache added',
      keep_until_end: true,
    },
  ],
};

/** `set_color`: a node is recolored mid-timeline (eased red → black cross-fade). */
export const setColorExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    {
      id: 'n',
      type: 'circle',
      text: 'node',
      body: '7',
      background_color: 'crimson',
      text_color: 'white',
      lane: 1,
    },
  ],
  packets: [],
  timeline: [
    { type: 'comment', object: 'n', text: 'Inserted red', duration: 900 },
    {
      type: 'set_color',
      object: 'n',
      background_color: '#1f2937',
      duration: 600,
    },
    {
      type: 'comment',
      object: 'n',
      text: 'Recolored black',
      keep_until_end: true,
    },
  ],
};

/** `set_color` on a connection: a traversal lights each edge along A → B → C. */
export const connectionRecolorExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'a', type: 'circle', body: 'A', lane: 1 },
    { id: 'b', type: 'circle', body: 'B', lane: 2 },
    { id: 'c', type: 'circle', body: 'C', lane: 3 },
  ],
  packets: [],
  connections: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  timeline: [
    { type: 'comment', text: 'Walking the path A → B → C', duration: 700 },
    { type: 'set_color', object: 'ab', color: 'seagreen', duration: 500 },
    { type: 'set_color', object: 'bc', color: 'seagreen', duration: 500 },
  ],
};

/** `rotate`: chained rotations toward absolute angles; the label stays upright. */
export const setIconExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'v', type: 'circle', text: 'node', body: 'v', icon: '∞', lane: 1 },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      object: 'v',
      text: 'Tentative distance: ∞',
      duration: 900,
    },
    { type: 'set_icon', object: 'v', icon: '7' },
    { type: 'comment', object: 'v', text: 'Relaxed to 7', duration: 900 },
    { type: 'set_icon', object: 'v', icon: '5' },
    {
      type: 'comment',
      object: 'v',
      text: 'Improved to 5',
      keep_until_end: true,
    },
  ],
};

export const rotateExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [{ id: 'gear', type: 'star', text: 'gear', body: '⚙', lane: 1 }],
  packets: [],
  timeline: [
    { type: 'rotate', object: 'gear', to: 90, duration: 600 },
    { type: 'rotate', object: 'gear', to: 360, duration: 800 },
  ],
};

/** `rotate_subtree`: a left tree rotation rebalances a right-leaning chain. */
export const rotateSubtreeExample: DataFlowSpec = {
  direction: 'tree',
  tree: { root: 'a', children: { a: { right: 'b' }, b: { right: 'c' } } },
  nodes: [
    {
      id: 'a',
      type: 'circle',
      body: '10',
      background_color: 'steelblue',
      text_color: 'white',
    },
    {
      id: 'b',
      type: 'circle',
      body: '20',
      background_color: 'steelblue',
      text_color: 'white',
    },
    {
      id: 'c',
      type: 'circle',
      body: '30',
      background_color: 'steelblue',
      text_color: 'white',
    },
  ],
  packets: [],
  timeline: [
    {
      type: 'comment',
      object: 'a',
      text: 'Unbalanced — a left rotation around 10 lifts 20',
      duration: 1500,
    },
    { type: 'rotate_subtree', object: 'a', rotation: 'left' },
  ],
};

/** `highlight`: a pulsing halo on a static node, then on a permanent connection. */
export const highlightExample: DataFlowSpec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'api', type: 'server', text: 'API', lane: 1 },
    { id: 'db', type: 'database', text: 'Database', icon: 'postgres', lane: 2 },
  ],
  connections: [
    { id: 'link', from: 'api', to: 'db', style: 'dashed', arrow_head: 'both' },
  ],
  packets: [],
  timeline: [
    { type: 'highlight', object: 'db', duration: 800 },
    { type: 'highlight', object: 'link', duration: 800 },
  ],
};
