# DataFlow Animator

[![CI](https://github.com/PierreOlivierBrillant/dataflow-animator/actions/workflows/ci-cd.yml/badge.svg?branch=main)](https://github.com/PierreOlivierBrillant/dataflow-animator/actions/workflows/ci-cd.yml)
[![license](https://img.shields.io/npm/l/@dataflow-animator/core.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6)](https://www.typescriptlang.org/)

[![core](https://img.shields.io/npm/v/@dataflow-animator/core?label=core)](https://www.npmjs.com/package/@dataflow-animator/core)
[![react](https://img.shields.io/npm/v/@dataflow-animator/react?label=react)](https://www.npmjs.com/package/@dataflow-animator/react)
[![element](https://img.shields.io/npm/v/@dataflow-animator/element?label=element)](https://www.npmjs.com/package/@dataflow-animator/element)
[![angular](https://img.shields.io/npm/v/@dataflow-animator/angular?label=angular)](https://www.npmjs.com/package/@dataflow-animator/angular)

A JSON specification compiled into a deterministic, scrubbable dataflow
animation (client/server, SQL queries, microservices, logic circuits...) —
with one thin binding per framework.

- **A framework-agnostic engine**, and three bindings over it: React
  (`<DataFlowPlayer>`), Angular (`<dfa-player>`) and a custom element
  (`<dataflow-player>`) for everything else. They render the same pixels.
- No coordinates to provide — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen, keyboard
  shortcuts, and a chrome you can localise key by key.
- Renders in the browser, safe to import from Docusaurus, Next.js, Vite, etc.
  (the diagram appears on hydration — see [SSR](#ssr)).
- Built-in syntax highlighting (Prism, replaceable).

The sections below show the React binding; the
[Installation page](https://pierreolivierbrillant.github.io/dataflow-animator/docs/installation)
has the same walkthrough for each of the four packages.

## Installation

```bash
npm install @dataflow-animator/react @dataflow-animator/core
```

`react` and `react-dom` (≥ 18) are expected in `peerDependencies`.
[`@dataflow-animator/core`](./packages/core/README.md) — the engine, the DOM
renderer and the stylesheet — arrives on its own as a dependency; install it
explicitly anyway, because you import its stylesheet by name.

No React? Three options, all published from this repository:

- [`@dataflow-animator/angular`](./packages/angular/README.md) — the
  `<dfa-player>` standalone component, with typed inputs, the clock kept out of
  the Angular zone, and SSR support;
- [`@dataflow-animator/element`](./packages/element/README.md) — the
  `<dataflow-player>` custom element (light DOM). One tag, works in plain HTML,
  Vue, Svelte, Astro… and needs no build step from a CDN;
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

> **Changing an option remounts the player.** Every option is read once, at
> mount — so changing any of them, `spec` included, rebuilds the player. The
> current instant and play state carry across, which is what makes editing a
> spec live stay smooth. Only the **first** mount honours `initialT` and
> `autoPlay`.
>
> Remounting is keyed on the spec's **structure**, not its referential identity:
> a literal object rebuilt on every parent render costs a serialisation, not a
> rebuild. `useMemo` is still worthwhile on a hot render path, but it is no
> longer the difference between smooth and stuttering. `labels` is compared the
> same way.

## One-page concepts

A **spec** describes three things:

1. **`nodes`** — the diagram nodes (servers, clients, databases, logic gates...).
   Automatic placement according to `direction` — linear (`left-to-right` and
   its three siblings), `circular`, `graph`, `tree` or `circuit` — and `lane`.
2. **`packets`** — the payloads that will flow between nodes
   (HTTP packets, SQL requests/responses).
3. **`timeline`** — the chronology: `move`, `arrow`, `parallel`, `loading`,
   `set_content`, `comment`, `highlight`, `set_visible`, `set_color`,
   `set_icon`, `rotate`, `flow`, `toggle`, `wait`.

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
| `labels`     | `Partial<PlayerLabels>`                    | English         | Localises the chrome (tooltips, `aria-label`s, the JSON dialog), key by key.           |
| `debug`      | `boolean`                                  | `false`         | Timeline debugging overlay.                                                            |
| `fallback`   | `ReactNode`                                | —               | Rendered on the server and until the player mounts (see [SSR](#ssr)).                  |
| `className`  | `string`                                   | —               | Extra class on the root container.                                                     |
| `style`      | `CSSProperties`                            | —               | Inline styles on the root container.                                                   |

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
— there is nothing to match.

In React that placeholder carries a **loading indicator**, revealed only if the
wait lasts long enough to be worth naming — the reveal is delayed in CSS, so a
fast mount flashes nothing, and its text is the `loading` key of `labels`. The
first mount waits two frames so the placeholder is really painted before the
spec is compiled and measured; a remount does not wait, so a live-edited spec
never blinks. Use `fallback` to render a poster, a caption or a skeleton into
the static HTML instead:

```tsx
<DataFlowPlayer spec={spec} fallback={<img src="/diagram.png" alt="…" />} />
```

`NodeView` behaves the same way, and so do the other two bindings:
`<dataflow-player>` and `<dfa-player>` are client-only in the same sense —
importing either package on a server is inert, and the tag renders nothing
until it reaches a browser. The Angular component guards every DOM touch with
`isPlatformBrowser`.

## Documentation

- **[Documentation site](https://pierreolivierbrillant.github.io/dataflow-animator/)**
  (demos, interactive playground, complete API reference) — deployed from
  [`apps/docs`](./apps/docs). Start at
  [Packages and bindings](https://pierreolivierbrillant.github.io/dataflow-animator/docs/reference/packages)
  to pick yours.
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
                             dependency pattern as react. For plain HTML, Vue, Svelte
                             — anything that renders a tag
  angular/                   @dataflow-animator/angular — published on npm: the
                             <dfa-player> standalone component, same dependency
                             pattern again. Built with ng-packagr (Angular Package
                             Format), the one foreign toolchain in this repository
apps/
  docs/                      Docusaurus site (demos, playground, API doc)
docs/
  SPEC.md, ARCHITECTURE.md   internal references
```

To contribute or run locally: see [`CONTRIBUTING.md`](./CONTRIBUTING.md) — setup,
the check sequence, the visual gates, and the rules that are not obvious from the
code.

## License

[MIT](./LICENSE)
