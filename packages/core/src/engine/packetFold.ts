import type { Packet } from '../types';
import type { MoveClip } from './timeline';

/**
 * Whether a packet travels as its full card or FOLDED to one line.
 *
 * A packet does two jobs at once: it carries text to be read, and it shows a
 * trip from one node to another. They pull in opposite directions. Text is
 * read standing still, and a card big enough to read is too big to travel:
 * once it is wider than the gap it crosses, kept on stage, it barely moves —
 * an HTTP request with a JSON body, 512 px wide, crossed 160 px between two
 * nodes while covering half the stage. Nothing was shown moving, and the scene
 * behind it was hidden for the whole trip.
 *
 * So a card too big for its trip is read where it appears, at its origin, then
 * folds to a token — its first line — that makes the trip. The origin hold the
 * compiler gives a packet becomes the whole of its reading time
 * (`packetReadingTime`), since the card is no longer on screen after it.
 *
 * Decided by the compiler, in its reference frame (`motionTime.ts`), so the
 * chronology — which depends on it — is the same at every player size. The
 * card is estimated in COLUMNS and LINES of packet text rather than measured:
 * the two rulers below are not a rendered size, only the scale this decision
 * is taken at, exactly like `REFERENCE_WIDTH`.
 */

/** Width of one column of packet text in the reference frame. A ruler. */
const COLUMN_PX = 9;

/** Height of one line of packet text in the reference frame. A ruler. */
const LINE_PX = 18;

/** Columns past which a card wraps instead of growing: its `max-width`. */
const CARD_MAX_COLUMNS = 40;

/** Lines counted for a body that is not text (an image, a table). */
const NON_TEXT_LINES = 4;

/**
 * Share of its trip a card may span, along the trip, before it folds. At half,
 * a card still visibly crosses at least its own size; past it, the eye sees a
 * card that shifts, not one that travels.
 */
const FOLD_RATIO = 0.5;

/**
 * Fewest lines a card needs to fold. Folding is for a card that both barely
 * moves AND hides the scene: a one- or two-line card covers little, and still
 * reads as the thing that travels even when it crosses a short gap.
 */
const MIN_FOLD_LINES = 3;

/** Longest token label, in characters; a longer first line is cut with `…`. */
const TOKEN_MAX_CHARS = 32;

const firstLine = (text: string | undefined): string | undefined =>
  text
    ?.split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');

const lines = (text: string | undefined): string[] =>
  text ? text.split('\n') : [];

/**
 * The header an `sql_response` shows when it declares none. User-visible
 * strings ported verbatim from the React component the renderer replaced.
 */
export function sqlResponseHeader(packet: Packet): string {
  const content = packet.response_content;
  if (content?.header) return content.header;
  const rows = content?.rows;
  return rows != null ? `▦ ${rows} ligne${rows > 1 ? 's' : ''}` : '▦ résultat';
}

/**
 * What a folded packet shows while it travels: the first line of its header
 * (or of its body when it has no header), cut at {@link TOKEN_MAX_CHARS}.
 * `undefined` for a packet that has no line to show — a `subicon` is already
 * the size of a token, and never folds.
 */
export function packetTokenLabel(packet: Packet): string | undefined {
  let line: string | undefined;
  switch (packet.kind) {
    case 'http_packet': {
      const body = packet.packet_content?.body;
      line =
        firstLine(packet.packet_content?.header) ??
        (body?.type === 'image' ? undefined : firstLine(body?.value));
      break;
    }
    case 'sql_request':
      line = firstLine(packet.request_content ?? 'SQL');
      break;
    case 'sql_response':
      line = firstLine(sqlResponseHeader(packet));
      break;
    case 'simple_node':
    case 'complex_node':
      line = firstLine(packet.header) ?? firstLine(packet.body);
      break;
    default:
      line = undefined;
  }
  if (!line) return undefined;
  return line.length > TOKEN_MAX_CHARS
    ? `${line.slice(0, TOKEN_MAX_CHARS - 1).trimEnd()}…`
    : line;
}

