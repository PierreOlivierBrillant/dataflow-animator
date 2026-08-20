import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { DataFlowPlayerProps } from './types';
// This package emits no stylesheet of its own: the CSS styles the CORE's
// renderer, not anything React draws, so it ships once with the core and the
// consumer imports `@dataflow-animator/core/styles.css`. A side-effect import
// here would re-emit the same bytes a second time.
import {
  DEFAULT_PLAYER_LABELS,
  mountPlayer,
  serializeSpec,
  type PlayerHandle,
} from '@dataflow-animator/core';
import { toStyleMap } from './utils/styleMap';

/**
 * Main player: compiles a `spec` into a deterministic timeline and plays it.
 *
 * This component is a MOUNT, not a renderer. It creates the
 * framework-agnostic DOM renderer from `@dataflow-animator/core` in an
 * effect and tears it down on unmount; React never manages the player's
 * children. That is what makes a frame ~6x cheaper: a clock tick mutates the
 * DOM in place instead of re-rendering a tree.
 *
 * Three consequences worth knowing:
 *
 *  - **No server markup.** The renderer needs a DOM, so the server emits only
 *    the placeholder — `fallback`, or a correctly-sized box carrying the
 *    loading indicator. There is no hydration mismatch because there is nothing
 *    to match.
 *  - **The first mount waits for a paint.** Two frames, so the placeholder is
 *    actually on screen before the spec is compiled and measured. The swap back
 *    is then committed synchronously, so no frame ever holds both boxes. A
 *    remount does not wait at all: the old player is still there, and swapping
 *    it for an empty box would be a blink.
 *  - **Every option is read once, at mount.** The core reads its options when it
 *    builds; changing any of them — `spec` included — remounts the player. The
 *    current instant and play state are carried across, so this is invisible
 *    while scrubbing or editing a spec.
 */

/**
 * `display: contents` removes the host's own box, so `.rdfa-player` inherits the
 * containing block the component itself was given — which is what `height="100%"`
 * needs, and what keeps the player a flex item of the same parent as before.
 */
const HOST_STYLE: CSSProperties = { display: 'contents' };

