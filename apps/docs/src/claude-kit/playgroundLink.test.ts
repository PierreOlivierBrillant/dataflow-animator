import { describe, it, expect } from 'vitest';
import {
  decodeSpecToken,
  encodeSpecToken,
  readSpecToken,
} from './playgroundLink';
import {
  decodeSpec,
  encodeSpec,
  playgroundLink,
  PLAYGROUND_URL,
} from '../../claude-kit/scripts/playground-link.mjs';
import siteConfig from '../../docusaurus.config';
import { demos, getSpec } from '../site-content/demos';

/**
 * The `#spec=` format has two implementations: the playground decodes with the
 * browser's CompressionStream, the skill's script encodes with Node's zlib.
 * A link Claude hands out is only useful if the first reads what the second
 * wrote — so every test here crosses the two.
 */

const sample = JSON.stringify(getSpec(demos[0], 'fr'));

describe('#spec= links', () => {
  it('the skill encodes what the playground decodes, for every demo', async () => {
    for (const demo of demos) {
      const spec = getSpec(demo, 'fr');
      const decoded = await decodeSpecToken(encodeSpec(spec));
      expect(JSON.parse(decoded)).toEqual(spec);
    }
  });

  it('the playground encodes what the skill decodes', async () => {
    const token = await encodeSpecToken(sample);
    expect(decodeSpec(token)).toEqual(JSON.parse(sample));
  });

  it('round-trips non-ASCII text (accents, symbols, emoji)', async () => {
    const json = JSON.stringify({ text: 'Ω — é ⌘ 🎉' });
    expect(await decodeSpecToken(await encodeSpecToken(json))).toBe(json);
  });

  it('decodes a whole link, not only a bare token', () => {
    const link = playgroundLink(sample);
    expect(link.startsWith(`${PLAYGROUND_URL}#spec=`)).toBe(true);
    expect(decodeSpec(link)).toEqual(JSON.parse(sample));
  });

  it('reads the token from a location hash, and nothing else', () => {
    expect(readSpecToken('#spec=abc-_')).toBe('abc-_');
    expect(readSpecToken('#other=1&spec=xyz')).toBe('xyz');
    expect(readSpecToken('')).toBeNull();
    expect(readSpecToken('#section')).toBeNull();
  });

  it("points the skill at THIS site's playground", () => {
    // A renamed repository or a custom domain must not leave every installed
    // skill handing out links to a dead page.
    expect(PLAYGROUND_URL).toBe(
      `${siteConfig.url}${siteConfig.baseUrl}playground/`
    );
  });
});
