# React DataFlow Animator

[![CI](https://github.com/PierreOlivierBrillant/react-dataflow-animator/actions/workflows/ci-cd.yml/badge.svg?branch=main)](https://github.com/PierreOlivierBrillant/react-dataflow-animator/actions/workflows/ci-cd.yml)
[![npm version](https://img.shields.io/npm/v/@dataflow-animator/react.svg)](https://www.npmjs.com/package/@dataflow-animator/react)
[![npm downloads](https://img.shields.io/npm/dm/@dataflow-animator/react.svg)](https://www.npmjs.com/package/@dataflow-animator/react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@dataflow-animator/react)](https://bundlephobia.com/package/@dataflow-animator/react)
[![license](https://img.shields.io/npm/l/@dataflow-animator/react.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-%3E%3D18-61dafb)](https://react.dev/)

React component that compiles a JSON specification into a deterministic and navigable dataflow animation (client/server, SQL queries, microservices...).

- No coordinates to provide — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen.
- Renders in the browser, safe to import from Docusaurus, Next.js, Vite, etc.
  (the diagram appears on hydration — see [SSR](#ssr)).
- Built-in syntax highlighting (Prism, replaceable).

## Installation

```bash
npm install @dataflow-animator/react
```

`react` and `react-dom` (≥ 18) are expected in `peerDependencies`.
[`@dataflow-animator/core`](./packages/core/README.md) — the engine, the DOM
renderer and the stylesheet — comes along as a dependency; nothing extra to
install. Note that the stylesheet is imported FROM the core, not from this
package.

No React? Two options, both published from this repository:

- [`@dataflow-animator/element`](./packages/element/README.md) — the
  `<dataflow-player>` custom element (light DOM). One tag, works in plain HTML,
  Vue, Svelte, Angular, Astro… and needs no build step from a CDN;
- [`@dataflow-animator/core`](./packages/core/README.md) directly — it mounts on
  its own: `mountPlayer(container, spec, options)`.

Either way the stylesheet is the core's, and it is not optional.

## Usage

```tsx
import { DataFlowPlayer } from '@dataflow-animator/react';
import '@dataflow-animator/core/styles.css';

const spec = {
  direction: 'left-to-right',
  nodes: [
    { id: 'browser', type: 'laptop', text: 'Navigateur', lane: 1 },
    { id: 'api', type: 'server', text: 'API', lane: 2 },
    { id: 'db', type: 'database', text: 'PostgreSQL', lane: 3 },
  ],
  packets: [
    {
      id: 'req',
      kind: 'http_packet',
      packet_content: { header: 'GET /users' },
    },
    {
      id: 'sql',
      kind: 'sql_request',
      request_content: 'SELECT * FROM users',
    },
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

> **Memoize your spec.** If the spec is defined within a parent component's body
> (inline literal object or computed without `useMemo`), it receives a new identity
> on each render. The compiler then recompiles the entire timeline, and the DOM measurement
> (`useStageGeometry`) is needlessly invalidated. Define the spec outside the
> component, or protect it with `useMemo` / a stable value.

## One-page concepts

A **spec** describes three things:

1. **`nodes`** — the diagram nodes (servers, clients, databases...).
   Automatic placement according to `direction` (linear or `circular`) and `lane`.
2. **`packets`** — the payloads that will flow between nodes
   (HTTP packets, SQL requests/responses).
3. **`timeline`** — the chronology: `move`, `arrow`, `parallel`, `loading`,
   `set_content`, `comment`, `highlight`.

The engine compiles the spec into a deterministic chronology: the time `t` (ms)
is the single source of truth, which makes seek and step navigation trivial —
and keeps the whole compilation step free of any DOM.

## Main props of `<DataFlowPlayer>`

| Prop         | Type                                       | Default         | Description                                                                            |
| ------------ | ------------------------------------------ | --------------- | -------------------------------------------------------------------------------------- |
| `spec`       | `DataFlowSpec`                             | —               | The specification to animate. Changing it remounts the player, keeping the instant.    |
| `height`     | `number \| string`                         | `420`           | Height of the stage.                                                                   |
| `width`      | `number \| string`                         | container       | Width of the stage. Must be known before the first measurement.                        |
| `initialT`   | `number`                                   | `0`             | Instant the player opens at, in ms. Read once, at mount.                               |
| `autoPlay`   | `boolean`                                  | `false`         | Starts playback automatically.                                                         |
| `loop`       | `boolean`                                  | `false`         | Replays on loop at the end.                                                            |
| `controls`   | `boolean`                                  | `true`          | Displays the controls bar.                                                             |
| `exportable` | `boolean`                                  | `false`         | Button opening the JSON spec (copy / download).                                        |
| `theme`      | `PlayerTheme`                              | `'default'`     | Palette: `default`, `dots`, `blueprint`, `pcb`, `chalk`, `terminal`, `paper`, `neon`.  |
| `mode`       | `'light' \| 'dark' \| 'auto'`              | `'auto'`        | Variant of `theme`. `auto` follows `prefers-color-scheme` and a parent `[data-theme]`. |
| `density`    | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` | Visual scale.                                                                          |
| `speed`      | `number`                                   | `1`             | Playback speed.                                                                        |
| `highlight`  | `Highlighter`                              | Prism           | Override syntax highlighting.                                                          |
| `debug`      | `boolean`                                  | `false`         | Timeline debugging overlay.                                                            |
| `fallback`   | `ReactNode`                                | —               | Rendered on the server and until the player mounts (see [SSR](#ssr)).                  |

## Extensibility

An icon is **SVG markup**, or a **factory** returning an `SVGElement` when it
has to vary:

```ts
import { registerNodeIcon, registerSubIcon } from '@dataflow-animator/react';

registerNodeIcon('queue', '<svg viewBox="0 0 24 24">…</svg>');
registerSubIcon('kafka', '<svg viewBox="0 0 24 24">…</svg>');

registerSubIcon('build', () => buildAnimatedGlyph());
```

Markup is parsed once, on first use, and cloned afterwards; a factory is called
on every resolution. A registration always wins over the built-in icon of the
same name.

A sub-icon can also be **free text** (`'v2'`, `'API'`, `'JWT'`),
automatically rendered in a badge.

> **Global registry.** `registerNodeIcon` and `registerSubIcon` mutate a module-level
> registry — shared across all player instances and across requests in an
> SSR environment. Call them **only once at application startup**
> (entry file, `_app.tsx`, `layout.tsx`...), never in a component body or
> a `useEffect`. Registering never touches the DOM, so it is safe at module
> scope in a bundle that also runs on the server.

## SSR

The player emits **no markup on the server**: it mounts a framework-agnostic DOM
renderer in a client effect, so the static HTML holds a correctly-sized
placeholder and the diagram appears on hydration. There is no hydration mismatch
— there is nothing to match. Use `fallback` to render a poster, a caption or a
skeleton into the static HTML:

```tsx
<DataFlowPlayer spec={spec} fallback={<img src="/diagram.png" alt="…" />} />
```

`NodeView` behaves the same way. `<dataflow-player>` is client-only in the same
sense: importing `@dataflow-animator/element` on a server is inert, and the tag
renders nothing until it reaches a browser.

## Documentation

- **Documentation site** (demos, interactive playground, complete API reference)
  — deployed from [`apps/docs`](./apps/docs).
- **Functional specification**: [`docs/SPEC.md`](./docs/SPEC.md).
- **Internal architecture**: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
- **JSON Schema**: exposed via the `dataFlowSchema` export.
- **Release notes**: [`CHANGELOG.md`](./CHANGELOG.md) — start here when upgrading
  across a major version.

## Repository structure

The project is an npm workspaces monorepo:

```text
packages/
  core/                      @dataflow-animator/core — the published framework-agnostic
                             package: spec types, JSON Schema, the pure engine,
                             TeX/highlight, JSON export, the DOM renderer the player
                             runs on and its stylesheet. Usable on its own, and the
                             common dependency of every binding. No React dependency
  react/                     @dataflow-animator/react — published on npm: a thin React
                             binding that mounts the core's renderer and DEPENDS on the
                             core (it does not bundle it)
  element/                   @dataflow-animator/element — published on npm: the
                             <dataflow-player> custom element (light DOM), same
                             dependency pattern as react. For plain HTML, Vue, Svelte,
                             Angular — anything that renders a tag
apps/
  docs/                      Docusaurus site (demos, playground, API doc)
docs/
  SPEC.md, ARCHITECTURE.md   internal references
```

To contribute or run locally: see [`CLAUDE.md`](./CLAUDE.md)
(quality commands to run before each commit).

## License

[MIT](./LICENSE)
