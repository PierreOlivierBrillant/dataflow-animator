/**
 * The playground's shareable-spec fragment: `#spec=<token>`, where the token is
 * the spec's JSON, deflated (raw DEFLATE) and base64url-encoded.
 *
 * A FRAGMENT, not a query parameter: it never reaches the server, so a spec of
 * any size costs no request-line limit and is not written to any access log.
 * Deflate brings a typical spec from ~5 KB to ~1.5 KB, which keeps the link
 * pasteable in a chat message.
 *
 * The skill's `scripts/playground-link.mjs` encodes the same format with Node's
 * zlib, so Claude can hand out a link that opens its spec here. The two
 * implementations are tested against each other.
 */

export const SPEC_FRAGMENT_KEY = 'spec';

function toBase64Url(bytes: Uint8Array): string {
  // One char at a time: `fromCharCode(...bytes)` overflows the stack on a
  // large spec, and the site's babel (loose mode) rewrites spreads anyway.
  let binary = '';
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(token: string): Uint8Array {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeSpecToken(json: string): Promise<string> {
  const deflated = await pipe(
    new TextEncoder().encode(json),
    new CompressionStream('deflate-raw')
  );
  return toBase64Url(deflated);
}

export async function decodeSpecToken(token: string): Promise<string> {
  const inflated = await pipe(
    fromBase64Url(token),
    new DecompressionStream('deflate-raw')
  );
  return new TextDecoder().decode(inflated);
}

/** The token carried by a location hash (`#spec=…`), or null. */
export function readSpecToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(SPEC_FRAGMENT_KEY);
}