export function DataFlowPlayer({
  spec,
  className,
  style,
  height = 420,
  width,
  initialT = 0,
  autoPlay = false,
  loop = false,
  controls = true,
  exportable = false,
  theme = 'default',
  mode = 'auto',
  density = 'comfortable',
  debug = false,
  transcript = 'sr-only',
  speed = 1,
  highlight,
  labels,
  fallback,
}: DataFlowPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Read at mount only — see the prop docs. Held in refs so they can be current
  // without being dependencies.
  const specRef = useRef(spec);
  const highlightRef = useRef(highlight);

  // Synced in an effect rather than during render (writing a ref while
  // rendering is not safe under concurrent rendering). Declared BEFORE the
  // mount effect on purpose: effects run in declaration order, so by the time
  // the mount effect reads these refs they already hold this render's values.
  useEffect(() => {
    specRef.current = spec;
    highlightRef.current = highlight;
  });

  // Where a remount resumes from. Only the FIRST mount honours
  // `initialT`/`autoPlay`.
  const resumeRef = useRef<{ t: number; playing: boolean } | null>(null);

  /**
   * A STRUCTURAL key, not the object's identity.
   *
   * Callers routinely build the spec inline (`getSpec(demo, locale)` rebuilds it
   * on every render; a live editor reparses JSON on every keystroke), so keying
   * the effect on `spec` itself would tear the player down and remeasure on
   * every render of the enclosing page. `serializeSpec` is the same
   * serialisation the export dialog uses.
   */
  const specKey = useMemo(() => serializeSpec(spec), [spec]);
  const styleKey = useMemo(() => (style ? JSON.stringify(style) : ''), [style]);
  const labelsKey = useMemo(
    () => (labels ? JSON.stringify(labels) : ''),
    [labels]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let player: PlayerHandle | undefined;
    let frame = 0;

    const mount = (revealSync: boolean): void => {
      const resume = resumeRef.current;
      player = mountPlayer(host, specRef.current, {
        height,
        width,
        className,
        theme,
        mode,
        density,
        controls,
        exportable,
        loop,
        speed,
        debug,
        transcript,
        style: toStyleMap(style),
        labels,
        highlight: highlightRef.current,
        initialT: resume?.t ?? initialT,
        autoPlay: resume?.playing ?? autoPlay,
      });

      /**
       * The swap has to be ATOMIC, and only `flushSync` makes it so.
       *
       * The placeholder is React's and the player is the core's, so the two
       * halves of one visual swap have different clocks: `mountPlayer` inserted
       * the real player synchronously, while a plain `setMounted` is committed
       * in a task that runs AFTER this frame paints. That frame paints both
       * boxes — in the same flow, one under the other — so the host doubles in
       * height for a frame and everything around it jumps. In the docs gallery
       * the modal is centred, so the whole dialog visibly leaps; a mount slow
       * enough to reveal the loading indicator (250ms, see `.rdfa-loading`)
       * shows it stacked against the player it was supposed to replace.
       *
       * Only the FIRST mount needs it. A remount already has `mounted` true, so
       * this would be a no-op update — and `flushSync` from inside an effect,
       * which is where a remount calls `mount`, is what React warns about.
       */
      if (revealSync) flushSync(() => setMounted(true));
      else setMounted(true);

      if (debug && player.warnings.length)
        console.warn('[DataFlowAnimator]', ...player.warnings);
    };

    /**
     * The FIRST mount waits for the browser to paint; a remount does not.
     *
     * Two nested frames is the only reliable "the placeholder is on screen"
     * signal — a single `requestAnimationFrame` still runs before that frame's
     * paint. Without the wait, the placeholder is committed and replaced inside
     * one task, so it is never painted: the loading indicator could then only
     * ever cover the gap between prerendered HTML and hydration, which a
     * client-only mount (a gallery thumbnail, a modal, an editor) does not
     * have. Compiling and measuring a heavy spec would freeze the page on a
     * blank box — the wait most worth naming, and the one that was invisible.
     *
     * The two frames cost ~32ms and show nothing: the reveal is delayed far
     * past them. Once the mount starts it stays synchronous, so the
     * placeholder's last painted frame is what the reader looks at while the
     * main thread is busy — and it keeps fading in and spinning, both being
     * compositor-driven properties.
     *
     * A REMOUNT (a changed option, a live-edited spec) keeps the old player on
     * screen right up to the cleanup, so waiting would swap a rendered player
     * for two frames of empty box. `resumeRef` is the flag: it is null exactly
     * until this component has mounted a player once.
     */
    if (resumeRef.current !== null) mount(false);
    else
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => mount(true));
      });

    return () => {
      cancelAnimationFrame(frame);
      if (!player) return;
      // Captured BEFORE destroy: the clock is released in there.
      resumeRef.current = {
        t: player.clock.t,
        playing: player.clock.playing,
      };
      player.destroy();
    };
    // `highlight` and `spec` are intentionally absent: they are read through
    // refs, keyed by `specKey`. An inline `highlight={(c, l) => …}` would
    // otherwise be a new value on every render, and since every option change
    // remounts, the player would remount forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    specKey,
    styleKey,
    labelsKey,
    height,
    width,
    initialT,
    autoPlay,
    loop,
    controls,
    exportable,
    theme,
    mode,
    density,
    speed,
    className,
    debug,
    transcript,
  ]);

  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const widthValue = typeof width === 'number' ? `${width}px` : width;

  return (
    <>
      {/*
        The placeholder is a SIBLING of the host, never its child: React owns
        this subtree and the core owns the host's, so the two renderers never
        contend for the same child list. It is rendered whether or not there is
        a `fallback` content, because it also reserves the player's box — without
        it the page would reflow when the real player appears.
      */}
      {mounted ? null : (
        <div
          className={`rdfa-player${className ? ` ${className}` : ''}`}
          // It wears `.rdfa-player` to reserve the box and inherit the theme
          // tokens, so this attribute is what tells the two apart while both
          // are in the document — which, now that the mount waits for a paint,
          // is a window a test or a consumer can actually land in.
          data-placeholder=""
          data-theme={theme}
          data-mode={mode}
          style={{
            height: heightValue,
            ...(widthValue != null ? { width: widthValue } : {}),
            ...style,
          }}
        >
          {fallback ? (
            <div className="rdfa-stage rdfa-fallback">{fallback}</div>
          ) : (
            /*
              The loading indicator, which is what an EMPTY box says out loud:
              the bundle arriving, the page hydrating, and — since the mount
              waits for a paint — compiling and measuring the spec itself.

              It is in the markup from the first paint and hides itself in CSS
              until the wait is long enough to be worth naming (see
              `.rdfa-loading`), so a fast mount shows nothing at all and no
              timer, state or extra render is needed here. A caller who passes
              `fallback` has said what to show instead, and keeps it.

              No `.rdfa-stage` here, unlike the fallback: `.rdfa-loading` brings
              its own box, and leaving that class off keeps `.rdfa-stage`
              meaning "a mounted stage" for anything that waits on it.
            */
            <div className="rdfa-loading" role="status">
              <span className="rdfa-loading-ring" aria-hidden="true" />
              <span>{labels?.loading ?? DEFAULT_PLAYER_LABELS.loading}</span>
            </div>
          )}
        </div>
      )}
      <div ref={hostRef} style={HOST_STYLE} />
    </>
  );
}
