# @dataflow-animator/element

`<dataflow-player>` — a custom element that compiles a JSON specification into a
deterministic, scrubbable animation of data flows (client/server, SQL queries,
microservices, logic circuits…).

- **No framework.** It is a standard custom element, so it works in plain HTML,
  Vue, Svelte, Angular, Astro, Rails, Django — anywhere that renders a tag.
- **Light DOM, no Shadow DOM.** The player is regular markup you can style with
  regular CSS selectors.
- **No coordinates to provide** — the engine places the nodes.
- Built-in player: play, pause, step navigation, fullscreen, keyboard shortcuts.
- SSR-safe: importing this package on a server is inert, not fatal.

This package is a **binding** over
[`@dataflow-animator/core`](../core/README.md), which holds the engine, the DOM
renderer and the stylesheet. It adds no rendering of its own — its
`connectedCallback` calls `mountPlayer(this, spec, options)`, and a pixel gate in
this repository asserts the result is identical to that call, to 0.0000%, across
60 configurations.

Using React? Reach for [`@dataflow-animator/react`](../react/README.md) instead.

## Installation

```bash
npm install @dataflow-animator/element @dataflow-animator/core
```

The core arrives on its own as a dependency; install it explicitly anyway,
because you import its stylesheet by name.

> **ESM only.** No CommonJS entry point. Your bundler (Vite, esbuild, webpack…)
> must support ES modules.

## Usage

Two imports. Importing the package **registers the tag**; importing the core's
stylesheet is what gives the markup a size.

```js
import '@dataflow-animator/element';
import '@dataflow-animator/core/styles.css';
```

> **The stylesheet is not optional.** Without it the markup mounts and measures,
> but nothing has a size, a colour or a transition — you get a silent blank box.
> Import it once, anywhere in your app.

Then place the tag and hand it a spec. The `spec` attribute takes JSON:

```html
<dataflow-player
  height="420"
  theme="blueprint"
  spec='{
    "direction": "left-to-right",
    "nodes": [
      { "id": "browser", "type": "laptop", "text": "Browser", "lane": 1 },
      { "id": "api", "type": "server", "text": "API", "lane": 2 },
      { "id": "db", "type": "database", "text": "PostgreSQL", "lane": 3 }
    ],
    "packets": [
      { "id": "req", "kind": "http_packet", "packet_content": { "header": "GET /users" } },
      { "id": "sql", "kind": "sql_request", "request_content": "SELECT * FROM users" }
    ],
    "timeline": [
      { "type": "move", "object": "req", "from": "browser", "to": "api" },
      { "type": "move", "object": "sql", "from": "api", "to": "db" }
    ]
  }'
></dataflow-player>
```

…or, for anything beyond a small spec, set the `spec` **property** with a real
object and skip the JSON-in-an-attribute escaping entirely:

```js
document.querySelector('dataflow-player').spec = spec;
```

In Vue and Svelte, `:spec="spec"` / `spec={spec}` sets the property, so this is
what you get by default there.

### From a CDN, with no build step

There is deliberately **no self-contained bundle** in this package: shipping one
would mean shipping a second copy of the engine, which is the one thing the
packaging is designed to avoid. Two recipes cover plain HTML instead.

A CDN that rewrites bare module specifiers (esm.sh, jspm) needs nothing else:

```html
<link
  rel="stylesheet"
  href="https://esm.sh/@dataflow-animator/core/styles.css"
/>
<script type="module">
  import 'https://esm.sh/@dataflow-animator/element';
</script>
```

Or declare an import map, which keeps one copy of the core for every module that
asks for it:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@dataflow-animator/core/dist/styles.css"
/>
<script type="importmap">
  {
    "imports": {
      "@dataflow-animator/core": "https://cdn.jsdelivr.net/npm/@dataflow-animator/core/+esm",
      "@dataflow-animator/element": "https://cdn.jsdelivr.net/npm/@dataflow-animator/element/+esm"
    }
  }
</script>
<script type="module">
  import '@dataflow-animator/element';
