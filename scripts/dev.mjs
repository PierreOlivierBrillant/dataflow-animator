// Dev orchestration for the monorepo: the two library watchers first, the
// Docusaurus site once they have written their first bundle.
//
// The ordering is the whole point. `vite build --watch` rebuilds the moment it
// starts — right after `build:lib`, and even though it writes back
// byte-identical output. Rollup writes `dist/index.js` IN PLACE: the file is
// truncated to zero, then filled again (observed on the core: 291522 → 0 →
// 262144 → 291522 bytes, all inside the same millisecond). Docusaurus' webpack
// reads those exact files as it walks the module graph, and a read that lands
// inside that window sees a module that exports nothing.
//
// The React binding re-exports most of its surface FROM the core, so the whole
// re-exported half vanishes at once and webpack reports, for every consumer:
//
//   export 'dataFlowSchema' (imported as 'dataFlowSchema') was not found in
//   '@dataflow-animator/react' (possible exports: DataFlowPlayer, NodeView)
//
// `DataFlowPlayer` and `NodeView` being precisely the two exports the binding
// declares itself. Nothing is actually broken — the next compile is clean, and
// the page works — which is exactly what makes the warning misleading.
//
// Waiting for the first bundle removes the overlap instead of hiding it: the
// watcher reports `END` once its files are on disk, so the barrier holds on a
// slow machine just as it does on a fast one. A `sleep` would not.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const selfPath = fileURLToPath(import.meta.url);
const repoRoot = path.dirname(path.dirname(selfPath));

// This file runs in two modes. The child mode is one watcher, re-invoked with
// the package directory as its CWD — Vite derives `root` from the CWD, and root
// is what the `//#region src/…` comments and the sourcemap `sources` are
// relative to. Driving Vite from the repo root instead would emit a bundle that
// differs from the published one, which is exactly what the dev loop must not
// do. The other half of that fidelity is the `--watch` flag below: it is a real
// argv entry because `packages/react/vite.config.ts` reads it from there.
const isWatcher = process.argv.includes('--watch-lib');

/** Everything the parent has spawned, so a single exit path can clean up. */
const children = [];

if (isWatcher) {
  await runWatcher();
} else {
  await orchestrate();
}

/** Child mode: one package's Vite watcher, signalling its first bundle over IPC. */
async function runWatcher() {
  const { build } = await import('vite');
  // `build.watch` is set inline because only the React config derives it from
  // the flag; the core's has no watch section at all. Vite deep-merges it, so
  // the `watch.include` narrowing the React config applies survives.
  const watcher = await build({ build: { watch: {} } });
  if (!watcher || typeof watcher.on !== 'function') {
    throw new Error(
      'vite returned a finished build instead of a watcher — `build.watch` no ' +
        'longer survives the config merge.'
    );
  }
  const onEvent = (event) => {
    if (event.code !== 'END' && event.code !== 'ERROR') return;
    // Only the FIRST build is a barrier; later ones are the watcher doing its
    // job, and Vite's logger already reports them.
    watcher.off('event', onEvent);
    if (event.code === 'ERROR') process.exit(1);
    process.send?.({ ready: true });
  };
  watcher.on('event', onEvent);
}

/** Parent mode: both watchers, then the site. */
async function orchestrate() {
  // Ctrl-C reaches the whole process group on its own, but an exiting site — a
  // busy port is the everyday case — would otherwise leave watchers behind.
  process.on('exit', () => {
    for (const child of children) child.kill('SIGTERM');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => process.exit(0));
  }

  // The element and the Angular package are absent on purpose: the site does not
  // consume them, so there would be nothing for a watcher to refresh.
  await Promise.all(['core', 'react'].map((pkg) => startWatcher(pkg)));

  const site = spawn('npm', ['run', 'dev', '-w', '@dataflow-animator/docs'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  children.push(site);
  site.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
}

/** Spawns one watcher; resolves on the `ready` message, i.e. its first bundle. */
function startWatcher(pkg) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [selfPath, '--watch-lib', '--watch'],
      {
        cwd: path.join(repoRoot, 'packages', pkg),
        stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
      }
    );
    children.push(child);
    let ready = false;
    prefixOutput(child, pkg);
    child.on('message', (message) => {
      if (!message?.ready) return;
      ready = true;
      resolve(child);
    });
    child.on('exit', (code) => {
      if (!ready) {
        reject(
          new Error(`the ${pkg} watcher exited (code ${code}) before building`)
        );
        return;
      }
      // A watcher that dies later stops refreshing the site's `dist` without
      // any other sign — the site would keep serving the last bundle forever.
      console.error(`[${pkg}] watcher exited (code ${code}) — stopping`);
      process.exit(code ?? 1);
    });
  });
}

/** Tags each watcher's output, the way the previous `concurrently` run did. */
function prefixOutput(child, pkg) {
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) console.log(`[${pkg}] ${line}`);
    });
    stream.on('end', () => {
      if (pending) console.log(`[${pkg}] ${pending}`);
    });
  }
}
