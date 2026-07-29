import type { CSSProperties, ReactNode } from 'react';
import type {
  DataFlowSpec,
  PlayerTheme,
  PlayerMode,
  Highlighter,
} from '@dataflow-animator/core/types';

// The framework-agnostic spec types now live in @dataflow-animator/core.
// Re-export them here so the package's public API (via ./index.ts) and every
// internal `./types` import keep resolving unchanged; only the React-facing
// props type, which depends on React, is defined in this package.
export type * from '@dataflow-animator/core/types';

export interface DataFlowPlayerProps {
  /** The specification to animate. */
  spec: DataFlowSpec;
  /** Additional CSS class on the root container. */
  className?: string;
  /** Inline styles on the root container. */
  style?: CSSProperties;
  /** Scene height (e.g., 420, '60vh'). Default: 420. */
  height?: number | string;
  /**
   * Scene width (e.g., 480, '100%'). Omitted, the player takes its width from
   * its container.
   *
   * It exists because the stage MEASURES while mounting — including the one-shot
   * capture of a `set_content` node's pre-panel geometry — so sizing has to be
   * known before the first measurement, not applied after it.
   */
  width?: number | string;
  /**
   * Instant the player opens at, in ms. Default: 0.
   *
   * Uncontrolled: it seeds the clock when the player mounts and is not read
   * again. Opening AT `t` is not the same rendering as opening at 0 and seeking
   * to `t` — the icon→panel morph is anchored to the state actually measured
   * first — which is why this is a mount-time option rather than a seek.
   */
  initialT?: number;
  /** Starts playback automatically. Default: false. */
  autoPlay?: boolean;
  /** Replays in a loop at the end. Default: false. */
  loop?: boolean;
  /** Displays navigation controls. Default: true. */
  controls?: boolean;
  /**
   * Adds a button in the controls bar that opens the JSON specification
   * (colored) in a window, with copy to clipboard and
   * download as a `.json` file. No effect if `controls` is false.
   * Default: false.
   */
  exportable?: boolean;
  /** Visual palette; each one has a light and a dark variant. Default: 'default'. */
  theme?: PlayerTheme;
  /**
   * Which variant of `theme` to display. `'auto'` follows the host site when an
   * ancestor carries `data-theme="light|dark"` (the Docusaurus convention), and
   * the OS preference otherwise. Default: 'auto'.
   */
  mode?: PlayerMode;
  /**
   * Visual density: adjusts the size of elements relative to the available
   * space. 'compact' = smaller/airier, 'spacious' = larger.
   * Default: 'comfortable'.
   */
  density?: 'compact' | 'comfortable' | 'spacious';
  /** Displays the timeline debug overlay. Default: false. */
  debug?: boolean;
  /** Playback speed (1 = normal). Default: 1. */
  speed?: number;
  /**
   * Custom syntax highlighting (replaces Prism).
   *
   * Read when the player mounts, and not watched afterwards: an inline arrow
   * function would otherwise be a new value on every render, and since every
   * option change remounts the player, that would remount it forever. Change it
   * together with `spec` for it to take effect.
   */
  highlight?: Highlighter;
  /**
   * Rendered on the server and until the player has mounted.
   *
   * The player renders no markup on the server: it mounts a framework-agnostic
   * DOM renderer in a client effect. There is no hydration mismatch — there is
   * nothing to match — but the static HTML holds only this placeholder, so use
   * it for a poster, a caption or a skeleton.
   */
  fallback?: ReactNode;
}
