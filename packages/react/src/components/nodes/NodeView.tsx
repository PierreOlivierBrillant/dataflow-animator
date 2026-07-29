import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Highlighter, Node } from '../../types';
import { renderNodeVisual } from '@dataflow-animator/core';

export interface NodeViewProps {
  /** The node to represent. Only `type` — and, for panels,
   *  `header`/`body`/`language` — are read. */
  node: Node;
  /** Syntax highlighting of panels (when `language` is provided).
   *  Default: simple HTML escaping, sufficient for rendering without highlighting. */
  highlight?: Highlighter;
  /** Contact state (0..1) for stateful component icons (`switch`,
   *  `push_button`). Ignored by every other type. Undefined = from `node.closed`. */
  closed?: number;
  /** Live value shown in a `signal` I/O pad (from a `set_icon`); falls back to
   *  the node's static `icon`. Ignored by every other type. */
  signalValue?: string;
}

/** See `DataFlowPlayer`: the host's box is removed so the visual keeps the
 *  layout position it had when this component rendered the markup itself. */
const HOST_STYLE: CSSProperties = { display: 'contents' };

/**
 * Visual core of a node — pictogram or text panel — without positioning,
 * sub-icon, spinner or enclosing Stage. Sizes itself on `--rdfa-scale`
 * (fallback `1`), so it's renderable outside a `<DataFlowPlayer>`.
 *
 * Since v3 this mounts the core's `renderNodeVisual` in an effect rather than
 * rendering JSX, so a single dispatch decides panel/shape/signal/pictogram for
 * both this and the player. Like the player, it therefore emits nothing on the
 * server and fills in on hydration.
 */
export function NodeView({
  node,
  highlight,
  closed,
  signalValue,
}: NodeViewProps) {
  const hostRef = useRef<HTMLSpanElement>(null);

  // Structural key, for the same reason `DataFlowPlayer` keys on `specKey`:
  // callers build the node inline (the API reference's type gallery does), so
  // the object identity changes on every render while the node does not.
  const nodeKey = useMemo(() => JSON.stringify(node), [node]);
  const nodeRef = useRef(node);
  const highlightRef = useRef(highlight);

  // See `DataFlowPlayer`: synced in an effect, declared before the mount effect
  // so the latter reads this render's values.
  useEffect(() => {
    nodeRef.current = node;
    highlightRef.current = highlight;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = renderNodeVisual(nodeRef.current, {
      highlight: highlightRef.current,
      closed,
      signalValue,
    });
    host.appendChild(el);
    return () => el.remove();
    // `node` and `highlight` are read through refs; `nodeKey` stands in for the
    // node's structure.
  }, [nodeKey, closed, signalValue]);

  return <span ref={hostRef} style={HOST_STYLE} />;
}
