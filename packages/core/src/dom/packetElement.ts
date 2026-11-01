import type { Highlighter, Packet } from '../types';
import { isPanelNode } from '../render/nodeKinds';
import { escapeHtml } from '../highlight/highlight';
import { confine } from '../engine/overlayPlacement';
import { h, px, setStyle, type Child } from './el';
import { buildPanel } from './nodeElement';
import { renderSubIcon } from './icons/subIcons';

/**
 * Moving packet markup — the port of `Packet.tsx`.
 *
 * Positioned absolutely at the current point of the path; the caller computes
 * that point from the SAME `connection()` + `pathTip()` the arrows use, so a
 * packet rides the drawn path exactly.
 *
 * Fidelity note: like the React component, the header and body of the
 * HTTP/SQL packet kinds are plain text (or highlighter markup) — `Packet.tsx`
 * never routes them through `richText`, so neither does this port. Running
 * them through `appendRichText` would render `$…$` spans as math where React
 * shows them literally, a real markup divergence the A/B gate would catch.
 */

export interface PacketElementOptions {
  /** Centre of the packet, in stage px. */
  x: number;
  y: number;
  /** Opacity (fade in/out). Default: 1. */
  opacity?: number;
  /** Scale (slight "pop" on appearance/disappearance). Default: 1. */
  scale?: number;
  highlight?: Highlighter;
}

/**
 * Where a packet sits at the current `t` — everything about it that moves.
 *
 * The split between this and the packet's CONTENT is the cleanest in the
 * renderer: the card (header, body, highlighted code, table) is a pure function
 * of the `Packet` spec object and never changes while the packet flies, so it is
 * built once by {@link createPacketElement} and only the pose is rewritten per
 * frame. A packet crossing the stage costs four style writes.
 */
export interface PacketPose {
  /** Centre of the packet, in stage px. */
  x: number;
  y: number;
  /** Opacity (fade in/out). Default: 1. */
  opacity?: number;
  /** Scale (slight "pop" on appearance/disappearance). Default: 1. */
  scale?: number;
  /**
   * Stage size (px). When given, the card is kept inside it: the path's point
   * is where the packet WANTS to be, and a card several times wider than a node
   * cannot sit centred on a node near the edge without half of it off-stage.
   */
  stage?: { width: number; height: number };
}

/** Highlighter-or-plain content zone shared by the HTTP and SQL kinds. */
function zone(
  className: string,
  text: string,
  highlighted: string | undefined
): HTMLElement {
  if (highlighted === undefined) return h('div', { class: className }, [text]);
  const el = h('div', { class: `${className} rdfa-code` });
  // The React side uses `dangerouslySetInnerHTML` here — the highlighter
  // returns markup by contract, so this is the literal equivalent.
  el.innerHTML = highlighted;
  return el;
}

/** Port of `HttpPacket`. */
function buildHttpPacket(object: Packet, highlight?: Highlighter): Child[] {
  const header = object.packet_content?.header;
  const body = object.packet_content?.body;
  const out: Child[] = [];
  if (header)
    out.push(
      zone(
        'rdfa-packet-header',
        header,
        highlight ? highlight(header, 'http') : undefined
      )
    );
  if (body) {
    let surface: HTMLElement;
    if (body.type === 'image') {
      surface = h('img', { src: body.value, alt: '' });
    } else if (body.language && highlight && body.value) {
      surface = zone(
        'rdfa-packet-surface',
        body.value,
        highlight(body.value, body.language)
      );
    } else {
      surface = h(
        'div',
        { class: 'rdfa-packet-surface' },
        body.value != null ? [body.value] : []
      );
    }
    out.push(h('div', { class: 'rdfa-packet-body' }, [surface]));
  }
  return out;
}

/** Port of `SqlRequestPacket`. */
function buildSqlRequestPacket(
  object: Packet,
  highlight?: Highlighter
): Child[] {
  const code = object.request_content ?? 'SQL';
  return [
    zone(
      'rdfa-packet-header',
      code,
      highlight ? highlight(code, 'sql') : undefined
    ),
  ];
}

