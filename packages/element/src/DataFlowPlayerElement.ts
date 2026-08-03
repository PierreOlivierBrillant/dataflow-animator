import {
  mountPlayer,
  type DataFlowSpec,
  type Density,
  type Highlighter,
  type PlayerHandle,
  type PlayerLabels,
  type PlayerMode,
  type PlayerOptions,
  type PlayerTheme,
} from '@dataflow-animator/core';
import {
  OPTION_ATTRIBUTES,
  parseBoolean,
  parseDimension,
  parseNumber,
  readOptions,
} from './options';

/**
 * `<dataflow-player>` — the core's player as a custom element, in LIGHT DOM.
 *
 * The element adds no rendering of its own. It calls
 * `mountPlayer(this, spec, options)` and the element itself IS the container, so
 * the core's global `.rdfa-*` stylesheet applies with nothing to pierce. That is
 * also why there is a pixel gate (`npm run harness:element`) asserting 0.0000%
 * against a bare `mountPlayer`: this wrapper has no licence to change a pixel,
 * and a gate is the only thing that keeps that true.
 *
 * The consumer imports `@dataflow-animator/core/styles.css` once. This package
 * ships no CSS — the engine and the stylesheet are delivered once, by the core,
 * for every binding.
 *
 * SSR-safe: `HTMLElement` is only touched through `ElementBase` below, nothing
 * reaches the DOM at import time, and `defineDataFlowPlayer` returns early when
 * there is no registry.
 */

/**
 * `extends` evaluates its base AT IMPORT, and `HTMLElement` does not exist on the
 * server — so a plain `extends HTMLElement` would throw on `import`, before
 * anyone even asked to mount anything. The dummy base is never instantiated
 * there: nothing in this module runs server-side. The cast is what lets the rest
 * of the class be written against the real DOM type.
 */
const ElementBase = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement;

/** Fired after every successful mount, remounts included. `detail: { warnings }`. */
export const MOUNTED_EVENT = 'dataflow-player:mounted';
/** Fired when the `spec` attribute cannot be read. `detail: { error }`. */
export const ERROR_EVENT = 'dataflow-player:error';

/** Log prefix, and the event names above: constants, so renaming the tag moves neither. */
const LOG = '[dataflow-player]';

/** The tag `defineDataFlowPlayer` registers when it is not given one. */
export const DEFAULT_TAG_NAME = 'dataflow-player';

export class DataFlowPlayerElement extends ElementBase {
  static get observedAttributes(): string[] {
    // `spec` is observed too, but it is not an option: it takes its own path
    // (parsed into a spec object) in `attributeChangedCallback`.
    return ['spec', ...OPTION_ATTRIBUTES];
  }

  #handle: PlayerHandle | null = null;
  /**
   * The effective spec. Written by the `spec` property AND by a successful parse
   * of the `spec` attribute — last write wins, which is the only rule that stays
   * predictable when a host uses both.
   */
  #spec: DataFlowSpec | null = null;
  #highlight: Highlighter | undefined = undefined;
  #labels: Partial<PlayerLabels> | undefined = undefined;
  /**
   * Where a remount resumes from. Only the FIRST mount honours
   * `initial-t`/`auto-play`; every later one reopens at the instant and play
   * state the previous player was at, so changing an attribute while scrubbing is
   * invisible. Same contract as the React binding.
   */
  #resume: { t: number; playing: boolean } | null = null;
  #pending = false;

  // ─── Properties ───────────────────────────────────────────────────────────
  //
  // Attributes are the source of truth for everything serialisable: the getter
  // reads the attribute, the setter writes it. One state, no reflection loop, and
  // `document.querySelector('dataflow-player').theme` agrees with the markup.
  // `spec` and `highlight` cannot live in an attribute (an object, a function),
  // so those two are held in fields.
  //
  // A boolean getter returns `boolean | undefined`, and `undefined` means "not
  // specified — the core's default applies". It has to: `controls` defaults to
  // `true`, so absence cannot mean `false` here. A setter given `undefined`
  // REMOVES the attribute (back to the default) rather than writing "false".

  get spec(): DataFlowSpec | null {
    return this.#spec;
  }
  set spec(value: DataFlowSpec | null | undefined) {
    this.#spec = value ?? null;
    this.#schedule();
  }

  /**
   * Custom syntax highlighting, replacing Prism. Property only — a function
   * cannot be written in an attribute.
   */
  get highlight(): Highlighter | undefined {
    return this.#highlight;
  }
  set highlight(value: Highlighter | undefined) {
    this.#highlight = value;
    this.#schedule();
  }