/** The card's estimated extent, in columns and lines of packet text. */
export function packetCardSize(packet: Packet): {
  columns: number;
  lines: number;
} {
  const text: string[] = [];
  let extraLines = 0;
  switch (packet.kind) {
    case 'http_packet': {
      text.push(...lines(packet.packet_content?.header));
      const body = packet.packet_content?.body;
      if (body?.type === 'image') extraLines += NON_TEXT_LINES;
      else text.push(...lines(body?.value));
      break;
    }
    case 'sql_request':
      text.push(...lines(packet.request_content ?? 'SQL'));
      break;
    case 'sql_response': {
      text.push(sqlResponseHeader(packet));
      const body = packet.response_content?.body;
      if (body?.type === 'text') text.push(...lines(body.value));
      if (body?.type === 'table') {
        if (body.columns) text.push(body.columns.join(' | '));
        for (const row of body.rows_data ?? [])
          text.push(row.map(String).join(' | '));
      }
      break;
    }
    case 'simple_node':
    case 'complex_node':
      text.push(...lines(packet.header), ...lines(packet.body));
      break;
  }
  const widest = Math.max(0, ...text.map((line) => line.length));
  // A line longer than the card wraps: it adds rows, not columns.
  const rows = text.reduce(
    (n, line) => n + Math.max(1, Math.ceil(line.length / CARD_MAX_COLUMNS)),
    0
  );
  return {
    columns: Math.min(widest, CARD_MAX_COLUMNS),
    lines: rows + extraLines,
  };
}

/**
 * The token label a packet folds to on a trip of `dx` × `dy` (reference px), or
 * `undefined` when its card travels as it is: it spans less than half the trip
 * along the direction of travel, or it is too short to hide much of the scene
 * (fewer than {@link MIN_FOLD_LINES} lines).
 */
export function foldedLabel(
  packet: Packet,
  dx: number,
  dy: number
): string | undefined {
  const label = packetTokenLabel(packet);
  const distance = Math.hypot(dx, dy);
  if (!label || !(distance > 0)) return undefined;
  const size = packetCardSize(packet);
  if (size.lines < MIN_FOLD_LINES) return undefined;
  // The card's extent along the trip: its width on a horizontal hop, its
  // height on a vertical one, a blend of the two on a diagonal.
  const along =
    (Math.abs(dx) / distance) * size.columns * COLUMN_PX +
    (Math.abs(dy) / distance) * size.lines * LINE_PX;
  return along > FOLD_RATIO * distance ? label : undefined;
}

/** Longest the card takes to fold into its token as the trip starts. */
const FOLD_MS = 240;

/** Share of a short trip the fold may take, so the token is seen travelling. */
const FOLD_TRIP_SHARE = 0.35;

/**
 * How far a folded packet is into its fold at `t`: 0 while its card is shown
 * (the origin hold), 1 once only the token is left. The fold starts with the
 * trip, so the card is read standing still and the token is what moves. A
 * packet whose card an earlier leg already showed is folded from the start.
 */
export function foldAt(clip: MoveClip, t: number): number {
  if (!clip.folded?.opened) return 1;
  const span = Math.min(
    FOLD_MS,
    (clip.endMs - clip.animStartMs) * FOLD_TRIP_SHARE
  );
  if (span <= 0) return t < clip.animStartMs ? 0 : 1;
  return Math.min(1, Math.max(0, (t - clip.animStartMs) / span));
}

/** The instant a folded packet's card is gone — `foldAt` reaching 1. */
export function foldEndMs(clip: MoveClip): number {
  if (!clip.folded?.opened) return clip.startMs;
  return (
    clip.animStartMs +
    Math.min(FOLD_MS, (clip.endMs - clip.animStartMs) * FOLD_TRIP_SHARE)
  );
}