/** Port of `SqlResponsePacket`. */
function buildSqlResponsePacket(object: Packet): Child[] {
  const content = object.response_content;
  const rowsLegacy = content?.rows;
  const header = content?.header;
  const body = content?.body;

  // User-visible fallback strings, ported verbatim from `Packet.tsx` — the A/B
  // gate diffs against what React actually renders.
  const defaultHeader =
    rowsLegacy != null
      ? `▦ ${rowsLegacy} ligne${rowsLegacy > 1 ? 's' : ''}`
      : '▦ résultat';
  const displayedHeader = header || defaultHeader;

  const out: Child[] = [
    h('div', { class: 'rdfa-packet-header' }, [displayedHeader]),
  ];
  if (body) {
    let surface: HTMLElement | undefined;
    if (body.type === 'text') {
      surface = h(
        'div',
        { class: 'rdfa-packet-surface' },
        body.value != null ? [body.value] : []
      );
    } else if (body.type === 'table') {
      const table = h('table', { class: 'rdfa-sql-table' });
      if (body.columns) {
        table.appendChild(
          h('thead', undefined, [
            h(
              'tr',
              undefined,
              body.columns.map((col) => h('th', undefined, [col]))
            ),
          ])
        );
      }
      if (body.rows_data) {
        table.appendChild(
          h(
            'tbody',
            undefined,
            body.rows_data.map((row) =>
              h(
                'tr',
                undefined,
                row.map((cell) => h('td', undefined, [String(cell)]))
              )
            )
          )
        );
      }
      surface = h(
        'div',
        { class: 'rdfa-packet-surface rdfa-sql-table-wrapper' },
        [table]
      );
    }
    if (surface) out.push(h('div', { class: 'rdfa-packet-body' }, [surface]));
  }
  return out;
}

/**
 * Port of `PanelPacket`: a text panel that travels. Reuses the static node's
 * `buildPanel` so the look and the content fields (`body`, `header`,
 * `language`) match exactly — no duplicated rendering. `object.kind` doubles
 * as the panel `type` (both literals belong to `NodeType` too).
 */
function buildPanelPacket(object: Packet, highlight?: Highlighter): Child[] {
  const type = object.kind === 'complex_node' ? 'complex_node' : 'simple_node';
  return [
    buildPanel(
      {
        type,
        header: object.header,
        body: object.body,
        language: object.language,
      },
      highlight ?? escapeHtml
    ),
  ];
}

/**
 * Port of `SubIconPacket`: the node's tech badge that travels. Reuses
 * `renderSubIcon` — the very resolver behind the node's corner badge — so a
 * known technology, a registered icon or a short free-text badge can fly via
 * `icon`, with no duplicated icon table.
 */
function buildSubIconPacket(object: Packet): Child[] {
  return [
    h('span', { class: 'rdfa-node-subicon' }, [
      renderSubIcon(object.icon ?? ''),
    ]),
  ];
}

/** Port of `packetRegistry`: the kinds the wrapper knows how to fill. */
const packetBuilders: Record<
  string,
  (object: Packet, highlight?: Highlighter) => Child[]
> = {
  http_packet: buildHttpPacket,
  sql_request: buildSqlRequestPacket,
  sql_response: buildSqlResponsePacket,
  simple_node: buildPanelPacket,
  complex_node: buildPanelPacket,
  subicon: buildSubIconPacket,
};

/**
 * Builds the `t`-independent card: the box and its filled content. Not
 * positioned — {@link applyPacketPose} does that.
 */
export function createPacketElement(
  object: Packet,
  highlight?: Highlighter
): HTMLElement {
  const build = packetBuilders[object.kind];
  // A panel-kind packet draws its own box (buildPanel) and a subicon packet is
  // a round badge; both replace the wrapper's default box via a modifier
  // (panel strips it, subicon makes it a circle). Other kinds keep the box.
  const modifier = isPanelNode(object.kind)
    ? ' rdfa-packet--panel'
    : object.kind === 'subicon'
      ? ' rdfa-packet--subicon'
      : '';

  return h(
    'div',
    { class: `rdfa-packet rdfa-packet-${object.kind}${modifier}` },
    build ? build(object, highlight) : []
  );
}

/**
 * Writes the current pose. The whole of a packet's per-frame cost.
 *
 * Confinement reads the card's LAYOUT size, which the pop `scale` does not
 * touch and which `.rdfa-packet`'s `width: max-content` keeps independent of
 * `left` — so the read is the same at every point of the flight.
 */
export function applyPacketPose(el: HTMLElement, pose: PacketPose): void {
  const { opacity = 1, scale = 1, stage } = pose;
  const x = stage ? confine(pose.x, el.offsetWidth, stage.width) : pose.x;
  const y = stage ? confine(pose.y, el.offsetHeight, stage.height) : pose.y;
  setStyle(el, {
    left: px(x),
    top: px(y),
    opacity: String(opacity),
    transform: `translate(-50%, -50%) scale(${scale})`,
  });
}

/** Convenience for the reconciler's create path: `create` then `apply`. */
export function buildPacketElement(
  object: Packet,
  options: PacketElementOptions
): HTMLElement {
  const el = createPacketElement(object, options.highlight);
  applyPacketPose(el, options);
  return el;
}
