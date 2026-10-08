#!/usr/bin/env node
// Turns a spec into a link that opens it in the DataFlow Animator playground,
// and back.
//
// The link carries the spec in its FRAGMENT (`#spec=<token>`): the JSON,
// minified, raw-DEFLATE-compressed, base64url-encoded. A fragment never reaches
// the server, so the size of the spec costs nothing but the length of the link.
// The playground decodes the same format (src/claude-kit/playgroundLink.ts on
// the site); the two are tested against each other.
//
// Usage:
//   node scripts/playground-link.mjs spec.json             → prints the link
//   node scripts/playground-link.mjs spec.json --base URL  → another playground
//   node scripts/playground-link.mjs --decode <link|token> → prints the spec

import { readFileSync } from 'node:fs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PLAYGROUND_URL =
  'https://pierreolivierbrillant.github.io/dataflow-animator/playground/';

export function encodeSpec(spec) {
  // Minified: indentation is a third of a pretty-printed spec, and the
  // playground re-indents on load.
  const json = JSON.stringify(
    typeof spec === 'string' ? JSON.parse(spec) : spec
  );
  return deflateRawSync(Buffer.from(json, 'utf8'), { level: 9 }).toString(
    'base64url'
  );
}

export function decodeSpec(linkOrToken) {
  const hash = linkOrToken.includes('#') ? linkOrToken.split('#')[1] : null;
  const token = hash
    ? new URLSearchParams(hash).get('spec')
    : linkOrToken.trim();
  if (!token) throw new Error('no #spec= fragment in that link');
  return JSON.parse(
    inflateRawSync(Buffer.from(token, 'base64url')).toString('utf8')
  );
}

export function playgroundLink(spec, base = PLAYGROUND_URL) {
  return `${base}#spec=${encodeSpec(spec)}`;
}

function main(argv) {
  const args = argv.slice(2);
  const i = args.indexOf('--decode');
  if (i >= 0) {
    console.log(JSON.stringify(decodeSpec(args[i + 1] ?? ''), null, 2));
    return 0;
  }
  const b = args.indexOf('--base');
  const base = b >= 0 ? args.splice(b, 2)[1] : PLAYGROUND_URL;
  const file = args[0];
  if (!file) {
    console.error(
      'usage: node playground-link.mjs <spec.json | -> [--base URL]\n' +
        '       node playground-link.mjs --decode <link | token>'
    );
    return 2;
  }
  console.log(
    playgroundLink(readFileSync(file === '-' ? 0 : file, 'utf8'), base)
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv);
}