</script>
```

## Attributes and properties

Every option of the core's player is reachable. The rule is mechanical: a
camelCase option becomes a **kebab-case attribute**, and the property keeps the
camelCase name.

| Attribute      | Property      | Type                                       | Default         |
| -------------- | ------------- | ------------------------------------------ | --------------- |
| `spec`         | `spec`        | JSON string / `DataFlowSpec` object        | —               |
| `theme`        | `theme`       | `PlayerTheme`                              | `'default'`     |
| `mode`         | `mode`        | `'auto' \| 'light' \| 'dark'`              | `'auto'`        |
| `density`      | `density`     | `'compact' \| 'comfortable' \| 'spacious'` | `'comfortable'` |
| `height`       | `height`      | number (px) or CSS length                  | `420`           |
| `width`        | `width`       | number (px) or CSS length                  | container width |
| `player-class` | `playerClass` | string                                     | —               |
| `speed`        | `speed`       | number                                     | `1`             |
| `initial-t`    | `initialT`    | number (ms)                                | `0`             |
| `controls`     | `controls`    | boolean                                    | **`true`**      |
| `exportable`   | `exportable`  | boolean                                    | `false`         |
| `auto-play`    | `autoPlay`    | boolean                                    | `false`         |
| `loop`         | `loop`        | boolean                                    | `false`         |
| `debug`        | `debug`       | boolean                                    | `false`         |
| —              | `highlight`   | `Highlighter` function                     | Prism           |
| —              | `labels`      | `Partial<PlayerLabels>` object             | English         |

Three entries do not follow the mechanical rule, and all are forced:

- **`player-class`** is the core's `className` option. `className` on an element
  already means the element's own class list, so claiming it would break
  `el.className` for you.
- **`highlight`** is a property only — a function cannot live in an attribute.
- **`labels`** is a property only too — an object does not live in an attribute.
  It localises the chrome (the control bar's and JSON dialog's `aria-label`s,
  `title`s and headings); any key you leave out keeps the core's English
  default:

  ```js
  const player = document.querySelector('dataflow-player');
  player.labels = {
    play: 'Lecture',
    pause: 'Pause',
    nextStep: 'Étape suivante',
  };
  ```

An unknown `theme` or `mode` is passed through: it becomes a `data-theme` /
`data-mode` hook that matches no CSS rule, so you get the default palette rather
than an error. An unknown `density` is refused with a console warning, because
the engine indexes it.

### Boolean attributes: **absence is not `false`**

This element does **not** follow the usual HTML convention, and it cannot,
because the core defaults `controls` to `true`:

| You write                                                                               | You get                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------ |
| nothing                                                                                 | **the core's default** — controls stay on! |
| `controls` · `controls=""` · `controls="controls"` · `controls="true"` · `controls="1"` | `true`                                     |
| `controls="false"` · `controls="0"`                                                     | `false`                                    |
| anything else                                                                           | a console warning, then the default        |

**To hide the control bar, write `controls="false"`.** Removing the attribute
means "unspecified", which for `controls` means on.

The properties follow the same logic: a getter returns `boolean | undefined`,
where `undefined` means "unspecified", and setting a property to `undefined`
removes the attribute rather than writing `"false"`.

## Events

Mounting is **always deferred by one microtask**, first mount included. That is
what lets you set several attributes in a row and get one player instead of
four, and what makes `createElement` → `append` → `.spec = …` work. It also means
you cannot read the player straight after inserting the tag — so mounting is
observable:

| Event                     | When                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `dataflow-player:mounted` | after every successful mount, remounts included. `detail: { warnings }` |
| `dataflow-player:error`   | the `spec` attribute could not be read. `detail: { error }`             |

```js
const player = document.querySelector('dataflow-player');
player.addEventListener('dataflow-player:mounted', () => {
  // .rdfa-player exists now
});
```

Both names are constants: registering the element under a different tag does not
rename them.

## Changing options: the player remounts

Every option is read **once, when the player mounts** — that is the core's
contract, and the React binding behaves the same way. Changing an attribute or a
property therefore rebuilds the player, and:

- several synchronous changes are coalesced into **one** remount;
- the new player reopens at the **instant and play state** the previous one was
  at, so editing options while scrubbing is invisible;
- only the **first** mount honours `initial-t` and `auto-play`. Afterwards the
  resumed position wins.

An unreadable `spec` attribute changes nothing: the mounted player is left
exactly as it is, and the error is reported on the console and as an event. A
typo mid-edit does not blank your page.

## Styling

Light DOM means ordinary CSS reaches the player — no `::part`, no custom
properties to plumb through:

```css
dataflow-player .rdfa-player {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.12);
}
```

The element removes its own box with an inline `display: contents`, so
`.rdfa-player` inherits the layout context you gave the tag (this is what makes
`height="100%"` and flex placement work). It is only applied when you have set no
inline `display`, so to opt out use `style="display: block"` or a
`display: … !important` rule.

## Registering another tag name

The tag is registered for you at import. Call `defineDataFlowPlayer` only to add
another name:

```js
import { defineDataFlowPlayer } from '@dataflow-animator/element';

defineDataFlowPlayer('lesson-player'); // registers a subclass under a second tag
```

It is idempotent, and it warns instead of hijacking a tag something else already
defined.

## Extensibility

Icons, syntax highlighting and the engine itself come from the core — which you
already have in hand:

```js
import { registerNodeIcon, registerSubIcon } from '@dataflow-animator/core';

// An icon is SVG MARKUP (or a `() => SVGElement` factory).
registerNodeIcon('queue', '<svg viewBox="0 0 24 24">…</svg>');
registerSubIcon('kafka', '<svg viewBox="0 0 24 24">…</svg>');
```

A sub-icon can also be **free text** (`'v2'`, `'API'`, `'JWT'`), rendered
automatically as a badge.

## TypeScript

The package ships its own declarations and augments `HTMLElementTagNameMap`, so
`document.querySelector('dataflow-player')` is typed with no cast. Spec types come
straight from the core, so there is one `DataFlowSpec` no matter which package you
import it from:

```ts
import type { DataFlowSpec } from '@dataflow-animator/element';

const spec: DataFlowSpec = {
  /* … */
};
document.querySelector('dataflow-player')!.spec = spec;
```

## Server-side rendering

Importing this package on a server is a no-op: it touches neither `HTMLElement`
nor `customElements` at import time, and registration returns early when there is
no registry. The tag renders nothing until it reaches a browser, so treat it as a
client-only element (put a poster or a caption around it if you need static
content).

## Documentation

- [Full site](https://pierreolivierbrillant.github.io/dataflow-animator/) —
  concepts, demos, interactive playground, API reference
- [Packages and bindings](https://pierreolivierbrillant.github.io/dataflow-animator/docs/reference/packages)
  — the four surfaces side by side
- [`docs/SPEC.md`](../../docs/SPEC.md) — the functional specification

## Licence

[MIT](../../LICENSE)
