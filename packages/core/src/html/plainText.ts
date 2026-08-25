/**
 * The words of an HTML fragment, WITHOUT a DOM.
 *
 * Two callers need the text of a `type: 'html'` panel and neither of them may
 * touch `document`: the reading-time estimator runs in the compiler (pure, and
 * called during SSR), and the transcript describes actions for a reader who is
 * not looking at the stage. Parsing markup properly is `html/sanitize`'s job and
 * it needs a browser; this is the lossy, dependency-free counterpart, and it is
 * lossy on purpose — a character count and a spoken clause do not care that
 * `<b>` was nested inside `<p>`.
 *
 * It is NOT a security boundary. Nothing here is ever injected back into the
 * page: the result becomes a text node or a number. The sanitiser is what stands
 * between a spec and the DOM.
 */

/** The named entities worth decoding — the ones an author actually types. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Elements whose CONTENT is not prose. Dropping the tags alone would leave
 * their body behind — a stylesheet read out loud in the transcript, or a script
 * inflating the reading time of a two-word panel.
 */
const OPAQUE_CONTENT = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Tags that do NOT separate words. Everything else does.
 *
 * The distinction is not cosmetic: `Served from <b>Redis</b>.` has to come out
 * as one sentence, and turning every tag into a space detaches the full stop —
 * `Served from Redis .` — which a screen reader then pauses on. Conversely
 * `<li>a</li><li>b</li>` is two items and must not fuse into `ab`.
 */
const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'big',
  'cite',
  'code',
  'data',
  'del',
  'em',
  'font',
  'i',
  'ins',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'tspan',
  'u',
  'var',
  'wbr',
]);

/** Any tag, comment or declaration. */
const TAG = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9-]*)?[^>]*>/gi;

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      // Surrogates and out-of-range code points would throw; leave them literal.
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * The visible text of `markup`, with runs of whitespace collapsed to one space.
 *
 * A block-level tag becomes a SPACE rather than nothing: `a<br>b` is two words
 * to a reader, and joining them into `ab` would both misreport the length and
 * put a word that was never written into the transcript. An inline tag becomes
 * nothing, for the mirror-image reason — see {@link INLINE}.
 */
export function htmlToPlainText(markup: string): string {
  const stripped = markup
    .replace(OPAQUE_CONTENT, ' ')
    .replace(TAG, (_match, name?: string) =>
      name !== undefined && INLINE.has(name.toLowerCase()) ? '' : ' '
    );
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}
