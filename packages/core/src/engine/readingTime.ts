import { htmlToPlainText } from '../html/plainText';
import type { Action, ObjectContent, Packet } from '../types';
import { contentCycleMs } from './contentFrames';

/**
 * How long an action needs to stay on screen for its content to be READ,
 * derived from that content rather than configured.
 *
 * The problem this solves is not that text disappears too early — a comment
 * bubble has `keep_until_next: true` and lingers. It is that the animation
 * ADVANCES while the reader is still reading, because `duration` was a number
 * someone guessed. Across the 45 site demos those guesses correlate well with
 * text length (r = 0.85) but scatter from 5 to 120 characters per second, and
 * 26 of the 44 `wait` actions exist only to lengthen a comment that was too
 * short. Both are symptoms of a reading time nobody could express.
 *
 * The estimate is deliberately crude and LOCAL: it looks at one action's own
 * content and nothing else. A duration that depended on what happens beside it
 * would be impossible for an author to predict from reading their own spec.
 */

/**
 * Characters a reader gets through per second, for the short technical prose a
 * comment bubble carries. ~290 words/min: between this project's current median
 * (27.5 c/s, a little brisk) and the ~240 w/min usually quoted as comfortable.
 * Raising it shortens every derived duration proportionally.
 */
const PROSE_CPS = 24;

/**
 * Code is read slower than prose — no predictable word shapes, and the reader
 * parses structure as much as characters. A table sits in between: short cells,
 * but each one is looked up rather than read in a flow.
 */
const CPS_BY_CONTENT: Record<NonNullable<ObjectContent['type']>, number> = {
  text: PROSE_CPS,
  code: 14,
  table: 18,
  // Rich markup is prose that has been laid out — headings, a list, a figure.
  // The reader takes it in at prose speed; the tags are not read at all, which
  // is why `contentLength` strips them before counting.
  html: PROSE_CPS,
  // Never used: an image has no characters, so it takes IMAGE_MS below.
  image: PROSE_CPS,
};

/** Time to notice what appeared and start reading it. Independent of length. */
const ACQUIRE_MS = 400;

/** An image is looked at, not read: a flat beat, since length says nothing. */
const IMAGE_MS = 1500;

/**
 * Floor and ceiling. The floor keeps a two-word label from flashing past; the
 * ceiling stops a long paragraph from holding the animation hostage — past this
 * point the text is too long for a bubble, and no duration fixes that.
 */
const MIN_MS = 700;
const MAX_MS = 7000;

/** Characters a reader has to get through in this panel. */
function contentLength(content: ObjectContent): number {
  const parts: string[] = [];
  if (content.value)
    parts.push(
      // Markup is not read: `<b>x</b>` is one character on screen and eight
      // to `String.length`. Counting it would hand a two-word panel the
      // reading time of a paragraph.
      content.type === 'html' ? htmlToPlainText(content.value) : content.value
    );
  if (content.columns) parts.push(...content.columns);
  if (content.rows_data) {
    for (const row of content.rows_data) parts.push(...row.map(String));
  }
  return parts.reduce((total, part) => total + part.length, 0);
}

/**
 * The reading time for `action`, or `undefined` when the action carries nothing
 * to read — the caller then falls back to the per-type default.
 *
 * `pace` scales the RESULT, after the bounds are applied: an author who asks for
 * more time gets it even on an action already sitting at the ceiling, which
 * would not be true if the factor went in before the clamp.
 */
export function derivedDuration(
  action: Action,
  pace: number
): number | undefined {
  let ms: number | undefined;

  if (action.type === 'comment') {
    const text = action.text?.trim() ?? '';
    if (text === '') return undefined;
    ms = ACQUIRE_MS + (text.length / PROSE_CPS) * 1000;
  } else if (action.type === 'set_content') {
    const content = action.content;
    if (!content) return undefined;
    const type = content.type ?? 'text';
    if (type === 'image') {
      // A sequence gets the time it needs to PLAY: cutting an animation off
      // halfway is a different failure from cutting prose off halfway, and the
      // author who wrote the frames already said how long it lasts. A still
      // has nothing to say, so it keeps the flat beat.
      const cycleMs = contentCycleMs(content);
      ms = cycleMs === undefined ? IMAGE_MS : ACQUIRE_MS + cycleMs;
    } else {
      const length = contentLength(content);
      if (length === 0) return undefined;
      ms = ACQUIRE_MS + (length / CPS_BY_CONTENT[type]) * 1000;
    }
  }

  if (ms === undefined) return undefined;
  return Math.round(Math.min(Math.max(ms, MIN_MS), MAX_MS) * pace);
}

/**
 * ── What a packet asks to be read ────────────────────────────────────────
 *
 * A packet is not a dot: it carries a header, a query, a row count — text the
 * reader is meant to take in. It appears at its origin, waits, then travels,
 * and that wait was a fraction of the trip (120 ms for a 600 ms hop), which is
 * not enough to read `SELECT * FROM users WHERE email=…` before it moves off.
 *
 * So the origin hold is at least the time the packet's own content needs. The
 * caller pays this on a packet's FIRST appearance only: a packet hopping on to
 * its next node has not changed, and charging the reader twice for the same
 * text would only pad the animation.
 */

/** Characters carried by a packet, across every field its kind may use. */
function packetLength(packet: Packet): { length: number; code: boolean } {
  const parts: string[] = [];
  let code = false;

  if (packet.request_content) {
    parts.push(packet.request_content);
    code = true;
  }
  if (packet.packet_content) {
    if (packet.packet_content.header) parts.push(packet.packet_content.header);
    const body = packet.packet_content.body;
    if (body?.type !== 'image' && body?.value) parts.push(body.value);
    if (body?.language) code = true;
  }
  if (packet.response_content) {
    const response = packet.response_content;
    if (response.header) parts.push(response.header);
    if (response.rows !== undefined) parts.push(String(response.rows));
    const body = response.body;
    if (body?.value) parts.push(body.value);
    if (body?.columns) parts.push(...body.columns);
    if (body?.rows_data) {
      for (const row of body.rows_data) parts.push(...row.map(String));
    }
  }
  if (packet.header) parts.push(packet.header);
  if (packet.body) parts.push(packet.body);
  // `icon` is a badge, not prose — it is recognised, not read.

  if (packet.language) code = true;
  return {
    length: parts.reduce((total, part) => total + part.length, 0),
    code,
  };
}

/**
 * Longest a packet's appearance may be held for its content to be read.
 * Deliberately tighter than a comment's ceiling: a packet stays legible while
 * it travels, so the hold only has to cover the first pass.
 */
const PACKET_MAX_MS = 1600;

/**
 * Noticing a packet costs less than noticing a bubble: it appears on the node
 * the reader is already watching, where one is expected.
 */
const PACKET_ACQUIRE_MS = 220;

/**
 * Time the packet's own content needs, or `undefined` when it carries none.
 *
 * No floor here, unlike a comment's: the caller takes the greater of this and
 * the proportional origin hold, so the hold IS the floor. Giving `{ rows: 1 }`
 * the 700 ms a two-word label needs would pad every acknowledgement in a route.
 */
export function packetReadingTime(
  packet: Packet,
  pace: number
): number | undefined {
  const { length, code } = packetLength(packet);
  if (length === 0) return undefined;
  const cps = code ? CPS_BY_CONTENT.code : PROSE_CPS;
  const ms = PACKET_ACQUIRE_MS + (length / cps) * 1000;
  return Math.round(Math.min(ms, PACKET_MAX_MS) * pace);
}
