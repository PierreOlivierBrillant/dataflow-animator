#!/usr/bin/env node
/**
 * Deletes chunks in `dist/` that nothing reaches from `index.js`.
 *
 * WHY THIS EXISTS. `export/video/encoders.ts` loads its three muxers through
 * `import()`, and `vite.config.ts` marks them external so the published bundle
 * carries `import("webm-muxer")` rather than a copy of it. That part works — but
 * rolldown still EMITS the split chunks it had already planned before the
 * specifier was externalised, plus the shared runtime they need. The result is
 * ~85 kB of `webm-muxer-*.js`, `mp4-muxer-*.js`, `gifenc-*.js` and
 * `rolldown-runtime-*.js` that `index.js` never mentions and that no consumer
 * can ever execute — dead weight `files: ["dist"]` would publish.
 *
 * Reachability is computed rather than matched by name: the filenames are
 * content-hashed, so a deny-list would rot the first time a muxer version
 * changes. Anything genuinely imported stays, whatever it is called — so if the
 * package ever gains a real code-split chunk, this keeps it.
 */
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const ENTRY = 'index.js';

/** Relative specifiers of a module: `from "./x"`, `import("./x")`. */
function relativeImports(source) {
  const found = new Set();
  for (const match of source.matchAll(/["']\.\/([^"']+\.js)["']/g)) {
    found.add(match[1]);
  }
  return found;
}

const present = readdirSync(DIST).filter((name) => name.endsWith('.js'));

// Breadth-first walk from the entry.
const reachable = new Set([ENTRY]);
const queue = [ENTRY];
while (queue.length > 0) {
  const name = queue.shift();
  let source;
  try {
    source = readFileSync(join(DIST, name), 'utf8');
  } catch {
    continue;
  }
  for (const dependency of relativeImports(source)) {
    if (reachable.has(dependency)) continue;
    reachable.add(dependency);
    queue.push(dependency);
  }
}

const orphans = present.filter((name) => !reachable.has(name));
for (const orphan of orphans) {
  rmSync(join(DIST, orphan), { force: true });
  rmSync(join(DIST, `${orphan}.map`), { force: true });
}

if (orphans.length > 0) {
  console.log(
    `[prune-orphan-chunks] removed ${orphans.length} unreachable chunk(s): ${orphans.join(', ')}`
  );
}
