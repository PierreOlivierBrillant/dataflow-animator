import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DataFlowPlayerProps } from './types';
// This package emits no stylesheet of its own: the CSS styles the CORE's
// renderer, not anything React draws, so it ships once with the core and the
// consumer imports `@dataflow-animator/core/styles.css`. A side-effect import
// here would re-emit the same bytes a second time.
import { mountPlayer, serializeSpec } from '@dataflow-animator/core';
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
 * Two consequences worth knowing:
 *
 *  - **No server markup.** The renderer needs a DOM, so the server emits only
 *    `fallback` (or an empty, correctly-sized box). There is no hydration
 *    mismatch because there is nothing to match.
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

    const resume = resumeRef.current;
    const player = mountPlayer(host, specRef.current, {
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
      style: toStyleMap(style),
      labels,
      highlight: highlightRef.current,
      initialT: resume?.t ?? initialT,
      autoPlay: resume?.playing ?? autoPlay,
    });
    setMounted(true);

    if (debug && player.warnings.length)
      console.warn('[DataFlowAnimator]', ...player.warnings);

    return () => {
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
          ) : null}
        </div>
      )}
      <div ref={hostRef} style={HOST_STYLE} />
    </>
  );
}
