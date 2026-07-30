import {
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  mountPlayer,
  serializeSpec,
  type DataFlowSpec,
  type Density,
  type Highlighter,
  type PlayerHandle,
  type PlayerMode,
  type PlayerTheme,
} from '@dataflow-animator/core';
import { toPlayerOptions } from './options';

/**
 * `<dfa-player>` — the core's player as a standalone Angular component, in LIGHT
 * DOM.
 *
 * The component adds no rendering of its own: its template is empty, it calls
 * `mountPlayer(hostElement, spec, options)`, and the host element itself IS the
 * container, so the core's global `.rdfa-*` stylesheet applies with nothing to
 * pierce. The consumer imports `@dataflow-animator/core/styles.css` once; this
 * package ships no CSS, because the engine and the stylesheet are delivered once,
 * by the core, for every binding.
 *
 * Two things here exist only because the host is Angular, and nothing else in the
 * repository can catch either of them:
 *
 *  - **The rAF loop must not run inside the Angular zone.** The core's clock
 *    schedules a frame for as long as the player is playing; inside the zone that
 *    would trigger change detection on every single frame. `runOutsideAngular`
 *    around the mount is enough for the whole loop, because zone.js captures the
 *    zone when a frame is SCHEDULED and the clock reschedules from inside its own
 *    tick — which by then already runs outside. `zone.spec.ts` proves it by
 *    recording the zone at schedule time, and that test fails if this call is
 *    removed.
 *  - **Angular SSR is ordinary**, so the mount is guarded by
 *    `isPlatformBrowser`. Nothing here touches the DOM on a server — the same
 *    contract as the React binding's client effect and the custom element's
 *    conditional base class.
 *
 * Selector: `dfa-player`, NOT `dataflow-player`. That tag is a real custom
 * element registered globally by `@dataflow-animator/element`, and a consumer may
 * legitimately have both packages installed; a component matching a tag the
 * `CustomElementRegistry` also owns would mount two players into one host.
 */

/** Log prefix. A constant, so renaming the selector does not move it. */
const LOG = '[dfa-player]';

/** `mounted` payload — the compile warnings for the spec that was just mounted. */
export interface DataFlowPlayerMountedEvent {
  warnings: readonly string[];
}

/** `error` payload — parity with the custom element's `dataflow-player:error`. */
export interface DataFlowPlayerErrorEvent {
  error: unknown;
}

@Component({
  selector: 'dfa-player',
  // Empty, and it has to be: the core owns every child of the host element, so
  // Angular must not create any of its own. No `styles` either — a `:host { … }`
  // rule would put CSS in the published package, which is exactly what "the
  // stylesheet ships once, from the core" exists to prevent.
  template: '',
})
export class DataFlowPlayerComponent {
  /** The specification to play. Required. */
  readonly spec = input.required<DataFlowSpec>();

  readonly theme = input<PlayerTheme>();
  readonly mode = input<PlayerMode>();
  readonly density = input<Density>();
  /** A number is taken as pixels. Default (the core's): 420. */
  readonly height = input<number | string>();
  /** A number is taken as pixels. Omitted, the player takes its container's width. */
  readonly width = input<number | string>();
  /** An extra class on the `.rdfa-player` root (the core's `className` option). */
  readonly playerClass = input<string>();
  readonly speed = input<number>();
  readonly initialT = input<number>();
  readonly controls = input<boolean>();
  readonly exportable = input<boolean>();
  readonly autoPlay = input<boolean>();
  readonly loop = input<boolean>();
  readonly debug = input<boolean>();
  /** Custom syntax highlighting, replacing Prism. */
  readonly highlight = input<Highlighter>();

  /** Emitted after every successful mount, remounts included. */
  readonly mounted = output<DataFlowPlayerMountedEvent>();
  /** Emitted when `mountPlayer` throws — reported, and no player is left behind. */
  readonly error = output<DataFlowPlayerErrorEvent>();

  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Where a remount resumes from. Only the FIRST mount honours
   * `initialT`/`autoPlay`; every later one reopens at the instant and play state
   * the previous player was at, so changing an input while scrubbing is
   * invisible. Same contract as the React binding and the custom element.
   */
  private resume: { t: number; playing: boolean } | null = null;

  /**
   * A STRUCTURAL key for the spec, not the object's identity.
   *
   * This is the one Angular-specific hazard of the remount model: a template
   * writes `[spec]="buildSpec()"`, which produces a fresh object on every change
   * detection pass. Depending on the object would remount forever. `serializeSpec`
   * is the core's own serialisation — the same one the export dialog and the React
   * binding's `specKey` use.
   */
  private readonly specKey = computed(() => serializeSpec(this.spec()));

  constructor() {
    // ONE effect for every option, which is what makes the remount coalesced:
    // however many inputs change in the same change detection pass, the effect
    // runs once, so the stage is measured once and no player is built to be
    // thrown away. `onCleanup` tears the previous one down — and it is the ONLY
    // teardown path, deliberately: effects are destroyed with the component, so an
    // `ngOnDestroy` doing the same thing would be a second path to the same
    // handle.
    effect((onCleanup) => {
      if (!this.isBrowser) return;

      // Tracked, and its value deliberately unused: this is what the effect
      // depends on for the spec. The object itself is read untracked below.
      this.specKey();

      const options = toPlayerOptions({
        theme: this.theme(),
        mode: this.mode(),
        density: this.density(),
        height: this.height(),
        width: this.width(),
        playerClass: this.playerClass(),
        speed: this.speed(),
        initialT: this.initialT(),
        controls: this.controls(),
        exportable: this.exportable(),
        autoPlay: this.autoPlay(),
        loop: this.loop(),
        debug: this.debug(),
        // Untracked for the same reason React reads it through a ref: an inline
        // `[highlight]="(c, l) => …"` is a new function on every pass, and since
        // any change remounts, the player would remount forever.
        highlight: untracked(() => this.highlight()),
      });

      const resume = this.resume;
      if (resume) {
        options.initialT = resume.t;
        options.autoPlay = resume.playing;
      }

      // The same rule as the custom element's, character for character: an
      // unstyled element is `display: inline`, which would break `height="100%"`
      // and make the player a strange inline box. With no box of its own,
      // `.rdfa-player` inherits the containing block the tag was given. Only
      // applied when the author set NO inline display, so `style="display:block"`
      // opts out.
      if (this.host.style.display === '') this.host.style.display = 'contents';

      const spec = untracked(() => this.spec());
      let handle: PlayerHandle;
      try {
        // THE Angular-specific line. See the class comment.
        handle = this.zone.runOutsideAngular(() =>
          mountPlayer(this.host, spec, options)
        );
      } catch (error) {
        // Loud twice over, as in the custom element: a console message for the
        // developer and an event for a host that wants to surface it. A spec the
        // compiler rejects must not fail silently.
        console.error(`${LOG} mountPlayer failed:`, error);
        this.error.emit({ error });
        return;
      }

      // Registered BEFORE emitting: a listener must never be able to observe a
      // mounted player that has no teardown attached yet.
      onCleanup(() => {
        // Captured BEFORE destroy: the clock is released in there.
        this.resume = { t: handle.clock.t, playing: handle.clock.playing };
        handle.destroy();
      });

      if (options.debug && handle.warnings.length)
        console.warn(LOG, ...handle.warnings);

      // `runOutsideAngular` restored the zone, so this emission happens INSIDE
      // it — a consumer's handler that writes a signal gets change detection,
      // which it would not if the mount had leaked its zone to here.
      this.mounted.emit({ warnings: handle.warnings });
    });
  }
}
