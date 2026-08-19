# @dataflow-animator/angular

`<dfa-player>` — a standalone Angular component that compiles a JSON
specification into a deterministic, scrubbable animation of data flows
(client/server, SQL queries, microservices, logic circuits…).

- **Typed inputs**, one per player option. No `CUSTOM_ELEMENTS_SCHEMA`, no
  `schemas` opt-in, no stringly-typed attributes.
- **The animation clock runs outside the Angular zone**, so a playing player does
  not trigger change detection on every frame.
- **SSR-safe**: on a server the component renders an empty host element and
  touches no DOM.
- **Light DOM.** The player is regular markup you can style with regular CSS
  selectors.
- **No coordinates to provide** — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen, keyboard shortcuts.

This package is a **binding** over
[`@dataflow-animator/core`](../core/README.md), which holds the engine, the DOM
renderer and the stylesheet. It adds no rendering of its own: it calls
`mountPlayer(hostElement, spec, options)` and forwards your inputs as options.
That is why there is no separate pixel gate for it — the renderer it mounts is
already asserted identical to the pixel, across 180 configurations, against a bare
`mountPlayer` call.

Not using Angular? There is [`@dataflow-animator/react`](../react/README.md), and
[`@dataflow-animator/element`](../element/README.md) for everything else.

## Installation

```bash
npm install @dataflow-animator/angular @dataflow-animator/core
```

The core arrives on its own as a dependency; install it explicitly anyway, because
you import its stylesheet by name.

Requires **Angular 22**. `@angular/core` and `@angular/common` are peer
dependencies.

> **ESM only.** No CommonJS entry point.

## Usage

### 1. Import the stylesheet — once, globally

**This is not optional.** Without it the markup mounts and measures, but nothing
has a size, a colour or a transition — you get a silent blank box.

In `angular.json`:

```json
"styles": ["@dataflow-animator/core/styles.css", "src/styles.css"]
```

…or from your global stylesheet:

```css
@import '@dataflow-animator/core/styles.css';
```

### 2. Import the component and give it a spec

```ts
import { Component } from '@angular/core';
import {
  DataFlowPlayerComponent,
  type DataFlowSpec,
} from '@dataflow-animator/angular';

@Component({
  selector: 'app-demo',
  imports: [DataFlowPlayerComponent],
  template: `<dfa-player [spec]="spec" [height]="420" theme="blueprint" />`,
})
export class DemoComponent {
  readonly spec: DataFlowSpec = {
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
}
```

## Inputs

| Input         | Type                                       | Default (the core's) |
| ------------- | ------------------------------------------ | -------------------- |
| `spec`        | `DataFlowSpec` — **required**              | —                    |
| `theme`       | `PlayerTheme`                              | `'default'`          |
| `mode`        | `'auto' \| 'light' \| 'dark'`              | `'auto'`             |
| `density`     | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'`      |
| `height`      | `number \| string` (a number is pixels)    | `420`                |
| `width`       | `number \| string`                         | the container's      |
| `playerClass` | `string` — extra class on `.rdfa-player`   | —                    |
| `speed`       | `number`                                   | `1`                  |
| `initialT`    | `number` — opening instant, in ms          | `0`                  |
| `controls`    | `boolean`                                  | **`true`**           |
| `exportable`  | `boolean` — the JSON spec button           | `false`              |
| `autoPlay`    | `boolean`                                  | `false`              |
| `loop`        | `boolean`                                  | `false`              |
| `debug`       | `boolean` — the timeline overlay           | `false`              |
| `highlight`   | `Highlighter` — replaces Prism             | Prism                |
| `labels`      | `Partial<PlayerLabels>` — chrome strings   | English              |

**An input you never bind falls through to the core's default — it is not
`false`.** `controls` defaults to `true`, so `<dfa-player [spec]="spec" />` shows
the control bar; bind `[controls]="false"` to hide it.

`playerClass` rather than `class`: `class` on the tag already means the host
element's own class list, so this input feeds the core's `className` option — an
extra class on the `.rdfa-player` root inside.

## Outputs

| Output    | Payload                           | When                                        |
| --------- | --------------------------------- | ------------------------------------------- |
| `mounted` | `{ warnings: readonly string[] }` | after every mount, remounts included        |
| `error`   | `{ error: unknown }`              | the spec could not be mounted (also logged) |

The player mounts on the first change detection pass, not in the constructor, so
`mounted` is how you know it is there.

## Changing an input remounts the player

Every option is read once, when the player is built — so changing any input,
`spec` included, rebuilds it. Three things make that invisible:

- several inputs changing in the same change detection pass coalesce into **one**
  remount;
- the new player **reopens at the previous instant and play state**, so a change
  mid-scrub does not jump;
- only the **first** mount honours `initialT` / `autoPlay`.

`spec` and `labels` are keyed on their **structure**, not their object identity,
so `[spec]="buildSpec()"` or `[labels]="{ play: 'Lecture' }"` — a fresh object on
every pass — does not remount anything.

## Styling

The player is light DOM, so ordinary selectors reach it:

```css
dfa-player .rdfa-player {
  border-radius: 12px;
}
```

The host element is given `display: contents` so that `.rdfa-player` inherits the
containing block you gave the tag — which is what `[height]="'100%'"` needs. Set an
inline `display` yourself (`<dfa-player style="display: block" …>`) to opt out.

## Server-side rendering

Importing and rendering this component on a server is inert: it emits an empty
host element and mounts nothing. There is no hydration mismatch, because there is
no server markup to match. The player appears on the client's first change
detection pass.

## Documentation

- [Concepts and full spec reference](https://pierreolivierbrillant.github.io/dataflow-animator/)
- [`docs/SPEC.md`](../../docs/SPEC.md) — the functional specification
- [`@dataflow-animator/core`](../core/README.md) — engine, renderer, stylesheet

## License

[MIT](./LICENSE)
