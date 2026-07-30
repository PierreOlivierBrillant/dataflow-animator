# @dataflow-animator/core

Framework-agnostic engine and DOM renderer for deterministic, scrubbable
data-flow animations compiled from a JSON specification (client/server, SQL
queries, microservices, logic circuits…).

- No coordinates to provide — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen, keyboard shortcuts.
- No framework runtime. This is the package every binding is built on.
- Deterministic: `evaluate(timeline, t)` is a pure function, so seeking backwards
  costs exactly what seeking forwards does.
- Built-in syntax highlighting (Prism, replaceable).

## Installation

```bash
npm install @dataflow-animator/core
```

> **ESM only.** No CommonJS entry point. Your bundler (Vite, esbuild, webpack…)
> must support ES modules.

Using React? Reach for [`@dataflow-animator/react`](../react/README.md)
instead — it wraps this package in a component. Anywhere else — plain HTML, Vue,
Svelte, Angular — reach for
[`@dataflow-animator/element`](../element/README.md), the `<dataflow-player>`
custom element. Both bindings render through this package, so the stylesheet
below is theirs too.

## Usage

Two imports: the mount function and the stylesheet. **The stylesheet is not
optional** — without it the markup mounts and measures, but nothing has a size,
a colour or a transition.

```ts
import { mountPlayer } from '@dataflow-animator/core';
import '@dataflow-animator/core/styles.css';

const spec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Browser', lane: 1 },
    { id: 'api', type: 'server', text: 'API', lane: 2 },
    { id: 'db', type: 'database', text: 'PostgreSQL', lane: 3 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
    { id: 'sql', kind: 'sql_request', request_content: 'SELECT * FROM users' },
  ],
  timeline: [
    { type: 'move', object: 'req', from: 'browser', to: 'api' },
    { type: 'move', object: 'sql', from: 'api', to: 'db' },
  ],
} satisfies DataFlowSpec;

const player = mountPlayer(document.getElementById('diagram')!, spec, {
  height: 420,
  autoPlay: true,
});

// Later:
player.destroy();
```

`mountPlayer` returns a handle: `el` (the `.rdfa-player` root), `clock`
(`play`/`pause`/`seek`/`playTo`/`subscribe`), `warnings` (what the compiler had
to say about the spec) and `destroy()`, which releases every listener, observer
and animation frame it took.

**Every option is read once, at mount.** Changing one means mounting again — the
clock's `t` and play state are yours to carry across. That is the deliberate
trade that makes a frame cheap: a tick mutates the DOM in place instead of
rebuilding a tree.

## Concepts in one page

A **spec** describes three things:

1. **`nodes`** — the diagram's boxes (servers, clients, databases, logic gates…).
   Placed automatically from `direction` (linear, `circular`, `tree`, `circuit`)
   and `lane`.
2. **`packets`** — the payloads that travel between nodes (HTTP packets, SQL
   requests and responses).
3. **`timeline`** — the chronology: `move`, `arrow`, `parallel`, `loading`,
   `set_content`, `comment`, `highlight`, and the rest.

`compile(spec)` turns that into a `Timeline` of dated clips. Time `t` (in ms) is
the only source of truth, which is what makes seeking, step navigation and
server rendering trivial.

## Main `mountPlayer` options

| Option       | Type                                       | Default         | Description                                        |
| ------------ | ------------------------------------------ | --------------- | -------------------------------------------------- |
| `height`     | `number \| string`                         | `420`           | Height of the player.                              |
| `width`      | `number \| string`                         | container       | Width; must be set before the first measurement.   |
| `initialT`   | `number`                                   | `0`             | Instant the player opens at, in ms.                |
| `autoPlay`   | `boolean`                                  | `false`         | Starts playing on mount.                           |
| `loop`       | `boolean`                                  | `false`         | Replays from the start at the end.                 |
| `controls`   | `boolean`                                  | `true`          | Control bar, keyboard shortcuts and focus ring.    |
| `exportable` | `boolean`                                  | `false`         | Adds the JSON spec button and its dialog.          |
| `theme`      | `PlayerTheme`                              | `'default'`     | Palette (`dots`, `blueprint`, `pcb`, `chalk`…).    |
| `mode`       | `'auto' \| 'light' \| 'dark'`              | `'auto'`        | Follows `prefers-color-scheme` and `[data-theme]`. |
| `density`    | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Visual scale.                                      |
| `speed`      | `number`                                   | `1`             | Playback speed.                                    |
| `highlight`  | `Highlighter`                              | Prism           | Replaces the syntax highlighter.                   |
| `debug`      | `boolean`                                  | `false`         | Timeline debug overlay.                            |

Need the diagram without the chrome? `mountStage(container, spec, t, options)`
returns a handle whose `update(t)` you drive yourself — `createPlayerClock` is
exported so you do not have to reimplement its playback semantics.

## Server-side rendering

Importing this package on a server is safe: no module touches `document` at
import time, registering an icon included. Mounting needs a real DOM, so call
`mountPlayer` from a client-side effect.

## Extensibility

```ts
import { registerNodeIcon, registerSubIcon } from '@dataflow-animator/core';

registerNodeIcon('queue', '<svg viewBox="0 0 24 24">…</svg>');
registerSubIcon('kafka', () => buildMySvgElement());
```

An icon is SVG markup or a `() => SVGElement` factory, and a registration wins
over every built-in. A sub-icon can also be **free text** (`'v2'`, `'API'`,
`'JWT'`), rendered as a badge automatically.

## Documentation

Full site (demos, playground, API reference):
<https://github.com/PierreOlivierBrillant/react-dataflow-animator>.

## Licence

[MIT](./LICENSE) — the bundle embeds third-party icon geometry, attributed at the
end of that file.