  /**
   * Localises the chrome — any key left out keeps the core's English default.
   * Property only, like `highlight`: an object does not live in an attribute.
   */
  get labels(): Partial<PlayerLabels> | undefined {
    return this.#labels;
  }
  set labels(value: Partial<PlayerLabels> | undefined) {
    this.#labels = value;
    this.#schedule();
  }

  get theme(): PlayerTheme | undefined {
    return (this.getAttribute('theme') as PlayerTheme | null) ?? undefined;
  }
  set theme(value: PlayerTheme | undefined) {
    this.#writeString('theme', value);
  }

  get mode(): PlayerMode | undefined {
    return (this.getAttribute('mode') as PlayerMode | null) ?? undefined;
  }
  set mode(value: PlayerMode | undefined) {
    this.#writeString('mode', value);
  }

  get density(): Density | undefined {
    return (this.getAttribute('density') as Density | null) ?? undefined;
  }
  set density(value: Density | undefined) {
    this.#writeString('density', value);
  }

  get height(): number | string | undefined {
    return parseDimension(this.getAttribute('height'));
  }
  set height(value: number | string | undefined) {
    this.#writeString('height', value == null ? undefined : String(value));
  }

  get width(): number | string | undefined {
    return parseDimension(this.getAttribute('width'));
  }
  set width(value: number | string | undefined) {
    this.#writeString('width', value == null ? undefined : String(value));
  }

  /**
   * The core's `className` option — an extra class on the `.rdfa-player` root.
   *
   * THE one place the "camelCase option → kebab-case attribute" rule bends, and
   * it has to: `className` on an element already means the element's own class
   * list, so claiming it would break `el.className`. Hence `player-class` /
   * `playerClass` on both sides.
   */
  get playerClass(): string | undefined {
    return this.getAttribute('player-class') ?? undefined;
  }
  set playerClass(value: string | undefined) {
    this.#writeString('player-class', value);
  }

  get speed(): number | undefined {
    return parseNumber('speed', this.getAttribute('speed'));
  }
  set speed(value: number | undefined) {
    this.#writeString('speed', value == null ? undefined : String(value));
  }

  get initialT(): number | undefined {
    return parseNumber('initial-t', this.getAttribute('initial-t'));
  }
  set initialT(value: number | undefined) {
    this.#writeString('initial-t', value == null ? undefined : String(value));
  }

  get controls(): boolean | undefined {
    return parseBoolean('controls', this.getAttribute('controls'));
  }
  set controls(value: boolean | undefined) {
    this.#writeBoolean('controls', value);
  }

  get exportable(): boolean | undefined {
    return parseBoolean('exportable', this.getAttribute('exportable'));
  }
  set exportable(value: boolean | undefined) {
    this.#writeBoolean('exportable', value);
  }

  get autoPlay(): boolean | undefined {
    return parseBoolean('auto-play', this.getAttribute('auto-play'));
  }
  set autoPlay(value: boolean | undefined) {
    this.#writeBoolean('auto-play', value);
  }

  get loop(): boolean | undefined {
    return parseBoolean('loop', this.getAttribute('loop'));
  }
  set loop(value: boolean | undefined) {
    this.#writeBoolean('loop', value);
  }

  get debug(): boolean | undefined {
    return parseBoolean('debug', this.getAttribute('debug'));
  }
  set debug(value: boolean | undefined) {
    this.#writeBoolean('debug', value);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  connectedCallback(): void {
    // The same trick as the React binding's host `<div style={{display:
    // 'contents'}}>`: an unstyled custom element is `display: inline`, which
    // would break `height="100%"` and make the player a strange inline box. With
    // no box of its own, `.rdfa-player` inherits the containing block the tag was
    // given. Only applied when the author has set NO inline display, so
    // `style="display:block"` (or a `!important` rule) opts out.
    if (this.style.display === '') this.style.display = 'contents';
    this.#schedule();
  }

  disconnectedCallback(): void {
    // Synchronous: leaving a rAF loop and a ResizeObserver alive until a
    // microtask would leak them for as long as the element stays detached.
    this.#destroy();
  }

  attributeChangedCallback(
    name: string,
    previous: string | null,
    next: string | null
  ): void {
    if (previous === next) return;
    // An unreadable `spec` changed NOTHING effective, so it must not remount:
    // the previously mounted player stays exactly as it is.
    if (name === 'spec' && !this.#applySpecAttribute(next)) return;
    this.#schedule();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  #writeString(name: string, value: string | undefined): void {
    if (value === undefined) this.removeAttribute(name);
    else this.setAttribute(name, value);
  }

  #writeBoolean(name: string, value: boolean | undefined): void {
    // Never `removeAttribute` for `false`: removal means "the core's default",
    // and for `controls` that default is `true`.
    if (value === undefined) this.removeAttribute(name);
    else this.setAttribute(name, value ? 'true' : 'false');
  }

