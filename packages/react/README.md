# @dataflow-animator/react

`<DataFlowPlayer>` — a React component that compiles a JSON specification into a
deterministic, scrubbable animation of data flows (client/server, SQL queries,
microservices, logic circuits…).

- No coordinates to provide — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen, keyboard shortcuts.
- SSR-safe: usable as-is in Docusaurus, Next.js, Vite, Remix…
- Built-in syntax highlighting (Prism, replaceable).

This package is a **binding** over
[`@dataflow-animator/core`](../core/README.md), which holds the engine, the DOM
renderer and the stylesheet. It adds no rendering of its own — an effect calls
`mountPlayer(host, spec, options)` and React never manages the player's children.

Not using React? There is [`@dataflow-animator/angular`](../angular/README.md)
for Angular, and [`@dataflow-animator/element`](../element/README.md) — the
`<dataflow-player>` custom element — everywhere else. Or mount the core directly.

## Installation

```bash
npm install @dataflow-animator/react @dataflow-animator/core
```

`react` and `react-dom` (≥ 18) are expected as `peerDependencies`. The core
arrives on its own as a dependency; install it explicitly anyway, because you
import its stylesheet by name.

> **ESM only.** No CommonJS entry point. Your bundler (Vite, Next.js, esbuild…)
> must support ES modules. Outside a bundler, Node.js ≥ 12 with
> `"type": "module"` (or `--input-type=module`) is required.

## Usage

Two imports: the component and the core's stylesheet. **The stylesheet is not
optional** — without it the markup mounts and measures, but nothing has a size,
a colour or a transition.

```tsx
import { DataFlowPlayer } from '@dataflow-animator/react';
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
};

export default function Example() {
  return <DataFlowPlayer spec={spec} />;
}
```

## Concepts on one page

A **spec** describes three things:

1. **`nodes`** — the diagram's nodes (servers, clients, databases…). Placement
   is automatic, from `direction` (linear, `circular`, `tree`, `circuit`, or
   `graph` for your own coordinates) and `lane`.
2. **`packets`** — the payloads that travel between nodes (HTTP packets, SQL
   requests and responses).
3. **`timeline`** — the chronology: `move`, `arrow`, `parallel`, `loading`,
   `set_content`, `comment`, `highlight`…

The engine compiles the spec into a deterministic timeline: the instant `t` (ms)
is the single source of truth, which is what makes seeking, step navigation and
SSR trivial.

## `<DataFlowPlayer>` props

| Prop         | Type                                       | Default         | Description                                                                                 |
| ------------ | ------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------- |
| `spec`       | `DataFlowSpec`                             | —               | The specification to animate.                                                               |
| `className`  | `string`                                   | —               | Extra CSS class on the root container.                                                      |
| `style`      | `CSSProperties`                            | —               | Inline styles on the root container.                                                        |
| `height`     | `number \| string`                         | `420`           | Scene height.                                                                               |
| `width`      | `number \| string`                         | container width | Scene width.                                                                                |
| `initialT`   | `number`                                   | `0`             | Instant the player opens at, in ms.                                                         |
| `autoPlay`   | `boolean`                                  | `false`         | Starts playback automatically.                                                              |
| `loop`       | `boolean`                                  | `false`         | Replays in a loop at the end.                                                               |
| `controls`   | `boolean`                                  | `true`          | Displays the controls bar.                                                                  |
| `exportable` | `boolean`                                  | `false`         | Adds a button that opens the JSON spec (copy / download).                                   |
| `theme`      | `PlayerTheme`                              | `'default'`     | Visual palette; each has a light and a dark variant.                                        |
| `mode`       | `'auto' \| 'light' \| 'dark'`              | `'auto'`        | Follows an ancestor `[data-theme]`, then the OS preference.                                 |
| `density`    | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Visual scale.                                                                               |
| `speed`      | `number`                                   | `1`             | Playback speed.                                                                             |
| `highlight`  | `Highlighter`                              | Prism           | Replaces the syntax highlighter.                                                            |
| `labels`     | `Partial<PlayerLabels>`                    | English         | Localises the chrome (tooltips, aria, dialog title).                                        |
| `debug`      | `boolean`                                  | `false`         | Timeline debug overlay.                                                                     |
| `fallback`   | `ReactNode`                                | —               | Rendered on the server and until the player has mounted, in place of the loading indicator. |

The chrome — the control bar and the JSON dialog — is published in English.
`labels` overrides its strings key by key, and any key left out keeps the
core's English default:

```tsx
<DataFlowPlayer
  spec={spec}
  labels={{ play: 'Lecture', pause: 'Pause', nextStep: 'Étape suivante' }}
/>
```

## Changing props: the player remounts

Every option is read **once, when the player mounts** — that is the core's
contract, and the custom element behaves the same way. Changing a prop therefore
rebuilds the player, and:

- the new player reopens at the **instant and play state** the previous one was
  at, so editing options while scrubbing is invisible;
- only the **first** mount honours `initialT` and `autoPlay`;
- only the **first** mount waits for a paint (see below); a remount is
  immediate, so a live-edited spec never blinks;
- `spec` is keyed **structurally**, not by identity, so an inline
  `spec={{ … }}` object rebuilt on every render does not remount anything.

## The placeholder, and the loading indicator

Before the player exists, the component renders a correctly sized box — that is
all the server ever emits, and there is no hydration mismatch because there is
nothing to match.

The box is not blank: it carries a **loading indicator**, revealed only if the
wait lasts long enough to be worth naming (the reveal is delayed in CSS, so a
fast mount flashes nothing). Its text is the `loading` key of `labels`, and
passing `fallback` replaces it with a poster, a caption or a skeleton of your
own.

The **first** mount waits two frames before building the player, so that box is
genuinely painted first. Without that wait it would be committed and replaced
inside a single task — never shown — and compiling and measuring a heavy spec
would freeze the page on an empty rectangle. While the main thread is busy the
indicator keeps fading in and spinning: both are compositor-driven properties.

The placeholder wears `.rdfa-player` to reserve the box, so it is marked
`data-placeholder` — that attribute is how you tell it from a mounted player.

## Extensibility

```ts
import { registerNodeIcon, registerSubIcon } from '@dataflow-animator/react';

// An icon is SVG MARKUP (or a `() => SVGElement` factory), not a ReactNode:
// the player renders outside React.
registerNodeIcon('queue', '<svg viewBox="0 0 24 24">…</svg>');
registerSubIcon('kafka', '<svg viewBox="0 0 24 24">…</svg>');
```

A sub-icon can also be **free text** (`'v2'`, `'API'`, `'JWT'`), rendered
automatically as a badge.

## Without React?

The core mounts on its own, with no framework at all:
`mountPlayer(container, spec, options)` — see
[`@dataflow-animator/core`](../core/README.md).

## Documentation

- [Full site](https://pierreolivierbrillant.github.io/dataflow-animator/) —
  concepts, demos, interactive playground, API reference
- [Packages and bindings](https://pierreolivierbrillant.github.io/dataflow-animator/docs/reference/packages)
  — the four surfaces side by side
- [`docs/SPEC.md`](../../docs/SPEC.md) — the functional specification

## Licence

[MIT](../../LICENSE)
