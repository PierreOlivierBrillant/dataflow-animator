import type { Action, ObjectContent } from '../types';

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
  if (content.value) parts.push(content.value);
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
      ms = IMAGE_MS;
    } else {
      const length = contentLength(content);
      if (length === 0) return undefined;
      ms = ACQUIRE_MS + (length / CPS_BY_CONTENT[type]) * 1000;
    }
  }

  if (ms === undefined) return undefined;
  return Math.round(Math.min(Math.max(ms, MIN_MS), MAX_MS) * pace);
}