  /** @returns whether the effective spec changed (i.e. whether to remount). */
  #applySpecAttribute(raw: string | null): boolean {
    if (raw === null || raw.trim() === '') {
      this.#spec = null;
      return true;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      // `String(error)` rather than `error.message`: it needs no cast and no
      // `instanceof` guard, and a SyntaxError stringifies to
      // "SyntaxError: Unexpected token …" — the position included, which is the
      // part someone editing a JSON attribute actually wants.
      this.#reportSpecError(
        `invalid \`spec\` attribute: ${String(error)}`,
        error
      );
      return false;
    }
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      this.#reportSpecError(
        'invalid `spec` attribute: expected a JSON object.',
        new TypeError('spec is not a JSON object')
      );
      return false;
    }
    this.#spec = parsed as DataFlowSpec;
    return true;
  }

  /**
   * Loud, twice over: a message on the console for the person editing the HTML,
   * and an event for a host that wants to surface it. Failing silently on a typo
   * in a JSON attribute is the one outcome worth ruling out.
   */
  #reportSpecError(message: string, error: unknown): void {
    console.error(`${LOG} ${message}`);
    this.dispatchEvent(new CustomEvent(ERROR_EVENT, { detail: { error } }));
  }

  /**
   * One remount per microtask, however many attributes changed.
   *
   * Setting four attributes in a row is one statement per line for the caller and
   * four `attributeChangedCallback`s for us; remounting on each would remeasure
   * the stage four times and throw away three players. Deferring also makes the
   * `createElement` → `append` → `.spec = …` order work, since the spec simply
   * arrives before the flush.
   *
   * `#pending` is cleared FIRST in the flush, before the `isConnected` bail-out:
   * clearing it after would leave a never-connected element stuck pending, and
   * every later `#schedule()` would return early and never mount it.
   */
  #schedule(): void {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      if (!this.isConnected) return;
      this.#destroy();
      this.#mount();
    });
  }

  #mount(): void {
    const spec = this.#spec;
    if (!spec) return;

    const resume = this.#resume;
    const options: PlayerOptions = {
      ...readOptions(this),
      ...(this.#highlight ? { highlight: this.#highlight } : {}),
      ...(this.#labels ? { labels: this.#labels } : {}),
      // Only the first mount honours the attributes; afterwards the previous
      // player's instant and play state win.
      ...(resume ? { initialT: resume.t, autoPlay: resume.playing } : {}),
    };

    const handle = mountPlayer(this, spec, options);
    this.#handle = handle;

    if (options.debug && handle.warnings.length)
      console.warn(LOG, ...handle.warnings);

    // AFTER `#handle` is set and after `mountPlayer` appended `.rdfa-player`, so
    // a listener can read both. This is the only exact "the player exists now"
    // signal a caller has, since mounting is always deferred by a microtask —
    // and it is what the pixel gate keys its readiness on rather than a delay.
    this.dispatchEvent(
      new CustomEvent(MOUNTED_EVENT, { detail: { warnings: handle.warnings } })
    );
  }

  #destroy(): void {
    const handle = this.#handle;
    if (!handle) return;
    // Captured BEFORE destroy: the clock is released in there.
    this.#resume = { t: handle.clock.t, playing: handle.clock.playing };
    this.#handle = null;
    handle.destroy();
  }
}

/**
 * Has the class itself been handed to the registry yet?
 *
 * `customElements.define` throws when a CONSTRUCTOR is already registered, so the
 * second tag cannot reuse `DataFlowPlayerElement` — it gets a subclass. Without
 * this, the first `defineDataFlowPlayer('my-player')` after the barrel's
 * auto-definition would throw.
 */
let baseRegistered = false;

/**
 * Registers the element, idempotently. Called for you when you import this
 * package; call it yourself only to register an additional tag name.
 */
export function defineDataFlowPlayer(tagName: string = DEFAULT_TAG_NAME): void {
  // No registry — a server. Importing this package there is a no-op, by design.
  if (typeof customElements === 'undefined') return;

  const existing = customElements.get(tagName);
  if (existing) {
    // Ours (or a subclass of ours): nothing to do. Someone else's: say so, since
    // silently returning would leave `<dataflow-player>` rendering a stranger.
    const isOurs =
      existing === DataFlowPlayerElement ||
      existing.prototype instanceof DataFlowPlayerElement;
    if (!isOurs)
      console.warn(
        `${LOG} <${tagName}> is already defined by something else; skipping registration.`
      );
    return;
  }

  customElements.define(
    tagName,
    baseRegistered
      ? class extends DataFlowPlayerElement {}
      : DataFlowPlayerElement
  );
  baseRegistered = true;
}
